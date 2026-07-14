import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, it } from 'vitest';
import { configSchema } from '../src/config.js';
import { buildServer } from '../src/server.js';
import { SessionStore } from '../src/session/store.js';
import type { NotionTransport, TransportRequest } from '../src/transport/types.js';

let directory = '';

afterEach(async () => {
  if (directory) await rm(directory, { recursive: true, force: true });
});

it('keeps one physical Notion thread per conversation and model', async () => {
  directory = await mkdtemp(join(tmpdir(), 'nodex-agents-'));
  const config = configSchema.parse({
    databasePath: join(directory, 'db.sqlite'),
    projectRoot: directory,
    models: {
      first: { agentPageId: 'a', agentName: 'First', notionModel: 'n1' },
      second: { agentPageId: 'b', agentName: 'Second', notionModel: 'n2' },
    },
  });
  const requests: TransportRequest[] = [];
  const transport: NotionTransport = {
    async preflight() {
      return {
        userId: 'u',
        userName: 'U',
        userEmail: 'u@example.invalid',
        workspaceId: 'w',
        workspaceName: 'W',
        spaceViewId: 'v',
      };
    },
    async send(request) {
      requests.push(request);
      return {
        chunks: (async function* () {
          yield '{"type":"final","text":"done"}';
        })(),
        nextState: JSON.stringify({ ok: true }),
      };
    },
  };
  const store = new SessionStore(config.databasePath);
  const conversation = store.createConversation();
  const app = buildServer(config, store, transport);
  await app.ready();

  for (const model of ['first', 'second', 'first']) {
    const response = await app.inject({
      method: 'POST',
      url: '/v1/responses',
      payload: { model, conversation: conversation.id, input: `hello ${model}` },
    });
    expect(response.statusCode).toBe(200);
  }

  expect(requests.map((request) => request.newThread)).toEqual([true, true, false]);
  expect(requests[1]?.message).toContain('CONVERSATION_CONTEXT');
  expect(requests[2]?.message).not.toContain('CONVERSATION_CONTEXT');
  await app.close();
  store.close();
});
