import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, it } from 'vitest';
import {
  configSchema,
  LEGACY_AGENT_PAGE_ID_WARNING,
  loadConfig,
} from '../src/config.js';

let directory = '';
afterEach(async () => {
  delete process.env['NODEX_PORT'];
  if (directory) await rm(directory, { recursive: true, force: true });
});

it('validates environment overrides through the config schema', async () => {
  directory = await mkdtemp(join(tmpdir(), 'nodex-config-'));
  process.env['NODEX_PORT'] = 'not-a-port';
  await expect(loadConfig(join(directory, 'missing.json'))).rejects.toThrow();
});

it('enables Notion model synchronization while keeping the slug optional', () => {
  const config = configSchema.parse({
    models: {
      dev: {
        agentPageId: 'page',
        agentName: 'Agent',
        notionModel: 'GPT-5.6 Sol',
      },
    },
  });

  expect(config.models['dev']?.syncNotionModel).toBe(true);
  expect(config.models['dev']?.notionModelSlug).toBeUndefined();
  expect(config.models['dev']?.agentInstructionsPageId).toBe('page');
});

it('prefers the canonical instructions ID and reports the legacy alias', async () => {
  const config = configSchema.parse({
    models: {
      dev: {
        agentInstructionsPageId: 'instructions-page',
        agentPageId: 'legacy-page',
        agentName: 'Agent',
        notionModel: 'Model',
      },
    },
  });
  expect(config.models['dev']?.agentInstructionsPageId).toBe('instructions-page');
  expect(config.models['dev']).not.toHaveProperty('agentPageId');

  directory = await mkdtemp(join(tmpdir(), 'nodex-config-warning-'));
  const path = join(directory, 'nodex.config.json');
  await import('node:fs/promises').then(({ writeFile }) => writeFile(path, JSON.stringify({
    models: {
      dev: { agentPageId: 'legacy', agentName: 'Agent', notionModel: 'Model' },
    },
  }), 'utf8'));
  const warnings: string[] = [];
  await loadConfig(path, { onWarning: (warning) => warnings.push(warning) });
  expect(warnings).toEqual([LEGACY_AGENT_PAGE_ID_WARNING]);
});
