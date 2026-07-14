import { expect, it } from 'vitest';
import { configSchema } from '../src/config.js';
import { ModelRegistry } from '../src/models/registry.js';
import { MockTransport } from '../src/transport/mock.js';

it('publishes stable public model records without private Notion bindings', () => {
  const config = configSchema.parse({
    transport: 'mock',
    models: {
      dev: {
        agentPageId: 'private-page',
        agentName: 'Developer',
        notionModel: 'private-notion-model',
        capabilities: { imageInput: true, fileInput: true },
      },
    },
  });
  const registry = new ModelRegistry(config, new MockTransport());
  const model = registry.get('dev');

  expect(model).toMatchObject({
    id: 'dev',
    object: 'model',
    owned_by: 'nodex:notion-agent',
    nodex: {
      kind: 'responses',
      capabilities: { textInput: true, textOutput: true, imageInput: true, fileInput: true },
    },
  });
  expect(JSON.stringify(model)).not.toContain('private-page');
  expect(JSON.stringify(model)).not.toContain('private-notion-model');
});

it('keeps provider model kinds separate and reports only enabled capability chains', () => {
  const config = configSchema.parse({
    transport: 'mock',
    models: {
      dev: {
        agentPageId: 'page',
        agentName: 'Developer',
        notionModel: 'notion-model',
        capabilities: { imageGeneration: true, imageEdit: true },
      },
    },
  });
  const registry = new ModelRegistry(config, new MockTransport(), {
    probe: () => ({
      available: true,
      models: [
        {
          id: 'image-public',
          providerModel: 'private-image-model',
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
  } as never);

  expect(registry.get('dev')?.nodex.capabilities).toMatchObject({
    imageGeneration: true,
    imageEdit: false,
  });
  expect(registry.get('image-public')?.nodex.kind).toBe('image');
  expect(JSON.stringify(registry.list())).not.toContain('private-image-model');
});
