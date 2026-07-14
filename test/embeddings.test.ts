import { expect, it } from 'vitest';
import { configSchema } from '../src/config.js';
import { EmbeddingService, createEmbeddingService } from '../src/embeddings/service.js';
import type { EmbeddingProvider } from '../src/embeddings/provider.js';
import { embeddingRequestSchema } from '../src/openai/embeddings.js';

const provider: EmbeddingProvider = {
  probe: () => ({
    available: true,
    models: [
      {
        id: 'embed-public',
        providerModel: 'private-provider-model',
        tokenArrays: true,
        dimensions: [3],
      },
    ],
  }),
  create: async () => ({
    object: 'list',
    model: 'private-provider-model',
    data: [
      { object: 'embedding', embedding: [4, 5, 6], index: 1 },
      { object: 'embedding', embedding: [1, 2, 3], index: 0 },
    ],
    usage: { prompt_tokens: 7, total_tokens: 7 },
  }),
};

it('validates, orders, and returns real embedding provider data', async () => {
  const service = new EmbeddingService(provider, { maxInputCount: 4, maxInputBytes: 1_024 });
  const result = await service.create(
    {
      model: 'embed-public',
      input: ['first', 'second'],
      encodingFormat: 'float',
      dimensions: 3,
    },
    new AbortController().signal,
  );

  expect(result.model).toBe('embed-public');
  expect(result.data.map((item) => item.index)).toEqual([0, 1]);
  expect(result.data[0]?.embedding).toEqual([1, 2, 3]);
  expect(result.usage).toEqual({ prompt_tokens: 7, total_tokens: 7 });
});

it('accepts the official string and token-array request forms', () => {
  expect(embeddingRequestSchema.safeParse({ model: 'm', input: 'text' }).success).toBe(true);
  expect(embeddingRequestSchema.safeParse({ model: 'm', input: ['a', 'b'] }).success).toBe(true);
  expect(embeddingRequestSchema.safeParse({ model: 'm', input: [1, 2] }).success).toBe(true);
  expect(embeddingRequestSchema.safeParse({ model: 'm', input: [[1], [2]] }).success).toBe(true);
});

it('stays disabled without opt-in configuration and never self-proxies', () => {
  const disabled = configSchema.parse({});
  expect(createEmbeddingService(disabled)).toBeUndefined();

  process.env['NODEX_EMBEDDING_API_KEY'] = 'test-only';
  const selfProxy = configSchema.parse({
    server: { host: '127.0.0.1', port: 8787 },
    embeddings: {
      enabled: true,
      baseUrl: 'http://127.0.0.1:8787/v1',
      models: {
        embedding: { providerModel: 'provider-model' },
      },
    },
  });
  expect(createEmbeddingService(selfProxy)).toBeUndefined();
  delete process.env['NODEX_EMBEDDING_API_KEY'];
});
