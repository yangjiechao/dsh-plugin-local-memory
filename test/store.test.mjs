import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, realpath, rm, stat, symlink, link, writeFile, readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { MemoryStore, LIMITS, forModel } from '../store.js';
import { MemoryService, register, stateDirectory, canonicalProject } from '../index.js';

async function fixture(t, openStore = true) {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'dsh-local-memory-test-'));
  const canonical = await realpath(dir);
  assert.ok(path.basename(canonical).startsWith('dsh-local-memory-test-'));
  const store = openStore ? await MemoryStore.open(path.join(dir, 'data')) : null;
  t.after(async () => {
    store?.close();
    assert.equal(await realpath(dir), canonical);
    assert.ok(path.basename(canonical).startsWith('dsh-local-memory-test-'));
    await rm(canonical, { recursive: true });
  });
  return { dir, store };
}
const note = { title: 'Build convention', body: 'Use pnpm for this project.', tags: ['tools'] };
const code = wanted => error => error.code === wanted;

test('manual CRUD survives reopen, FTS updates and deletion persists', async t => {
  const { dir, store } = await fixture(t);
  const first = store.save('/project/a', note, 'session-origin').record;
  assert.equal(first.version, 1); assert.equal(first.sourceSessionId, 'session-origin');
  assert.equal(store.list('/project/a', { query: 'pnpm' }).total, 1);
  const changed = store.update('/project/a', { ...note, id: first.id, expectedVersion: 1, body: 'Use bun instead.' }).record;
  assert.equal(changed.version, 2); assert.equal(changed.sourceSessionId, 'session-origin');
  assert.equal(store.list('/project/a', { query: 'pnpm' }).total, 0);
  assert.equal(store.list('/project/a', { query: 'bun' }).total, 1);
  store.close();
  const reopened = await MemoryStore.open(path.join(dir, 'data'));
  assert.equal(reopened.get('/project/a', first.id).record.body, changed.body);
  assert.deepEqual(reopened.delete('/project/a', { id: first.id, expectedVersion: 2 }), { deleted: true, id: first.id });
  assert.equal(reopened.list('/project/a').total, 0); reopened.close();
  const last = await MemoryStore.open(path.join(dir, 'data'));
  assert.equal(last.list('/project/a', { query: 'bun' }).total, 0); last.close();
});
test('every read/write is project-isolated, including known IDs', async t => {
  const { store } = await fixture(t); const a = store.save('/project/a', note).record;
  assert.equal(store.list('/project/b').total, 0);
  assert.throws(() => store.get('/project/b', a.id), code('NOT_FOUND'));
  assert.throws(() => store.update('/project/b', { ...note, id: a.id, expectedVersion: 1 }), code('NOT_FOUND'));
  assert.throws(() => store.delete('/project/b', { id: a.id, expectedVersion: 1 }), code('NOT_FOUND'));
  assert.equal(store.get('/project/a', a.id).record.version, 1);
});
test('Chinese, punctuation, SQL and FTS syntax are literal bounded queries', async t => {
  const { store } = await fixture(t);
  store.save('/project/a', { title: '中文项目', body: '本地记忆支持短词查询。Literal foo* OR bar and a "quoted" phrase.' });
  for (const query of ['记忆', '词', 'foo* OR bar', '"quoted"']) assert.equal(store.list('/project/a', { query }).total, 1, query);
  for (const query of ["' OR 1=1 --", 'x" OR title:*', 'NEAR(foo bar)', '*', ':', '"']) assert.doesNotThrow(() => store.list('/project/a', { query }), query);
  assert.equal(store.list('/project/a', { query: "' OR 1=1 --" }).total, 0);
  assert.equal(store.list('/project/b', { query: '记忆' }).total, 0);
});
test('optimistic versions refuse stale changes across two open connections', async t => {
  const { store, dir } = await fixture(t); const a = store.save('/project/a', note).record;
  const other = await MemoryStore.open(path.join(dir, 'data')); t.after(() => other.close());
  other.update('/project/a', { ...note, id: a.id, expectedVersion: 1, body: 'Other editor' });
  assert.throws(() => store.update('/project/a', { ...note, id: a.id, expectedVersion: 1 }), code('CONFLICT'));
  assert.throws(() => store.delete('/project/a', { id: a.id, expectedVersion: 1 }), code('CONFLICT'));
  assert.equal(store.get('/project/a', a.id).record.body, 'Other editor');
});
test('invalid input is refused without creating notes', async t => {
  const { store } = await fixture(t);
  for (const input of [{ ...note, title: '' }, { ...note, title: 'x'.repeat(121) }, { ...note, body: 'x'.repeat(8001) },
    { ...note, tags: 'no' }, { ...note, tags: ['x'.repeat(25)] }, { ...note, tags: Array(9).fill('tag') }, { ...note, body: 'nul\0' }]) {
    assert.throws(() => store.save('/project/a', input), code('BAD_REQUEST'));
  }
  assert.throws(() => store.save('relative', note), code('NO_PROJECT'));
  assert.throws(() => store.list('/project/a', { limit: 51 }), code('BAD_REQUEST'));
  assert.throws(() => store.list('/project/a', { offset: -1 }), code('BAD_REQUEST'));
  assert.throws(() => store.list('/project/a', { query: 'x'.repeat(121) }), code('BAD_REQUEST'));
  assert.equal(store.list('/project/a').total, 0);
});
for (const secret of ['-----BEGIN PRIVATE KEY-----', 'ghp_' + 'a'.repeat(36), 'github_pat_' + 'a'.repeat(30),
  'sk-proj-' + 'b'.repeat(40), 'AKIA1234567890ABCDEF', 'Bearer ' + 'a'.repeat(30), '密码：a-secret-value', 'https://alice:password@example.test']) {
  test(`credential-shaped text is refused (${secret.slice(0, 12)})`, async t => {
    const { store } = await fixture(t);
    assert.throws(() => store.save('/project/a', { title: 'redacted test', body: secret }), code('SECRET_DETECTED'));
    assert.equal(store.list('/project/a').total, 0);
  });
}
test('bounded lists and model projections clearly disclose truncation', async t => {
  const { store } = await fixture(t);
  for (let i = 0; i < 22; i++) store.save('/project/a', { title: `Note ${i}`, body: 'x'.repeat(8000) });
  const page = store.list('/project/a'); assert.equal(page.items.length, 20); assert.equal(page.hasMore, true);
  assert.equal(page.items[0].body, undefined); assert.equal(page.items[0].preview.length, 240);
  assert.equal(store.list('/project/a', { offset: 20 }).items.length, 2);
  const result = forModel({ record: { body: 'x'.repeat(8000) } });
  assert.equal(result.record.body.length, 6000); assert.equal(result.truncated, true); assert.equal(result.untrustedHistoricalData, true);
});
test('per-project quotas fail before any note or index is written', async t => {
  const { store } = await fixture(t);
  const insert = store.db.prepare('INSERT INTO notes(id,project,title,body,tags,version,created_at,updated_at) VALUES(?,?,?,?,?,1,0,0)');
  store.transaction(() => { for (let i = 0; i < LIMITS.perProject; i++) insert.run(`synthetic-${i}`, '/project/a', 'synthetic', 'body', '[]'); });
  assert.throws(() => store.save('/project/a', note), code('LIMIT'));
  assert.equal(store.list('/project/a').total, 1000); assert.equal(store.list('/project/a', { query: 'pnpm' }).total, 0);
  assert.equal(store.save('/project/b', note).record.title, note.title);
});
test('future and unrelated database formats are never initialized over', async t => {
  const { dir } = await fixture(t, false);
  for (const version of [0, 99]) {
    const sub = path.join(dir, `version-${version}`);
    const { mkdir } = await import('node:fs/promises'); await mkdir(sub);
    const file = path.join(sub, 'memory.sqlite'); const db = new DatabaseSync(file);
    db.exec(`CREATE TABLE unrelated(value TEXT); INSERT INTO unrelated VALUES('keep'); PRAGMA user_version=${version};`); db.close();
    await assert.rejects(MemoryStore.open(sub), code('STORE_UNAVAILABLE'));
    const verify = new DatabaseSync(file); assert.equal(verify.prepare('SELECT value FROM unrelated').get().value, 'keep'); verify.close();
  }
});
test('symlink database and hard-linked database are refused', async t => {
  const { dir } = await fixture(t, false); const { mkdir } = await import('node:fs/promises');
  const original = path.join(dir, 'original'); await writeFile(original, 'unrelated payload');
  for (const kind of ['symlink', 'hardlink']) {
    const sub = path.join(dir, kind); await mkdir(sub);
    if (kind === 'symlink') await symlink(original, path.join(sub, 'memory.sqlite'));
    else await link(original, path.join(sub, 'memory.sqlite'));
    await assert.rejects(MemoryStore.open(sub), code('STORE_UNAVAILABLE'));
  }
  assert.equal(await readFile(original, 'utf8'), 'unrelated payload');
});
test('state root preserves legacy environment priority and supports desktop profile context', () => {
  const profile = path.resolve('/fixture/desktop-profile');
  const home = path.resolve('/fixture/dsh-home');
  const explicitProfile = path.resolve('/fixture/explicit-profile');
  const suffix = ['state', 'local-memory'];
  assert.equal(stateDirectory({ DSH_PROFILE_DIR: explicitProfile, DSH_HOME: home }, { dir: profile }), path.join(explicitProfile, ...suffix));
  assert.equal(stateDirectory({ DSH_HOME: home }, { dir: profile }), path.join(home, ...suffix));
  assert.equal(stateDirectory({}, { dir: profile, home }), path.join(profile, ...suffix));
  assert.equal(stateDirectory({ DSH_PROFILE_DIR: '', DSH_HOME: '' }, { dir: profile }), path.join(profile, ...suffix));
  assert.throws(() => stateDirectory({ DSH_PROFILE_DIR: 'relative', DSH_HOME: home }, { dir: profile }), code('STORE_UNAVAILABLE'));
  assert.throws(() => stateDirectory({ DSH_HOME: 'relative' }, { dir: profile }), code('STORE_UNAVAILABLE'));
  assert.throws(() => stateDirectory({}, { dir: 'relative', home }), code('STORE_UNAVAILABLE'));
  assert.throws(() => stateDirectory({}, { home }), code('STORE_UNAVAILABLE'));
  assert.throws(() => stateDirectory({}, { dir: `${profile}\0invalid` }), code('STORE_UNAVAILABLE'));
  assert.throws(() => stateDirectory({}), code('STORE_UNAVAILABLE'));
});

