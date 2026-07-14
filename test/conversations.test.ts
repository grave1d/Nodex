import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, it } from 'vitest';
import { configSchema } from '../src/config.js';
import { buildServer } from '../src/server.js';
import { SessionStore } from '../src/session/store.js';
import { MockTransport } from '../src/transport/mock.js';

let directory = '';

afterEach(async () => {
  if (directory) await rm(directory, { recursive: true, force: true });
});

async function setup() {
  directory = await mkdtemp(join(tmpdir(), 'nodex-conversations-'));
  const config = configSchema.parse({
    databasePath: join(directory, 'db.sqlite'),
    projectRoot: directory,
    models: { dev: { agentPageId: 'p', agentName: 'Dev', notionModel: 'n' } },
    transport: 'mock',
  });
  const store = new SessionStore(config.databasePath);
  const app = buildServer(config, store, new MockTransport());
  await app.ready();
  return { app, store };
}

it('creates, pages, updates, and deletes a conversation without Notion inference', async () => {
  const { app, store } = await setup();
  const created = await app.inject({
    method: 'POST',
    url: '/v1/conversations',
    payload: {
      metadata: { project: 'demo' },
      items: [{ type: 'message', role: 'user', content: 'first' }],
    },
  });
  const conversation = created.json() as { id: string };
  expect(conversation.id).toMatch(/^conv_/);

  await app.inject({
    method: 'POST',
    url: `/v1/conversations/${conversation.id}/items`,
    payload: { items: [{ type: 'message', role: 'user', content: 'second' }] },
  });
  const page = await app.inject({
    method: 'GET',
    url: `/v1/conversations/${conversation.id}/items?order=asc&limit=1`,
  });
  expect(page.json().data).toHaveLength(1);
  expect(page.json().has_more).toBe(true);

  const updated = await app.inject({
    method: 'POST',
    url: `/v1/conversations/${conversation.id}`,
    payload: { metadata: { project: 'updated' } },
  });
  expect(updated.json().metadata.project).toBe('updated');

  expect(
    (await app.inject({ method: 'DELETE', url: `/v1/conversations/${conversation.id}` }))
      .json().deleted,
  ).toBe(true);
  expect(
    (await app.inject({ method: 'GET', url: `/v1/conversations/${conversation.id}` })).statusCode,
  ).toBe(404);
  await app.close();
  store.close();
});

it('persists response input and output in one local conversation', async () => {
  const { app, store } = await setup();
  const conversation = (
    await app.inject({ method: 'POST', url: '/v1/conversations', payload: {} })
  ).json() as { id: string };
  const response = await app.inject({
    method: 'POST',
    url: '/v1/responses',
    payload: { model: 'dev', conversation: conversation.id, input: 'NO_TOOL' },
  });
  expect(response.statusCode).toBe(200);
  const items = await app.inject({
    method: 'GET',
    url: `/v1/conversations/${conversation.id}/items?order=asc`,
  });
  expect(items.json().data.map((item: { role?: string }) => item.role)).toEqual([
    'user',
    'assistant',
  ]);
  await app.close();
  store.close();
});
