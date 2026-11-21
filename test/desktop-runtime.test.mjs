import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, realpath, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import os from 'node:os';
import path from 'node:path';

const electron = '/Applications/DeepSeek Harness.app/Contents/MacOS/DeepSeek Harness';
const fixture = fileURLToPath(new URL('./desktop-host.fixture.cjs', import.meta.url));
const source = fileURLToPath(new URL('../index.js', import.meta.url));
for (const mode of ['desktop', 'web', 'no-profile']) {
  test(`desktop Electron host uses ${mode === 'web' ? 'legacy Web home' : mode === 'desktop' ? 'launcher profileContext' : 'no guessed root'}`, { skip: !existsSync(electron) }, async t => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'dsh-memory-desktop-fixture-'));
    const canonical = await realpath(root);
    assert.ok(path.basename(canonical).startsWith('dsh-memory-desktop-fixture-'));
    t.after(async () => {
      assert.equal(await realpath(root), canonical);
      assert.ok(path.basename(canonical).startsWith('dsh-memory-desktop-fixture-'));
      await rm(canonical, { recursive: true });
    });
    // Never inherit actual DSH homes or any credentials. The child can only see this synthetic HOME.
    const env = { HOME: canonical, PATH: '/usr/bin:/bin', ELECTRON_RUN_AS_NODE: '1' };
    if (mode === 'web') env.DSH_HOME = path.join(canonical, 'web-home');
    const r = spawnSync(electron, ['--expose-internals', fixture, canonical, source, mode], {
      cwd: canonical, env, encoding: 'utf8', timeout: 30000,
    });
    assert.equal(r.status, 0, `synthetic ${mode} host failed: ${r.stderr}`);
    assert.deepEqual(JSON.parse(r.stdout), { mode, status: mode === 'no-profile' ? 'refused' : 'ok', synthetic: true });
  });
}