test('POSIX data permissions are owner-only; status path resolves without hardcoding home', async t => {
  const { store, dir } = await fixture(t);
  if (process.platform !== 'win32') {
    assert.equal((await stat(store.file)).mode & 0o777, 0o600);
    assert.equal((await stat(path.dirname(store.file))).mode & 0o777, 0o700);
  }
  assert.equal(stateDirectory({ DSH_PROFILE_DIR: dir }), path.join(dir, 'state', 'local-memory'));
  assert.throws(() => stateDirectory({}), code('STORE_UNAVAILABLE'));
  const alias = path.join(dir, 'alias'); await symlink(path.dirname(store.file), alias);
  assert.equal(await canonicalProject(alias), await realpath(path.dirname(store.file)));
});

test('strict model adapters can fill unused standard fields without bypassing scope or budgets', async t => {
  const { store, dir } = await fixture(t); const project = await realpath(dir);
  const h = fakeContext([{ id: 'w', title: 'A', path: project }]); register(h.ctx, store);
  const tool = h.tools[0], signal = new AbortController().signal;
  const exec = { agent: { session: { id: 'synthetic', header: { cwd: project } } }, signal };
  const defaults = { body: '', title: '', tags: [], id: '', expectedVersion: 1, query: '', limit: 8, offset: 0 };
  assert.equal((await tool.execute({ action: 'status', ...defaults }, exec)).ok, true);
  for (let i = 0; i < 9; i++) store.save(project, { title: `N ${i}`, body: '  Keep indentation\n' });
  const list = await tool.execute({ ...defaults, action: 'list' }, exec);
  assert.equal(list.value.items.length, 8); assert.equal(list.value.hasMore, true);
  const exact = store.get(project, list.value.items[0].id).record; assert.equal(exact.body, '  Keep indentation\n');
  assert.equal((await tool.execute({ ...defaults, action: 'list', limit: 9 }, exec)).error.code, 'BAD_REQUEST');
  assert.equal((await tool.execute({ ...defaults, action: 'status', project: '/other' }, exec)).error.code, 'BAD_REQUEST');
});

