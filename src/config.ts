import { readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { resolve } from 'node:path';
import { z } from 'zod';

const agentSchema = z
  .object({
    agentPageId: z.string().min(1),
    agentName: z.string().min(1),
    notionModel: z.string().min(1),
    notionModelSlug: z.string().min(1).optional(),
    syncNotionModel: z.boolean().default(true),
    capabilities: z
      .object({
        reasoningSummaries: z.boolean().default(true),
        functionCalling: z.boolean().default(true),
        imageInput: z.boolean().default(false),
        fileInput: z.boolean().default(false),
        imageGeneration: z.boolean().default(false),
        imageEdit: z.boolean().default(false),
      })
      .default({
        reasoningSummaries: true,
        functionCalling: true,
        imageInput: false,
        fileInput: false,
        imageGeneration: false,
        imageEdit: false,
      }),
  })
  .strict();

export const configSchema = z
  .object({
    server: z
      .object({
        host: z.string().default('127.0.0.1'),
        port: z.number().int().min(1).max(65_535).default(8787),
        corsOrigins: z.array(z.url()).max(32).default([]),
      })
      .default({ host: '127.0.0.1', port: 8787, corsOrigins: [] }),

    databasePath: z.string().default('.nodex/nodex.sqlite'),
    projectRoot: z.string().default('.'),
    models: z.record(z.string(), agentSchema).default({}),
    transport: z.enum(['notion', 'mock']).default('notion'),

    turnTimeoutMs: z.number().int().positive().default(300_000),
    keepAliveMs: z.number().int().positive().default(15_000),
    protocolRetries: z.number().int().min(0).max(5).default(2),
    toolOutputLimitBytes: z.number().int().positive().default(10_240),

    http: z
      .object({
        jsonBodyBytes: z.number().int().positive().default(2 * 1024 * 1024),
        maxInputItems: z.number().int().min(1).max(2_048).default(256),
        maxTools: z.number().int().min(1).max(512).default(128),
        maxMetadataKeys: z.number().int().min(1).max(16).default(16),
      })
      .default({
        jsonBodyBytes: 2 * 1024 * 1024,
        maxInputItems: 256,
        maxTools: 128,
        maxMetadataKeys: 16,
      }),

    retention: z
      .object({
        conversationsDays: z.number().int().min(0).default(0),
        responsesDays: z.number().int().min(0).default(30),
      })
      .default({ conversationsDays: 0, responsesDays: 30 }),

    conversation: z
      .object({
        maxBootstrapItems: z.number().int().min(20).max(1_000).default(100),
      })
      .default({ maxBootstrapItems: 100 }),

    files: z
      .object({
        root: z.string().min(1).default('~/.nodex/files'),
        maxBytes: z.number().int().positive().default(20 * 1024 * 1024),
        allowedPurposes: z
          .array(z.enum(['assistants', 'vision', 'user_data', 'batch']))
          .min(1)
          .default(['assistants', 'vision', 'user_data', 'batch']),
        retentionDays: z.number().int().min(0).default(0),
      })
      .default({
        root: '~/.nodex/files',
        maxBytes: 20 * 1024 * 1024,
        allowedPurposes: ['assistants', 'vision', 'user_data', 'batch'],
        retentionDays: 0,
      }),

    images: z
      .object({
        enabled: z.boolean().default(false),
        provider: z.literal('openai-compatible').default('openai-compatible'),
        baseUrl: z.url().default('https://api.example.invalid/v1'),
        apiKeyEnv: z.string().regex(/^[A-Z][A-Z0-9_]*$/).default('NODEX_IMAGE_API_KEY'),
        timeoutMs: z.number().int().positive().default(180_000),
        maxInputImages: z.number().int().min(1).max(16).default(8),
        maxInputBytes: z.number().int().positive().default(50 * 1024 * 1024),
        models: z
          .record(
            z.string(),
            z
              .object({
                providerModel: z.string().min(1),
                generation: z.boolean().default(true),
                edit: z.boolean().default(false),
                sizes: z.array(z.string().min(1)).min(1).default(['auto']),
                qualities: z.array(z.enum(['auto', 'low', 'medium', 'high'])).min(1).default(['auto']),
                outputFormats: z.array(z.enum(['png', 'jpeg', 'webp'])).min(1).default(['png']),
                backgrounds: z.array(z.enum(['auto', 'opaque', 'transparent'])).min(1).default(['auto']),
                maxImages: z.number().int().min(1).max(10).default(1),
              })
              .strict(),
          )
          .default({}),
      })
      .default({
        enabled: false,
        provider: 'openai-compatible',
        baseUrl: 'https://api.example.invalid/v1',
        apiKeyEnv: 'NODEX_IMAGE_API_KEY',
        timeoutMs: 180_000,
        maxInputImages: 8,
        maxInputBytes: 50 * 1024 * 1024,
        models: {},
      }),

    embeddings: z
      .object({
        enabled: z.boolean().default(false),
        provider: z.literal('openai-compatible').default('openai-compatible'),
        baseUrl: z.url().default('https://api.example.invalid/v1'),
        apiKeyEnv: z.string().regex(/^[A-Z][A-Z0-9_]*$/).default('NODEX_EMBEDDING_API_KEY'),
        timeoutMs: z.number().int().positive().default(60_000),
        maxInputCount: z.number().int().min(1).max(2_048).default(128),
        maxInputBytes: z.number().int().positive().default(1_048_576),
        models: z
          .record(
            z.string(),
            z
              .object({
                providerModel: z.string().min(1),
                tokenArrays: z.boolean().default(true),
                dimensions: z.array(z.number().int().positive()).max(64).default([]),
              })
              .strict(),
          )
          .default({}),
      })
      .default({
        enabled: false,
        provider: 'openai-compatible',
        baseUrl: 'https://api.example.invalid/v1',
        apiKeyEnv: 'NODEX_EMBEDDING_API_KEY',
        timeoutMs: 60_000,
        maxInputCount: 128,
        maxInputBytes: 1_048_576,
        models: {},
      }),

    envelope: z
      .object({
        maxDepth: z.number().int().min(0).default(3),
        maxEntries: z.number().int().positive().default(100),
        maxBytes: z.number().int().positive().default(8_192),
      })
      .default({ maxDepth: 3, maxEntries: 100, maxBytes: 8_192 }),

    verbose: z.boolean().default(false),

    auth: z
      .object({
        autoReauth: z.boolean().default(false),
      })
      .default({ autoReauth: false }),
  })
  .strict();

export type NodexConfig = z.infer<typeof configSchema>;

function resolveUserPath(path: string): string {
  if (path === '~') {
    return homedir();
  }

  if (path.startsWith('~/') || path.startsWith('~\\')) {
    return resolve(homedir(), path.slice(2));
  }

  return resolve(path);
}

export async function loadConfig(path = process.env['NODEX_CONFIG'] ?? 'nodex.config.json'): Promise<NodexConfig> {
  let raw: unknown = {};

  try {
    raw = JSON.parse(await readFile(resolve(path), 'utf8'));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw error;
    }
  }

  const parsed = configSchema.parse(raw);
  let models = parsed.models;

  if (process.env['NODEX_MODELS_JSON']) {
    const envConfig = configSchema.shape.models.safeParse(JSON.parse(process.env['NODEX_MODELS_JSON']));

    if (!envConfig.success) {
      throw new Error(`Invalid NODEX_MODELS_JSON: ${envConfig.error.message}`);
    }

    models = envConfig.data;
  }

  return configSchema.parse({
    ...parsed,
    server: {
      ...parsed.server,
      host: process.env['NODEX_HOST'] ?? parsed.server.host,
      port: process.env['NODEX_PORT'] ? Number(process.env['NODEX_PORT']) : parsed.server.port,
    },
    databasePath: resolve(process.env['NODEX_DATABASE_PATH'] ?? parsed.databasePath),
    projectRoot: resolve(process.env['NODEX_PROJECT_ROOT'] ?? parsed.projectRoot),
    files: {
      ...parsed.files,
      root: resolveUserPath(process.env['NODEX_FILES_ROOT'] ?? parsed.files.root),
    },
    models,
    verbose: process.env['NODEX_VERBOSE'] === '1' || parsed.verbose,
  });
}
