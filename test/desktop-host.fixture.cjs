'use strict';
// Synthetic Cordis Host fixture. Launched only by desktop-runtime.test.mjs.
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL, fileURLToPath } = require('node:url');
const { createRequire } = require('node:module');
const fs = require('node:fs');
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
  const ctx = new Context();
  let tool, handler;
  if (mode !== 'no-profile') ctx.provide('profileContext', { name: mode, dir: path.join(root, 'profiles/desktop'), home: root });
  ctx.provide('connection', { rpc: { handle(_channel, callback) { handler = callback; return () => {}; } } });
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
    assert.ok(tool && handler);
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
