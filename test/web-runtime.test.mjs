import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { mkdtemp, realpath, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import * as plugin from '../index.js';

const installation = process.env.DSH_INSTALL_DIR;
test('stock Web Connection serves the owner-only Local memory API without a profile patch', { skip: !installation }, async () => {
  const require = createRequire(path.join(installation, 'package.json'));
  const load = name => import(pathToFileURL(require.resolve(`@deepseek-ai/${name}`)));
  const { Context } = await load('cordis');
  const connection = await load('dsh-client-connection');
  const { default: Tools } = await load('dsh-tools');
  const { default: SystemPrompt } = await load('dsh-system-prompt');
  const dir = await mkdtemp(path.join(await realpath(tmpdir()), 'dsh-local-memory-web-'));
  assert.equal(await realpath(dir), dir);
  assert.ok(path.basename(dir).startsWith('dsh-local-memory-web-'));
  const ctx = new Context();
  const routes = new Map();
  let server;
  const legacyRoots = [process.env.DSH_PROFILE_DIR, process.env.DSH_HOME];
  delete process.env.DSH_PROFILE_DIR;
  delete process.env.DSH_HOME;
  try {
    ctx.provide('profileContext', { dir });
    ctx.provide('webStartup', {});
    ctx.provide('credentials', { async modifyRecord(_key, modify) { return modify(undefined); } });
    ctx.provide('workspaceRegistry', {
      list: () => [{ id: 'fixture', title: 'Fixture', path: dir }],
      get: id => id === 'fixture' ? { path: dir } : undefined,
    });
    await ctx.plugin({ name: 'fixture-webserver', apply(scope) {
      scope.provide('webServer', { host: '127.0.0.1', protocol: 'http:', register(route) {
        assert.ok(!routes.has(route.path));
        routes.set(route.path, route);
        return () => { routes.delete(route.path); };
      } });
    } }).await();
    // The real Connection provider declares credentials and gets webStartup from the
    // Web row; it must not be given webServer here or the original failure is masked.
    await ctx.plugin({ ...connection, inject: [...connection.inject, 'webStartup'] }).await();
    await ctx.plugin(Tools).await();
    await ctx.plugin(SystemPrompt).await();
    // Stand in for the shared Typert fallback; memory must not take its interceptor slot.
    const fallback = ctx.connection.rpc.intercept('/api', endpoint => endpoint === 'fixture-fallback',
      async () => ({ ok: true, value: 'fallback' }));
    const fiber = ctx.plugin(plugin);
    fiber.await().catch(() => {});
    await fiber.await();
    assert.ok(ctx.get('tools').get('local_memory'));
    assert.ok(routes.has('/api'));
    assert.ok(!routes.has('/local-memory'));

    server = createServer((req, res) => {
      if (new URL(req.url, 'http://127.0.0.1').pathname === '/') {
        if (ctx.connection.authorizeIndex(req, res)) res.end();
      } else if (req.url.startsWith('/api/')) {
        void routes.get('/api').handler(req, res);
      } else {
        res.writeHead(404).end();
      }
    });
    await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
    const base = `http://127.0.0.1:${server.address().port}/`;
    // Exchange only the synthetic token of this test server, never a live profile credential.
    const session = await fetch(ctx.connection.authenticatedUrl(base), { redirect: 'manual', signal: AbortSignal.timeout(5000) });
    assert.equal(session.status, 303);
    const cookie = session.headers.get('set-cookie').split(';', 1)[0];
    const post = (endpoint, payload, headers, method = endpoint) => fetch(new URL(`api/${endpoint}`, base), {
      method: 'POST', headers: { 'content-type': 'application/json', ...headers },
      body: JSON.stringify({ type: 'client-request', method, rpcId: 'fixture', payload }), signal: AbortSignal.timeout(5000),
    });
    const action = (name, payload) => post(`local-memory/${name}`, payload, { cookie });
    const { installConnection } = await load('dsh-client-connection/client');
    const browser = new Context();
    installConnection(browser, { transport: { fetch: (url, init) => fetch(new URL(url, base), {
      ...init, headers: { ...init.headers, cookie },
    }) } });
    try {
      const result = await browser.connection.rpc.call('/api', 'local-memory/workspaces', {}, AbortSignal.timeout(5000));
      assert.equal(result.value.workspaces[0].id, 'fixture');
    } finally { await browser.fiber.dispose(); }
    const unauthenticated = await post('local-memory/workspaces', {});
    assert.equal(unauthenticated.status, 401);
    const wrongOrigin = await post('local-memory/workspaces', {}, { cookie, origin: 'https://untrusted.invalid' });
    assert.equal(wrongOrigin.status, 403);
    const shared = ctx.connection.createSharedFetchHandler('/api');
    const nonOwner = await shared.fetch(new Request(new URL('api/local-memory/workspaces', base), { method: 'POST' }), { principal: { kind: 'guest' } });
    assert.equal(nonOwner.status, 403);
    const mismatch = await post('local-memory/save', { workspaceId: 'fixture', title: 'Not saved', body: 'Synthetic' }, { cookie }, 'local-memory/update');
    assert.equal((await mismatch.json()).result.error.code, 'BAD_REQUEST');
    const badType = await post('local-memory/save', {}, { cookie, 'content-type': 'text/plain' });
    assert.equal(badType.status, 415);
    const cancelled = new AbortController();
    cancelled.abort();
    const aborted = await shared.fetch(new Request(new URL('api/local-memory/save', base), {
      method: 'POST', signal: cancelled.signal, headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ type: 'client-request', method: 'local-memory/save', rpcId: 'fixture',
        payload: { workspaceId: 'fixture', title: 'Cancelled', body: 'Never written' } }),
    }), ctx.connection.browserPeer);
    assert.equal(aborted.status, 400);
    const workspaces = await action('workspaces', {});
    assert.equal(workspaces.headers.get('cache-control'), 'no-store');
    assert.deepEqual(await workspaces.json(), { type: 'server-response', rpcId: 'fixture', result: {
      ok: true, value: { workspaces: [{ id: 'fixture', title: 'Fixture', path: dir }],
        storagePath: path.join(dir, 'state/local-memory/memory.sqlite'), mode: 'manual-only', limits: (await import('../store.js')).LIMITS },
    } });
    const tool = ctx.get('tools').get('local_memory');
    const exec = { agent: { session: { id: 'fixture', header: { cwd: dir } } }, signal: new AbortController().signal };
    assert.equal((await tool.execute({ action: 'status' }, exec)).value.noteCount, 0);
    const saved = await (await action('save', { workspaceId: 'fixture', title: 'Web fixture', body: 'Temporary only' })).json();
    assert.equal(saved.result.ok, true);
    const fromTool = await tool.execute({ action: 'get', id: saved.result.value.record.id }, exec);
    assert.equal(fromTool.value.record.body, 'Temporary only');
    assert.deepEqual((await (await post('fixture-fallback', {}, { cookie })).json()).result, { ok: true, value: 'fallback' });
    await fiber.dispose();
    assert.equal((await action('workspaces', {})).status, 404);
    await fallback();
  } finally {
    if (server?.listening) {
      server.closeAllConnections();
      await new Promise(resolve => server.close(resolve));
    }
    try { await ctx.fiber.dispose(); }
    finally {
      for (const [i, name] of ['DSH_PROFILE_DIR', 'DSH_HOME'].entries()) {
        if (legacyRoots[i] === undefined) delete process.env[name];
        else process.env[name] = legacyRoots[i];
      }
      assert.equal(await realpath(dir), dir);
      await rm(dir, { recursive: true });
    }
  }
});
