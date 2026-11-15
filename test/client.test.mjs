import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
const source = await readFile(new URL('../client.js', import.meta.url), 'utf8');
function harness(call, confirms = []) {
  let hooks;
  const sandbox = { AbortController, setTimeout, clearTimeout, window: {
    confirm: () => confirms.length ? confirms.shift() : true,
    __ModuleLoader__: { load(module) { module.factory(() => ({})); } },
  } };
  sandbox.capture = value => { hooks = value; };
  vm.runInNewContext(source.replace('    const css = `', '    capture({ createController, dictionaries });\n    const css = `'), sandbox);
  const ctx = { connection: { rpc: { call: async (_channel, endpoint, payload, signal) => call(endpoint, payload, signal) } },
    locale: { bind: () => (key, args = {}) => key + JSON.stringify(args) } };
  return { controller: hooks.createController(ctx), hooks };
}
const ok = value => ({ ok: true, value });
const record = (id = 'note-a') => ({ id, title: 'Original', body: 'Current body', tags: [], version: 1, createdAt: 123, updatedAt: 123 });
const workspaces = [{ id: 'a', title: 'A', path: '/project/a' }, { id: 'b', title: 'B', path: '/project/b' }];
const flush = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };
function basic(endpoint) {
  if (endpoint === 'workspaces') return ok({ workspaces, storagePath: '/state/memory.sqlite' });
  if (endpoint === 'list') return ok({ items: [], total: 0, hasMore: false });
  if (endpoint === 'get') return ok({ record: record() });
  throw Error(`Unexpected ${endpoint}`);
}

test('locales stay in sync and workspace selection is explicit', async () => {
  const h = harness(basic); const c = h.controller;
  assert.deepEqual(Object.keys(h.hooks.dictionaries.en).sort(), Object.keys(h.hooks.dictionaries.zh).sort());
  await c.ensure(); assert.equal(c.getSnapshot().workspaceId, '');
  c.selectProject('arbitrary-path'); assert.equal(c.getSnapshot().workspaceId, '');
  c.selectProject('a'); await flush(); assert.equal(c.getSnapshot().workspaceId, 'a'); c.dispose();
});
test('late read cannot populate another workspace and unsaved drafts need consent', async () => {
  const late = deferred(); const choices = [false, true];
  const h = harness((endpoint, payload) => endpoint === 'list' && payload.workspaceId === 'a' ? late.promise : basic(endpoint), choices);
  const c = h.controller; await c.ensure(); c.selectProject('a'); c.selectProject('b'); await flush();
  late.resolve(ok({ items: [record()], total: 1, hasMore: false })); await flush();
  assert.equal(c.getSnapshot().workspaceId, 'b'); assert.equal(c.getSnapshot().items.length, 0);
  c.newNote(); c.edit('title', 'Draft'); c.selectProject('a'); assert.equal(c.getSnapshot().workspaceId, 'b');
  assert.equal(c.getSnapshot().draft.title, 'Draft'); c.selectProject('a'); assert.equal(c.getSnapshot().draft, null); c.dispose();
});
test('save has synchronous duplicate lock; confirmed save survives list-refresh error', async () => {
  const waiting = deferred(); let writes = 0, listFails = false;
  const h = harness((endpoint, payload) => {
    if (endpoint === 'save') { writes++; return waiting.promise; }
    if (endpoint === 'list' && listFails) throw Error('offline');
    return basic(endpoint, payload);
  });
  const c = h.controller; await c.ensure(); c.selectProject('a'); await flush(); c.newNote();
  c.edit('title', 'Draft'); c.edit('body', 'Saved body');
  const first = c.save(); await c.save(); assert.equal(writes, 1);
  listFails = true; waiting.resolve(ok({ record: { ...record(), title: 'Draft', body: 'Saved body' } })); await first; await flush();
  assert.equal(c.getSnapshot().message, 'saved'); assert.equal(c.getSnapshot().listFailed, true); assert.equal(c.isDirty(), false); c.dispose();
});
test('uncertain mutation keeps provenance, locks every write until explicit acknowledgement', async () => {
  let writes = 0;
  const h = harness((endpoint, payload) => { if (endpoint === 'save' || endpoint === 'delete') { writes++; throw Error('lost response'); } return basic(endpoint, payload); });
  const c = h.controller; await c.ensure(); c.selectProject('a'); await flush(); c.newNote(); c.edit('title', 'Draft'); c.edit('body', 'content');
  await c.save(); assert.equal(c.getSnapshot().error, 'uncertain'); assert.equal(c.getSnapshot().uncertain.workspace, '/project/a');
  assert.equal(c.getSnapshot().draft.title, 'Draft');
  c.refresh(); await flush(); c.selectProject('b'); await flush();
  assert.ok(c.getSnapshot().uncertain); c.newNote(); c.edit('title', 'Other'); c.edit('body', 'text');
  await c.save(); await c.remove(record()); assert.equal(writes, 1);
  c.acknowledgeUncertain(); assert.equal(c.getSnapshot().uncertain, null);
  await c.save(); assert.equal(writes, 2); c.dispose();
});
test('conflict preserves draft and is independent of the uncertain-operation lock', async () => {
  let updates = 0;
  const h = harness((endpoint, payload) => {
    if (endpoint === 'update') { updates++; return { ok: false, error: { code: 'CONFLICT' } }; }
    return basic(endpoint, payload);
  });
  const c = h.controller; await c.ensure(); c.selectProject('a'); await flush(); await c.open('note-a'); c.edit('body', 'My edited draft');
  await c.save(); assert.equal(c.getSnapshot().conflict, true); assert.equal(c.getSnapshot().draft.body, 'My edited draft');
  c.acknowledgeUncertain(); await c.save(); assert.equal(updates, 1); c.dispose();
});
