import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, it } from 'vitest';
import { configSchema } from '../src/config.js';
import { FileStore } from '../src/files/store.js';
import type {
  ImageEditRequest,
  ImageGenerationRequest,
  ImageProvider,
} from '../src/images/provider.js';
import { ImageService } from '../src/images/service.js';
import { buildServer } from '../src/server.js';
import { SessionStore } from '../src/session/store.js';
import type { NotionTransport } from '../src/transport/types.js';

let directory = '';

afterEach(async () => {
  if (directory) await rm(directory, { recursive: true, force: true });
});

const png = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
  0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52,
  0, 0, 0, 1, 0, 0, 0, 1, 8, 6, 0, 0, 0,
]);

function provider(): ImageProvider {
  const artifact = [{ bytes: png, mimeType: 'image/png', filename: 'result.png' }];
  return {
    probe: () => ({
      available: true,
      models: [{
        id: 'image-model',
        providerModel: 'provider-model',
        generation: true,
        edit: true,
        sizes: ['auto'],
        qualities: ['auto'],
        outputFormats: ['png'],
        backgrounds: ['auto'],
        maxImages: 1,
      }],
    }),
    async generate(_request: ImageGenerationRequest, options) {
      options.onProgress?.({ phase: 'generating', message: 'Создаю изображение' });
      return artifact;
    },
    async edit(_request: ImageEditRequest) { return artifact; },
  };
}

it('serves standalone generation and a native Responses image_generation_call', async () => {
  directory = await mkdtemp(join(tmpdir(), 'nodex-images-api-'));
  const config = configSchema.parse({
    databasePath: join(directory, 'db.sqlite'),
    projectRoot: directory,
    files: { root: join(directory, 'files') },
    models: {
      dev: {
        agentPageId: 'p',
        agentName: 'Dev',
        notionModel: 'n',
        capabilities: { imageGeneration: true },
      },
    },
  });
  const store = new SessionStore(config.databasePath);
  const imageService = new ImageService(provider(), new FileStore(config.files, store));
  const transport: NotionTransport = {
    attachmentCapabilities: { imageInput: false, fileInput: false },
    async preflight() { throw new Error('unused'); },
    async send() {
      return {
        chunks: (async function* () {
          yield '{"type":"tool_call","calls":[{"id":"image_1","name":"image_generation","arguments":{"prompt":"an otter"}}]}';
        })(),
        nextState: '{}',
      };
    },
  };
  const app = buildServer(config, store, transport, { imageService });
  await app.ready();

  const standalone = await app.inject({
    method: 'POST',
    url: '/v1/images/generations',
    payload: { model: 'image-model', prompt: 'an otter' },
  });
  expect(standalone.statusCode).toBe(200);
  expect(standalone.json().data[0].b64_json).toBe(png.toString('base64'));
  expect(standalone.json().data[0].nodex_file_id).toMatch(/^file_/);

  const response = await app.inject({
    method: 'POST',
    url: '/v1/responses',
    payload: {
      model: 'dev',
      input: 'draw an otter',
      tools: [{ type: 'image_generation' }],
    },
  });
  expect(response.statusCode).toBe(200);
  expect(response.json().output.at(-1)).toMatchObject({
    type: 'image_generation_call',
    status: 'completed',
  });
  expect(response.json().output.at(-1).nodex_file_id).toMatch(/^file_/);
  await app.close();
  store.close();
});
