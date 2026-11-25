import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { register } from '../index.js';

// Opt-in real service smoke test. Never boots a profile or opens the note store.
const installation = process.env.DSH_INSTALL_DIR;
test('real DSH services accept memory tool and prompt registrations', { skip: !installation }, async t => {
  const require = createRequire(path.join(installation, 'package.json'));
  const load = async name => import(pathToFileURL(require.resolve(`@deepseek-ai/${name}`)).href);
  const { Context } = await load('cordis');
  const { default: Tools } = await load('dsh-tools');
  const { default: SystemPrompt } = await load('dsh-system-prompt');
  const ctx = new Context();
  t.after(async () => ctx.fiber.dispose());
  await ctx.plugin(Tools).await();
  await ctx.plugin(SystemPrompt).await();
  const routes = new Map();
  const serviceContext = {
    effect: fn => ctx.effect(fn),
    connection: { fetch: { register: route => { routes.set(route.path, route); } } },
    workspaceRegistry: { list: () => [], get: () => undefined },
    tools: ctx.tools, systemPrompt: ctx.systemPrompt,
  };
  register(serviceContext, { file: 'not-opened', close() {} });
  assert.equal(typeof routes.get('/api/local-memory/workspaces')?.fetch, 'function');
  // Registration is the plugin's contract; assembling the whole application
  // would additionally require a model-specific executor/preset.
  assert.ok(ctx.tools.get('local_memory'));
});
