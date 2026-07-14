import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, it } from 'vitest';
import { configSchema } from '../src/config.js';
import { FileStore } from '../src/files/store.js';
import { OpenAICompatibleImageProvider } from '../src/images/openai-compatible.js';
import type {
  ImageEditRequest,
  ImageGenerationRequest,
  ImageProvider,
} from '../src/images/provider.js';
import { ImageService } from '../src/images/service.js';
import { SessionStore } from '../src/session/store.js';

let directory = '';

afterEach(async () => {
  delete process.env['NODEX_TEST_IMAGE_KEY'];

  if (directory) {
    await rm(directory, { recursive: true, force: true });
    directory = '';
  }
});

it('does not advertise an enabled provider without its configured env key', () => {
  const config = configSchema.parse({
    images: {
      enabled: true,
      apiKeyEnv: 'NODEX_TEST_IMAGE_KEY',
      models: {
        image: {
          providerModel: 'real-provider-model',
          generation: true,
        },
      },
    },
  });

  const provider = new OpenAICompatibleImageProvider(config.images);

  expect(provider.probe()).toMatchObject({
    available: false,
    reason: 'missing_env:NODEX_TEST_IMAGE_KEY',
  });
});

it('stores real provider bytes through FileStore and reports progress', async () => {
  directory = await mkdtemp(join(tmpdir(), 'nodex-image-provider-'));

  const config = configSchema.parse({
    databasePath: join(directory, 'db.sqlite'),
    files: { root: join(directory, 'files') },
  });

  const provider: ImageProvider = {
    probe: () => ({
      available: true,
      models: [
        {
          id: 'image',
          providerModel: 'test-image-provider',
          generation: true,
          edit: false,
          sizes: ['auto'],
          qualities: ['auto'],
          outputFormats: ['png'],
          backgrounds: ['auto'],
          maxImages: 1,
        },
      ],
    }),

    async generate(_request: ImageGenerationRequest, options) {
      options.onProgress?.({ phase: 'generating', message: 'generating' });

      return [
        {
          bytes: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1]),
          mimeType: 'image/png',
          filename: 'generated.png',
        },
      ];
    },

    async edit(_request: ImageEditRequest) {
      return [];
    },
  };

  const store = new SessionStore(config.databasePath);

  try {
    const service = new ImageService(provider, new FileStore(config.files, store));
    const phases: string[] = [];

    const result = await service.generate(
      {
        model: 'image',
        prompt: 'test',
        n: 1,
        size: 'auto',
        quality: 'auto',
        background: 'auto',
        outputFormat: 'png',
      },
      {
        signal: new AbortController().signal,
        onProgress: (progress) => phases.push(progress.phase),
      },
    );

    expect(result[0]?.file.id).toMatch(/^file_/);
    expect(phases).toEqual(['generating', 'storing', 'completed']);
  } finally {
    store.close();
  }
});