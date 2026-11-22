'use strict';
// Synthetic Cordis Host fixture. Launched only by desktop-runtime.test.mjs.
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL, fileURLToPath } = require('node:url');
const { createRequire } = require('node:module');
const fs = require('node:fs');
const http = require('node:http');
const root = fs.realpathSync(process.argv[2]);
const source = fs.realpathSync(process.argv[3]);
const mode = process.argv[4];
const expected = path.join(root, mode === 'desktop' ? 'profiles/desktop' : 'web-home', 'state/local-memory');
assert.ok(path.basename(root).startsWith('dsh-memory-desktop-fixture-'));
assert.equal(process.env.HOME, root);
assert.equal(process.env.DSH_PROFILE_DIR, undefined);
assert.equal(process.env.DSH_HOME, mode === 'web' ? path.join(root, 'web-home') : undefined);
const req = createRequire(path.join(process.resourcesPath, 'app.asar/dsh/package.json'));
const { Context } = req('@deepseek-ai/cordis');
(async () => {
  const plugin = await import(pathToFileURL(source).href);
  assert.ok(plugin.inject.includes('webServer'), 'RPC route owner must inject webServer');
  const ctx = new Context();
  let tool;
  const routes = [];
  if (mode !== 'no-profile') ctx.provide('profileContext', { name: mode, dir: path.join(root, 'profiles/desktop'), home: root });
  await ctx.plugin({ name: 'synthetic-webserver-owner', apply(scope) {
    scope.provide('webServer', { host: '127.0.0.1', protocol: 'http:', register(route) { routes.push(route); return () => {}; } });
  } });
  const { HostConnectionService } = req('@deepseek-ai/dsh-client-connection');
  await ctx.plugin({ name: 'synthetic-connection-owner', inject: ['webServer'], apply(scope) {
    new HostConnectionService(scope, [], { isAuthenticated() { return true; }, authenticateApi() {} });
  } });
  assert.ok(ctx.get('connection'), 'real connection service unavailable');
  ctx.provide('workspaceRegistry', { list() { return []; }, get() {} });
  ctx.provide('tools', { register(value) { tool = value; return () => {}; } });
  ctx.provide('systemPrompt', { section() { return () => {}; } });
  try {
    if (mode === 'no-profile') {
      await assert.rejects(plugin.apply(ctx), error => error.code === 'STORE_UNAVAILABLE');
      assert.deepEqual(fs.readdirSync(root), []);
      process.stdout.write(JSON.stringify({ mode, status: 'refused', synthetic: true }) + '\n');
      return;
    }
    await ctx.plugin(plugin);
    assert.ok(tool);
    const matching = routes.filter(route => route.path === '/local-memory' && route.kind === 'prefix' && typeof route.handler === 'function');
    assert.equal(matching.length, 1);
    const server = http.createServer(matching[0].handler);
    await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
    try {
      const port = server.address().port;
      const response = await fetch(`http://127.0.0.1:${port}/local-memory/workspaces`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ type: 'client-request', rpcId: 'fixture', method: 'workspaces', payload: {} }),
      });
      assert.equal(response.status, 200);
      const envelope = await response.json();
      assert.equal(envelope.result.ok, true);
      assert.deepEqual(envelope.result.value.workspaces, []);
      assert.equal(envelope.result.value.storagePath, path.join(expected, 'memory.sqlite'));
    } finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
    const result = await tool.execute({ action: 'status' }, {
      agent: { session: { id: 'synthetic', header: { cwd: root } } }, signal: new AbortController().signal,
    });
    assert.equal(result.ok, true);
    assert.equal(result.value.storagePath, path.join(expected, 'memory.sqlite'));
    assert.equal(result.value.noteCount, 0);
    if (mode === 'web') assert.equal(fs.existsSync(path.join(root, 'profiles/desktop/state/local-memory')), false);
    process.stdout.write(JSON.stringify({ mode, status: 'ok', synthetic: true }) + '\n');
  } finally { await ctx.fiber.dispose(); }
})().catch(error => { process.stderr.write(String(error.stack || error) + '\n'); process.exitCode = 1; });
