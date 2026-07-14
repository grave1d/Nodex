import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, it } from 'vitest';
import { configSchema } from '../src/config.js';
import { FileStore } from '../src/files/store.js';
import { buildServer } from '../src/server.js';
import { SessionStore } from '../src/session/store.js';
import type { NotionTransport, TransportRequest } from '../src/transport/types.js';

let directory = '';

afterEach(async () => {
  if (directory) {
    await rm(directory, { recursive: true, force: true });
    directory = '';
  }
});

it('passes a local input_image to a capable transport in content order', async () => {
  directory = await mkdtemp(join(tmpdir(), 'nodex-attachments-'));

  const config = configSchema.parse({
    databasePath: join(directory, 'db.sqlite'),
    projectRoot: directory,
    files: { root: join(directory, 'files') },
    models: {
      vision: {
        agentPageId: 'p',
        agentName: 'Vision',
        notionModel: 'n',
        capabilities: { imageInput: true },
      },
    },
  });

  const store = new SessionStore(config.databasePath);
  const fileStore = new FileStore(config.files, store);

  const file = await fileStore.upload(
    (async function* () {
      yield Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1]);
    })(),
    { filename: 'screen.png', purpose: 'vision', mimeType: 'image/png' },
  );

  const requests: TransportRequest[] = [];

  const transport: NotionTransport = {
    attachmentCapabilities: { imageInput: true, fileInput: true },

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
          yield '{"type":"final","text":"image checked"}';
        })(),
        nextState: '{}',
      };
    },
  };

  const app = buildServer(config, store, transport);
  await app.ready();

  try {
    const response = await app.inject({
      method: 'POST',
      url: '/v1/responses',
      payload: {
        model: 'vision',
        input: [
          {
            type: 'message',
            role: 'user',
            content: [
              { type: 'input_text', text: 'check' },
              { type: 'input_image', file_id: file.id, detail: 'high' },
            ],
          },
        ],
      },
    });

    expect(response.statusCode).toBe(200);
    expect(requests[0]?.attachments[0]).toMatchObject({
      fileId: file.id,
      kind: 'image',
      order: 1,
      detail: 'high',
    });
    expect(requests[0]?.message).not.toContain('base64');
  } finally {
    await app.close();
    store.close();
  }
});

it('rejects attachments before inference when transport capability is absent', async () => {
  directory = await mkdtemp(join(tmpdir(), 'nodex-attachments-'));

  const config = configSchema.parse({
    databasePath: join(directory, 'db.sqlite'),
    files: { root: join(directory, 'files') },
    models: {
      vision: {
        agentPageId: 'p',
        agentName: 'Vision',
        notionModel: 'n',
        capabilities: { imageInput: true },
      },
    },
  });

  let sends = 0;

  const transport: NotionTransport = {
    attachmentCapabilities: { imageInput: false, fileInput: false },

    async preflight() {
      throw new Error('unused');
    },

    async send() {
      sends += 1;
      throw new Error('must not send');
    },
  };

  const store = new SessionStore(config.databasePath);
  const app = buildServer(config, store, transport);
  await app.ready();

  try {
    const response = await app.inject({
      method: 'POST',
      url: '/v1/responses',
      payload: {
        model: 'vision',
        input: [
          {
            type: 'message',
            role: 'user',
            content: [{ type: 'input_image', image_url: 'data:image/png;base64,iVBORw0KGgo=' }],
          },
        ],
      },
    });

    expect(response.statusCode).toBe(503);
    expect(response.json().error.code).toBe('capability_unavailable');
    expect(sends).toBe(0);
  } finally {
    await app.close();
    store.close();
  }
});