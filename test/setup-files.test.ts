import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, it } from 'vitest';
import {
  appendGitignoreEntries,
  codexConfigSnippet,
  ensureLocalApiKey,
  loadLocalEnv,
  missingGitignoreEntries,
  planConfigUpdate,
  writeConfigPlan,
} from '../src/setup/files.js';
import type { DiscoveredNotionAgent } from '../src/transport/types.js';

let directory = '';
afterEach(async () => {
  if (directory) await rm(directory, { recursive: true, force: true });
  directory = '';
});

function agent(id = 'instructions-page'): DiscoveredNotionAgent {
  return {
    name: 'Product Agent',
    workflowId: 'workflow-id',
    agentInstructionsPageId: id,
    spaceId: 'space-id',
    spaceName: 'Workspace',
    modelSlug: 'orange-mousse',
    modelName: 'GPT Test',
  };
}

it('creates a canonical config in a Windows-style path with spaces', async () => {
  directory = await mkdtemp(join(tmpdir(), 'Nodex test '));
  const path = join(directory, 'nodex.config.json');
  const plan = await planConfigUpdate(agent(), path);
  expect(plan.exists).toBe(false);
  await writeConfigPlan(plan);
  const config = JSON.parse(await readFile(path, 'utf8')) as Record<string, unknown>;
  const models = config['models'] as Record<string, Record<string, unknown>>;
  expect(models['codex-notion-agent']).toMatchObject({
    agentInstructionsPageId: 'instructions-page',
    agentName: 'Product Agent',
    notionModelSlug: 'orange-mousse',
    syncNotionModel: true,
  });
  expect(models['codex-notion-agent']).not.toHaveProperty('agentPageId');
});

it('migrates legacy bindings, preserves capabilities, and writes a backup', async () => {
  directory = await mkdtemp(join(tmpdir(), 'nodex-migrate-'));
  const path = join(directory, 'nodex.config.json');
  await writeFile(path, JSON.stringify({
    server: { port: 9999 },
    models: {
      legacy: { agentPageId: 'legacy-page', agentName: 'Legacy', notionModel: 'Legacy Model' },
      'codex-notion-agent': {
        agentPageId: 'old-page',
        agentName: 'Old',
        notionModel: 'Old Model',
        capabilities: { functionCalling: false },
      },
    },
  }), 'utf8');
  const plan = await planConfigUpdate(agent('new-page'), path);
  const saved = await writeConfigPlan(
    plan,
    new Date('2026-07-14T12:00:00.000Z'),
    join(directory, 'backups'),
  );
  expect(saved.backupPath).toContain('nodex.config.json-20260714T120000000Z.backup');
  expect(await readFile(saved.backupPath!, 'utf8')).toContain('agentPageId');
  const config = JSON.parse(await readFile(path, 'utf8')) as {
    models: Record<string, Record<string, unknown>>;
  };
  expect(config.models['legacy']).toMatchObject({ agentInstructionsPageId: 'legacy-page' });
  expect(config.models['codex-notion-agent']).toMatchObject({
    agentInstructionsPageId: 'new-page',
    capabilities: { functionCalling: false },
  });
  expect(await readFile(path, 'utf8')).not.toContain('agentPageId');
});

it('creates, masks, reloads, and reuses a strong local API key', async () => {
  directory = await mkdtemp(join(tmpdir(), 'nodex-env-'));
  const path = join(directory, '.env');
  const created = await ensureLocalApiKey(path);
  const source = await readFile(path, 'utf8');
  const key = /^NODEX_API_KEY=(nodex_[A-Za-z0-9_-]{40,})$/m.exec(source)?.[1];
  expect(key).toBeTruthy();
  expect(created.masked).not.toContain(key!);
  expect(created.masked).toMatch(/^nodex_••••/);

  const env: NodeJS.ProcessEnv = {};
  await loadLocalEnv(path, env);
  expect(env['NODEX_API_KEY']).toBe(key);
  const reused = await ensureLocalApiKey(path);
  expect(reused).toEqual({ path, created: false, masked: created.masked });
});

it('updates gitignore only through the explicit append operation', async () => {
  directory = await mkdtemp(join(tmpdir(), 'nodex-ignore-'));
  const path = join(directory, '.gitignore');
  await writeFile(path, 'node_modules/\n.env\n', 'utf8');
  const missing = await missingGitignoreEntries(path);
  expect(missing).not.toContain('.env');
  expect(missing).toContain('.nodex/');
  expect(await readFile(path, 'utf8')).toBe('node_modules/\n.env\n');
  await appendGitignoreEntries(missing, path);
  expect(await missingGitignoreEntries(path)).toEqual([]);
});

it('produces the Codex Responses provider snippet', () => {
  expect(codexConfigSnippet()).toContain('model = "codex-notion-agent"');
  expect(codexConfigSnippet()).toContain('wire_api = "responses"');
  expect(codexConfigSnippet()).toContain('requires_openai_auth = false');
});