function fakeContext(workspaces) {
  const x = { cleanups: [], tools: [], prompts: [], rpc: null };
  x.ctx = { effect(fn) { x.cleanups.push(fn()); },
    connection: { rpc: { handle(channel, fn) { assert.equal(channel, '/local-memory'); x.rpc = fn; } } },
    workspaceRegistry: { list: () => workspaces, get: id => workspaces.find(w => w.id === id) },
    tools: { register(tool) { x.tools.push(tool); } }, systemPrompt: { section(prompt) { x.prompts.push(prompt); } },
  };
  return x;
}
test('UI and tool share operations, owner RPC and project isolation are enforced', async t => {
  const { store, dir } = await fixture(t); const project = await realpath(dir);
  const h = fakeContext([{ id: 'workspace-a', title: 'A', path: project }]); register(h.ctx, store);
  const signal = new AbortController().signal, owner = { principal: { kind: 'owner' }, signal };
  const denied = await h.rpc('workspaces', {}, signal, { principal: { kind: 'guest' }, signal });
  assert.equal(denied.error.code, 'FORBIDDEN');
  const unknown = await h.rpc('list', { workspaceId: '/arbitrary/path' }, signal, owner); assert.equal(unknown.error.code, 'NO_PROJECT');
  const invalid = await h.rpc('save', { workspaceId: 'workspace-a', ...note, project: '/other' }, signal, owner); assert.equal(invalid.error.code, 'BAD_REQUEST');
  const saved = await h.rpc('save', { workspaceId: 'workspace-a', ...note }, signal, owner); assert.equal(saved.ok, true);
  const tool = h.tools[0]; assert.equal(tool.name, 'local_memory');
  const exec = { agent: { session: { id: 'synthetic', header: { cwd: project } } }, signal };
  const same = await tool.execute({ action: 'get', id: saved.value.record.id }, exec);
  assert.equal(same.value.record.body, note.body);
  const scoped = await tool.execute({ action: 'get', id: saved.value.record.id }, { ...exec, agent: { session: { header: { cwd: '/project/other' } } } });
  assert.equal(scoped.error.code, 'NOT_FOUND');
  const override = await tool.execute({ action: 'list', workspaceId: 'workspace-a' }, exec); assert.equal(override.error.code, 'BAD_REQUEST');
  const noAgent = await tool.execute({ action: 'list' }, { signal }); assert.equal(noAgent.error.code, 'NO_PROJECT');
  assert.equal(h.prompts.length, 1); assert.equal(typeof h.prompts[0].text, 'string');
  assert.ok(!h.prompts[0].text.includes(note.body));
  const service = new MemoryService(store); assert.throws(() => service.request('oops', {}, project), code('BAD_REQUEST'));
  for (const dispose of h.cleanups) dispose();
  assert.throws(() => store.list(project), code('STORE_UNAVAILABLE'));
});
