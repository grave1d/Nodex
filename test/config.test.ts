import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, it } from 'vitest';
import { configSchema, loadConfig } from '../src/config.js';

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
});
