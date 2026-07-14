import { createHash, randomUUID, timingSafeEqual } from 'node:crypto';
import type { IncomingHttpHeaders } from 'node:http';
import { resolve } from 'node:path';
import multipart from '@fastify/multipart';
import Fastify, {
  type FastifyBaseLogger,
  type FastifyInstance,
  type FastifyReply,
  type FastifyRequest,
} from 'fastify';
import type { LoggerOptions } from 'pino';
import type { NodexConfig } from './config.js';
import {
  NodexCore,
  responseContextOutputItems,
  type RunResult,
} from './core.js';
import { EmbeddingProviderError } from './embeddings/provider.js';
import { createEmbeddingService, type EmbeddingService } from './embeddings/service.js';
import { NodexError } from './errors.js';
import { FileStore } from './files/store.js';
import { apiErrorBody, normalizeApiError, sendApiError } from './http/errors.js';
import { ImageProviderError, type ImageInput } from './images/provider.js';
import { createImageService, type ImageService } from './images/service.js';
import { ModelRegistry } from './models/registry.js';
import {
  normalizeChatRequest,
  normalizeResponseItems,
  normalizeResponseRequest,
} from './openai/adapters.js';
import { conversationItemObject, conversationObject } from './openai/conversation-mapper.js';
import {
  conversationCreateSchema,
  conversationItemsCreateSchema,
  conversationItemsQuerySchema,
  conversationUpdateSchema,
} from './openai/conversations.js';
import { mapChunks, mapCompletion, mapResponse } from './openai/mapper.js';
import { tryLocalMetaCompletion } from './openai/meta.js';
import { ResponsesStreamMapper } from './openai/response-stream.js';
import { responseRequestSchema } from './openai/responses.js';
import { imageEditFieldsSchema, imageGenerationRequestSchema } from './openai/images.js';
import { embeddingRequestSchema } from './openai/embeddings.js';
import { chatRequestSchema } from './openai/types.js';
import { SessionStore } from './session/store.js';
import type { StoredFileRecord, StoredResponseRecord } from './session/store.js';
import type { NotionTransport } from './transport/types.js';
import type { CoreTurnEvent, NormalizedTurn, TurnInputItem } from './turn/types.js';

type RunOutcome = { kind: 'result'; result: RunResult } | { kind: 'error'; error: unknown };

function errorBody(error: unknown, requestId?: string) {
  return apiErrorBody(error, requestId);
}

function notFoundBody(resource: string, id: string) {
  return apiErrorBody(new NodexError('not_found', `${resource} not found: ${id}`));
}

function fileObject(file: StoredFileRecord) {
  return {
    id: file.id,
    object: 'file',
    bytes: file.bytes,
    created_at: file.createdAt,
    expires_at: file.expiresAt ?? null,
    filename: file.filename,
    purpose: file.purpose,
    status: 'processed',
    status_details: null,
  };
}

async function imageInputFromFile(files: FileStore, fileId: string): Promise<ImageInput> {
  const content = await files.openContent(fileId);
  const chunks: Buffer[] = [];

  for await (const chunk of content.stream as AsyncIterable<Uint8Array>) {
    chunks.push(Buffer.from(chunk));
  }

  return {
    filename: content.file.filename,
    mimeType: content.file.mimeType,
    bytes: Buffer.concat(chunks),
  };
}

function sse(reply: FastifyReply, data: unknown): void {
  reply.raw.write(`data: ${JSON.stringify(data)}\n\n`);
}

function headerString(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return typeof value === 'string' && value.trim() ? value : undefined;
}

function shortHash(value: string): string {
  return createHash('sha256').update(value).digest('hex').slice(0, 12);
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableJson(item)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

function responseFingerprint(value: unknown): string {
  return createHash('sha256').update(stableJson(value)).digest('hex');
}

function authorized(header: string | undefined, key: string): boolean {
  if (!header) return false;
  const expected = createHash('sha256').update(`Bearer ${key}`).digest();
  const actual = createHash('sha256').update(header).digest();
  return timingSafeEqual(expected, actual);
}

function responseState(record: StoredResponseRecord): unknown {
  if (record.response !== undefined) return record.response;
  return {
    id: record.responseId,
    object: 'response',
    created_at: record.createdAt,
    status: record.status,
    background: record.background,
    error: record.error ?? null,
    incomplete_details: record.status === 'cancelled' ? { reason: 'cancelled' } : null,
    model: record.model,
    conversation: record.conversationId ? { id: record.conversationId } : null,
    output: [],
    store: record.storeFull,
  };
}

function inputItemObject(item: unknown, index: number): unknown {
  const value = item as TurnInputItem;
  if (value.type === 'message') {
    return {
      id: value.id ?? `input_${index}`,
      type: 'message',
      role: value.role,
      status: value.status ?? 'completed',
      ...(value.phase ? { phase: value.phase } : {}),
      content: value.content.map((part) => {
        if (part.type === 'text') return { type: 'input_text', text: part.text };
        if (part.type === 'image') {
          return {
            type: 'input_image',
            ...(part.fileId ? { file_id: part.fileId } : {}),
            ...(part.url ? { image_url: part.url } : {}),
            detail: part.detail,
          };
        }
        return {
          type: 'input_file',
          ...(part.fileId ? { file_id: part.fileId } : {}),
          ...(part.filename ? { filename: part.filename } : {}),
          ...(part.data ? { file_data: part.data } : {}),
        };
      }),
    };
  }
  if (value.type === 'function_call') {
    return {
      id: value.id ?? `input_${index}`,
      type: 'function_call',
      call_id: value.callId,
      name: value.name,
      arguments: value.arguments,
      status: value.status ?? 'completed',
    };
  }
  if (value.type === 'custom_tool_call') {
    return {
      id: value.id ?? `input_${index}`,
      type: 'custom_tool_call',
      call_id: value.callId,
      name: value.name,
      input: value.input,
      status: value.status ?? 'completed',
    };
  }
  if (value.type === 'function_call_output') {
    return {
      id: value.id ?? `input_${index}`,
      type: 'function_call_output',
      call_id: value.callId,
      output: value.output,
    };
  }
  if (value.type === 'custom_tool_call_output') {
    return {
      id: value.id ?? `input_${index}`,
      type: 'custom_tool_call_output',
      call_id: value.callId,
      output: value.output,
    };
  }
  return {
    id: value.id,
    type: 'image_generation_call',
    ...(value.fileId ? { nodex_file_id: value.fileId } : {}),
  };
}

function referencedFileIds(items: TurnInputItem[]): string[] {
  return items.flatMap((item) => {
    if (item.type === 'image_generation_call') return item.fileId ? [item.fileId] : [];
    if (item.type !== 'message') return [];
    return item.content.flatMap((part) => part.type !== 'text' && part.fileId ? [part.fileId] : []);
  });
}

function requestLimitError(
  config: NodexConfig,
  values: { inputItems?: number; tools?: number; metadataKeys?: number },
): NodexError | undefined {
  if ((values.inputItems ?? 0) > config.http.maxInputItems) {
    return new NodexError(
      'invalid_request',
      `Input contains more than ${config.http.maxInputItems} items`,
    );
  }
  if ((values.tools ?? 0) > config.http.maxTools) {
    return new NodexError('invalid_request', `Tools contain more than ${config.http.maxTools} items`);
  }
  if ((values.metadataKeys ?? 0) > config.http.maxMetadataKeys) {
    return new NodexError(
      'invalid_request',
      `Metadata contains more than ${config.http.maxMetadataKeys} keys`,
    );
  }
  return undefined;
}

function requestWorkspaceRoot(headers: IncomingHttpHeaders): string | undefined {
  const value =
    headerString(headers['x-nodex-workspace-cwd']) ??
    headerString(headers['x-codex-workspace-cwd']) ??
    headerString(headers['x-workspace-cwd']);

  return value ? resolve(value) : undefined;
}

function scopedSessionId(
  headers: IncomingHttpHeaders,
  workspaceRoot: string | undefined,
): string | undefined {
  const sessionId = headerString(headers['x-nodex-session-id']);
  if (!sessionId) return undefined;

  const scope = workspaceRoot ? shortHash(workspaceRoot) : 'runtime';

  return `${scope}:${sessionId}`;
}

function scopedPromptCacheSessionId(
  promptCacheKey: string,
  workspaceRoot: string | undefined,
): string {
  const scope = workspaceRoot ? shortHash(workspaceRoot) : 'runtime';
  const key = createHash('sha256').update(promptCacheKey).digest('hex');

  return `${scope}:prompt:${key}`;
}

export function serverLoggerOptions(config: NodexConfig): LoggerOptions {
  return {
    level: config.verbose ? 'debug' : 'info',
    redact: {
      paths: [
        'req.headers.authorization',
        'req.headers.cookie',
        'headers.authorization',
        'headers.cookie',
        '*.token_v2',
        '*.notion_browser_id',
        '*.agentPageId',
        '*.apiKey',
        '*.b64_json',
        '*.base64',
        '*.prompt',
        '*.input',
        '*.output',
        '*.raw',
      ],
      censor: '[REDACTED]',
    },
  };
}

export function buildServer(
  config: NodexConfig,
  store: SessionStore,
  transport: NotionTransport,
  services: {
    imageService?: ImageService;
    embeddingService?: EmbeddingService;
    logger?: FastifyBaseLogger;
  } = {},
): FastifyInstance {
  const app = Fastify({
    bodyLimit: config.http.jsonBodyBytes,
    genReqId: (incoming) => {
      const supplied = headerString(incoming.headers['x-request-id']);
      return supplied && /^[A-Za-z0-9._:-]{1,128}$/.test(supplied)
        ? supplied
        : `req_${randomUUID().replaceAll('-', '')}`;
    },
    ...(services.logger
      ? { loggerInstance: services.logger }
      : { logger: serverLoggerOptions(config) }),
  });

  const files = new FileStore(config.files, store);
  const images = services.imageService ?? createImageService(config, files);
  const embeddings = services.embeddingService ?? createEmbeddingService(config);
  const models = new ModelRegistry(config, transport, images, embeddings);
  const core = new NodexCore(config, store, transport, app.log, files, images);
  const activeResponses = new Map<string, AbortController>();
  // Read once at startup so authentication cannot change mid-request when the
  // parent process mutates its environment (for example, in an embedded server).
  const localApiKey = process.env['NODEX_API_KEY'];

  const executeStoredResponse = async (args: {
    record: StoredResponseRecord;
    request: NormalizedTurn;
    requestInputOffset: number;
    sessionId?: string;
    workspaceRoot?: string;
    controller: AbortController;
    requestId: string;
  }): Promise<unknown> => {
    store.markResponseInProgress(args.record.responseId);
    activeResponses.set(args.record.responseId, args.controller);
    try {
      const result = await core.run(
        args.request,
        args.sessionId,
        args.controller.signal,
        args.workspaceRoot,
        {
          responseId: args.record.responseId,
          createdAt: args.record.createdAt,
          requestId: args.requestId,
        },
      );
      const response = mapResponse(result, args.request);
      const output = responseContextOutputItems(
        result.events.at(-1),
        result.responseId,
        result.images,
      );
      const context = [...args.request.input, ...output];
      store.completeResponse(
        args.record.responseId,
        response,
        args.request.input.slice(args.requestInputOffset),
        context,
        referencedFileIds(context),
      );
      return response;
    } catch (error) {
      const current = store.getResponse(args.record.responseId, false);
      if (args.controller.signal.aborted || current?.status === 'cancelled') {
        store.cancelResponse(args.record.responseId);
      } else {
        store.failResponse(args.record.responseId, errorBody(error, args.requestId).error);
      }
      throw error;
    } finally {
      activeResponses.delete(args.record.responseId);
    }
  };

  app.register(multipart, {
    limits: {
      files: config.images.maxInputImages + 1,
      fileSize: config.files.maxBytes,
      fields: 8,
      parts: 10,
    },
  });

  app.addHook('onReady', async () => {
    await files.initialize();
    store.cleanupResponses(config.retention.responsesDays);
  });

  app.addHook('onRequest', async (request, reply) => {
    reply.header('x-request-id', request.id);
    const origin = headerString(request.headers.origin);
    if (origin) {
      if (!config.server.corsOrigins.includes(origin)) {
        await sendApiError(
          reply,
          new NodexError('forbidden', 'Cross-origin request is not allowed'),
          request.id,
        );
        return;
      }
      reply
        .header('access-control-allow-origin', origin)
        .header('vary', 'origin')
        .header('access-control-allow-headers', 'authorization, content-type, idempotency-key, x-request-id')
        .header('access-control-allow-methods', 'GET, POST, PATCH, DELETE, OPTIONS');
      if (request.method === 'OPTIONS') {
        await reply.code(204).send();
        return;
      }
    }

    if (!request.url.startsWith('/v1/')) return;

    if (localApiKey && !authorized(request.headers.authorization, localApiKey)) {
      await sendApiError(reply, new NodexError('auth', 'Invalid local API key'), request.id);
    }
  });

  app.setErrorHandler((error, request, reply) => {
    const mapped = normalizeApiError(error, request.id);
    request.log.warn(mapped.log, 'Nodex request failed');
    return sendApiError(reply, error, request.id);
  });

  app.addHook('onClose', async () => {
    for (const controller of activeResponses.values()) controller.abort();
    await core.close();
  });

  app.get('/healthz', async (request, reply) => {
    let notion: unknown = 'skipped';

    if ((request.query as { deep?: string }).deep === '1') {
      try {
        await transport.preflight();
        notion = { status: 'ok' };
      } catch (error) {
        return reply.code(503).send({
          ok: false,
          sqlite: store.check(),
          notion: errorBody(error, request.id).error,
        });
      }
    }

    return {
      ok: true,
      sqlite: store.check(),
      models: models.summary(),
      notion,
    };
  });

  app.get('/v1/models', async () => {
    return {
      object: 'list',
      data: models.list(),
      // Codex custom providers decode this endpoint as { models: ModelInfo[] }, while
      // OpenAI-compatible clients expect { object: 'list', data: Model[] }. Keep the
      // Codex catalog empty so the client retains its bundled model/tool metadata and
      // Nodex does not inject client persona or base instructions.
      models: [],
    };
  });

  app.get('/v1/models/:modelId', async (request, reply) => {
    const { modelId } = request.params as { modelId: string };
    const model = models.get(modelId);
    return model ?? reply.code(404).send(notFoundBody('Model', modelId));
  });

  app.post('/v1/embeddings', async (request, reply) => {
    const parsed = embeddingRequestSchema.safeParse(request.body);
    if (!parsed.success) return sendApiError(reply, parsed.error, request.id);
    if (!embeddings) {
      return sendApiError(
        reply,
        new EmbeddingProviderError('disabled', 'Embedding provider is unavailable'),
        request.id,
      );
    }
    const controller = new AbortController();
    request.raw.once('aborted', () => controller.abort());
    try {
      return await embeddings.create(
        {
          model: parsed.data.model,
          input: parsed.data.input,
          encodingFormat: parsed.data.encoding_format,
          ...(parsed.data.dimensions === undefined ? {} : { dimensions: parsed.data.dimensions }),
          ...(parsed.data.user === undefined ? {} : { user: parsed.data.user }),
        },
        controller.signal,
        request.id,
      );
    } catch (error) {
      return sendApiError(reply, error, request.id);
    }
  });

  app.post('/v1/files', async (request, reply) => {
    try {
      const part = await request.file({ limits: { files: 1, fileSize: config.files.maxBytes } });
      if (!part) {
        return await reply.code(400).send(
          errorBody(new NodexError('invalid_request', 'Multipart field file is required'), request.id),
        );
      }
      const purposeField = part.fields['purpose'] as { value?: unknown } | undefined;
      const purpose = purposeField?.value;
      if (typeof purpose !== 'string' || !purpose) {
        part.file.resume();
        return await reply.code(400).send(
          errorBody(
            new NodexError(
              'invalid_request',
              'Multipart field purpose must appear before file and contain a string',
            ),
            request.id,
          ),
        );
      }
      const stored = await files.upload(part.file, {
        filename: part.filename,
        purpose,
        mimeType: part.mimetype,
      });
      if (part.file.truncated) {
        await files.delete(stored.id);
        throw new NodexError('invalid_request', `File exceeds ${config.files.maxBytes} byte limit`);
      }
      return fileObject(stored);
    } catch (error) {
      return sendApiError(reply, error, request.id);
    }
  });

  app.get('/v1/files', async (request) => {
    const query = request.query as { limit?: string; after?: string };
    const limit = query.limit ? Number(query.limit) : 20;
    const data = files.list(Number.isInteger(limit) ? limit : 20, query.after).map(fileObject);
    return {
      object: 'list',
      data,
      first_id: data[0]?.id ?? null,
      last_id: data.at(-1)?.id ?? null,
      has_more: data.length === Math.min(Math.max(limit, 1), 100),
    };
  });

  app.get('/v1/files/:fileId', async (request, reply) => {
    const { fileId } = request.params as { fileId: string };
    const file = files.get(fileId);
    return file ? fileObject(file) : reply.code(404).send(notFoundBody('File', fileId));
  });

  app.get('/v1/files/:fileId/content', async (request, reply) => {
    const { fileId } = request.params as { fileId: string };
    try {
      const content = await files.openContent(fileId);
      return await reply
        .header('content-type', content.file.mimeType)
        .header('content-length', content.file.bytes)
        .header(
          'content-disposition',
          `attachment; filename*=UTF-8''${encodeURIComponent(content.file.filename)}`,
        )
        .send(content.stream);
    } catch {
      return reply.code(404).send(notFoundBody('File', fileId));
    }
  });

  app.delete('/v1/files/:fileId', async (request, reply) => {
    const { fileId } = request.params as { fileId: string };
    return (await files.delete(fileId))
      ? { id: fileId, object: 'file', deleted: true }
      : reply.code(404).send(notFoundBody('File', fileId));
  });

  app.post('/v1/images/generations', async (request, reply) => {
    const parsed = imageGenerationRequestSchema.safeParse(request.body);
    if (!parsed.success) return sendApiError(reply, parsed.error, request.id);
    if (!images) {
      return sendApiError(
        reply,
        new ImageProviderError('disabled', 'Image provider is unavailable'),
        request.id,
      );
    }
    const controller = new AbortController();
    request.raw.once('aborted', () => controller.abort());
    try {
      const result = await images.generate(
        {
          model: parsed.data.model,
          prompt: parsed.data.prompt,
          n: parsed.data.n,
          size: parsed.data.size,
          quality: parsed.data.quality,
          background: parsed.data.background,
          outputFormat: parsed.data.output_format,
          ...(parsed.data.output_compression === undefined
            ? {}
            : { outputCompression: parsed.data.output_compression }),
        },
        { signal: controller.signal, requestId: request.id },
      );
      return {
        created: Math.floor(Date.now() / 1000),
        data: result.map(({ artifact, file }) => ({
          b64_json: Buffer.from(artifact.bytes).toString('base64'),
          ...(artifact.revisedPrompt ? { revised_prompt: artifact.revisedPrompt } : {}),
          nodex_file_id: file.id,
        })),
      };
    } catch (error) {
      return sendApiError(reply, error, request.id);
    }
  });

  app.post('/v1/images/edits', async (request, reply) => {
    if (!images) {
      return sendApiError(
        reply,
        new ImageProviderError('disabled', 'Image provider is unavailable'),
        request.id,
      );
    }
    const controller = new AbortController();
    request.raw.once('aborted', () => controller.abort());
    const fields: Record<string, unknown> = {};
    const imageFiles: string[] = [];
    let maskFile: string | undefined;
    const temporaryFiles: string[] = [];
    try {
      for await (const part of request.parts()) {
        if (part.type === 'field') {
          fields[part.fieldname] = part.value;
          continue;
        }
        if (!['image', 'image[]', 'mask'].includes(part.fieldname)) {
          part.file.resume();
          throw new ImageProviderError('invalid_request', `Unsupported multipart file field: ${part.fieldname}`);
        }
        const stored = await files.upload(part.file, {
          filename: part.filename,
          purpose: 'user_data',
          mimeType: part.mimetype,
        });
        temporaryFiles.push(stored.id);
        if (part.fieldname === 'mask') maskFile = stored.id;
        else imageFiles.push(stored.id);
      }
      const parsed = imageEditFieldsSchema.safeParse(fields);
      if (!parsed.success) throw new ImageProviderError('invalid_request', parsed.error.message);
      if (!imageFiles.length) throw new ImageProviderError('invalid_request', 'At least one image is required');
      const inputs = await Promise.all(imageFiles.map((fileId) => imageInputFromFile(files, fileId)));
      const mask = maskFile ? await imageInputFromFile(files, maskFile) : undefined;
      const result = await images.edit(
        {
          model: parsed.data.model,
          prompt: parsed.data.prompt,
          n: parsed.data.n,
          size: parsed.data.size,
          quality: parsed.data.quality,
          background: parsed.data.background,
          outputFormat: parsed.data.output_format,
          ...(parsed.data.output_compression === undefined
            ? {}
            : { outputCompression: parsed.data.output_compression }),
          images: inputs,
          ...(mask ? { mask } : {}),
        },
        { signal: controller.signal, requestId: request.id },
      );
      return {
        created: Math.floor(Date.now() / 1000),
        data: result.map(({ artifact, file }) => ({
          b64_json: Buffer.from(artifact.bytes).toString('base64'),
          ...(artifact.revisedPrompt ? { revised_prompt: artifact.revisedPrompt } : {}),
          nodex_file_id: file.id,
        })),
      };
    } catch (error) {
      return await sendApiError(reply, error, request.id);
    } finally {
      await Promise.all(temporaryFiles.map((fileId) => files.delete(fileId).catch(() => false)));
    }
  });

  app.post('/v1/conversations', async (request, reply) => {
    const parsed = conversationCreateSchema.safeParse(request.body ?? {});
    if (!parsed.success) return sendApiError(reply, parsed.error, request.id);
    const limit = requestLimitError(config, {
      inputItems: parsed.data.items.length,
      metadataKeys: Object.keys(parsed.data.metadata).length,
    });
    if (limit) return sendApiError(reply, limit, request.id);
    const items = normalizeResponseItems(parsed.data.items);
    return conversationObject(store.createConversation(parsed.data.metadata, items));
  });

  app.get('/v1/conversations/:conversationId', async (request, reply) => {
    const { conversationId } = request.params as { conversationId: string };
    const conversation = store.getConversation(conversationId);
    return conversation
      ? conversationObject(conversation)
      : reply.code(404).send(notFoundBody('Conversation', conversationId));
  });

  const updateConversationHandler = async (
    request: FastifyRequest,
    reply: FastifyReply,
  ) => {
    const { conversationId } = request.params as { conversationId: string };
    const parsed = conversationUpdateSchema.safeParse(request.body);
    if (!parsed.success) return sendApiError(reply, parsed.error, request.id);
    const limit = requestLimitError(config, {
      metadataKeys: Object.keys(parsed.data.metadata).length,
    });
    if (limit) return sendApiError(reply, limit, request.id);
    const conversation = store.updateConversation(conversationId, parsed.data.metadata);
    return conversation
      ? conversationObject(conversation)
      : reply.code(404).send(notFoundBody('Conversation', conversationId));
  };

  app.post('/v1/conversations/:conversationId', updateConversationHandler);
  app.patch('/v1/conversations/:conversationId', updateConversationHandler);

  app.delete('/v1/conversations/:conversationId', async (request, reply) => {
    const { conversationId } = request.params as { conversationId: string };
    return store.deleteConversation(conversationId)
      ? { id: conversationId, object: 'conversation.deleted', deleted: true }
      : reply.code(404).send(notFoundBody('Conversation', conversationId));
  });

  app.post('/v1/conversations/:conversationId/items', async (request, reply) => {
    const { conversationId } = request.params as { conversationId: string };
    if (!store.getConversation(conversationId)) {
      return reply.code(404).send(notFoundBody('Conversation', conversationId));
    }
    const parsed = conversationItemsCreateSchema.safeParse(request.body);
    if (!parsed.success) return sendApiError(reply, parsed.error, request.id);
    const limit = requestLimitError(config, { inputItems: parsed.data.items.length });
    if (limit) return sendApiError(reply, limit, request.id);
    const items = store.appendConversationItems(
      conversationId,
      normalizeResponseItems(parsed.data.items),
    );
    return {
      object: 'list',
      data: items.map(conversationItemObject),
      first_id: items[0]?.id ?? null,
      last_id: items.at(-1)?.id ?? null,
      has_more: false,
    };
  });

  app.get('/v1/conversations/:conversationId/items', async (request, reply) => {
    const { conversationId } = request.params as { conversationId: string };
    if (!store.getConversation(conversationId)) {
      return reply.code(404).send(notFoundBody('Conversation', conversationId));
    }
    const parsed = conversationItemsQuerySchema.safeParse(request.query);
    if (!parsed.success) return sendApiError(reply, parsed.error, request.id);
    const listOptions = {
      limit: parsed.data.limit,
      order: parsed.data.order,
      ...(parsed.data.after === undefined ? {} : { after: parsed.data.after }),
    };

    const page = store.listConversationItems(conversationId, listOptions);
    return {
      object: 'list',
      data: page.data.map(conversationItemObject),
      first_id: page.firstId ?? null,
      last_id: page.lastId ?? null,
      has_more: page.hasMore,
    };
  });

  app.get('/v1/conversations/:conversationId/items/:itemId', async (request, reply) => {
    const { conversationId, itemId } = request.params as {
      conversationId: string;
      itemId: string;
    };
    const item = store.getConversationItem(conversationId, itemId);
    return item
      ? conversationItemObject(item)
      : reply.code(404).send(notFoundBody('Conversation item', itemId));
  });

  app.delete('/v1/conversations/:conversationId/items/:itemId', async (request, reply) => {
    const { conversationId, itemId } = request.params as {
      conversationId: string;
      itemId: string;
    };
    return store.deleteConversationItem(conversationId, itemId)
      ? { id: itemId, object: 'conversation.item.deleted', deleted: true }
      : reply.code(404).send(notFoundBody('Conversation item', itemId));
  });

  app.get('/v1/responses/:responseId', async (request, reply) => {
    const { responseId } = request.params as { responseId: string };
    const response = store.getResponse(responseId);
    return response
      ? responseState(response)
      : reply.code(404).send(notFoundBody('Response', responseId));
  });

  app.delete('/v1/responses/:responseId', async (request, reply) => {
    const { responseId } = request.params as { responseId: string };
    const response = store.getResponse(responseId);
    if (!response) return reply.code(404).send(notFoundBody('Response', responseId));
    if (response.status === 'queued' || response.status === 'in_progress') {
      return reply.code(409).send(
        errorBody(
          new NodexError('conflict', 'Cancel a running response before deleting it'),
          request.id,
        ),
      );
    }
    return store.deleteResponse(responseId)
      ? { id: responseId, object: 'response.deleted', deleted: true }
      : reply.code(404).send(notFoundBody('Response', responseId));
  });

  app.get('/v1/responses/:responseId/input_items', async (request, reply) => {
    const { responseId } = request.params as { responseId: string };
    const response = store.getResponse(responseId);
    if (!response) return reply.code(404).send(notFoundBody('Response', responseId));
    const data = response.input.map(inputItemObject);
    return {
      object: 'list',
      data,
      first_id: (data[0] as { id?: string } | undefined)?.id ?? null,
      last_id: (data.at(-1) as { id?: string } | undefined)?.id ?? null,
      has_more: false,
    };
  });

  app.post('/v1/responses/:responseId/cancel', async (request, reply) => {
    const { responseId } = request.params as { responseId: string };
    const before = store.getResponse(responseId, false);
    if (!before) return reply.code(404).send(notFoundBody('Response', responseId));
    const response = store.cancelResponse(responseId);
    if ((before.status === 'queued' || before.status === 'in_progress') && response?.status === 'cancelled') {
      activeResponses.get(responseId)?.abort();
    }
    return response ? responseState(response) : reply.code(404).send(notFoundBody('Response', responseId));
  });

  app.post('/v1/responses', async (request, reply) => {
    const parsed = responseRequestSchema.safeParse(request.body);

    if (!parsed.success) {
      return sendApiError(reply, parsed.error, request.id);
    }
    const normalized = normalizeResponseRequest(parsed.data);
    const responseLimit = requestLimitError(config, {
      inputItems: normalized.input.length,
      tools: normalized.tools.length,
      metadataKeys: Object.keys(parsed.data.metadata).length,
    });
    if (responseLimit) return sendApiError(reply, responseLimit, request.id);

    const knownFields = new Set([
      'model',
      'input',
      'instructions',
      'stream',
      'metadata',
      'store',
      'previous_response_id',
      'conversation',
      'prompt_cache_key',
      'tools',
      'tool_choice',
      'parallel_tool_calls',
      'reasoning',
      'model_reasoning_summary',
      'model_supports_reasoning_summaries',
      'background',
    ]);
    const ignoredFields = Object.keys(parsed.data).filter((field) => !knownFields.has(field));

    if (ignoredFields.length) {
      request.log.debug({ ignoredFields }, 'Ignored Responses request fields');
    }

    if (parsed.data.background && parsed.data.stream) {
      return reply.code(400).send(
        errorBody(
          new NodexError(
            'invalid_request',
            'Nodex supports background responses only with stream=false',
          ),
          request.id,
        ),
      );
    }
    if (!config.models[parsed.data.model]) {
      return reply.code(400).send(
        errorBody(
          new NodexError('invalid_request', `Unknown model: ${parsed.data.model}`),
          request.id,
        ),
      );
    }

    const workspaceRoot = requestWorkspaceRoot(request.headers);
    let sessionId = scopedSessionId(request.headers, workspaceRoot)
      ?? (parsed.data.prompt_cache_key
        ? scopedPromptCacheSessionId(parsed.data.prompt_cache_key, workspaceRoot)
        : undefined);
    let requestInputOffset = 0;

    if (parsed.data.previous_response_id) {
      const previous = store.getResponse(parsed.data.previous_response_id);
      if (!previous || previous.status !== 'completed') {
        return reply.code(400).send(
          errorBody(
            new NodexError(
              'invalid_request',
              `previous_response_id is unavailable: ${parsed.data.previous_response_id}`,
            ),
            request.id,
          ),
        );
      }
      if (previous.model !== parsed.data.model) {
        return reply.code(400).send(
          errorBody(
            new NodexError(
              'invalid_request',
              'previous_response_id must use the same model binding',
            ),
            request.id,
          ),
        );
      }
      requestInputOffset = previous.context.length;
      normalized.input = [
        ...(previous.context as TurnInputItem[]),
        ...normalized.input,
      ];
      sessionId ??= `previous:${previous.responseId}`;
    }

    const idempotencyKey = headerString(request.headers['idempotency-key']);
    if (idempotencyKey && idempotencyKey.length > 255) {
      return reply.code(400).send(
        errorBody(
          new NodexError('invalid_request', 'Idempotency-Key exceeds 255 characters'),
          request.id,
        ),
      );
    }
    const fingerprint = responseFingerprint({
      body: parsed.data,
      sessionId: sessionId ?? null,
      workspaceRoot: workspaceRoot ?? null,
    });
    const reservation = store.reserveResponse({
      responseId: `resp_${randomUUID().replaceAll('-', '')}`,
      ...(idempotencyKey ? { idempotencyKey } : {}),
      fingerprint,
      ...(normalized.conversationId ? { conversationId: normalized.conversationId } : {}),
      model: normalized.model,
      agentBinding: normalized.model,
      storeFull: normalized.store,
      background: parsed.data.background,
      input: normalized.input.slice(requestInputOffset),
    });

    if (!reservation.created) {
      if (reservation.record.fingerprint !== fingerprint) {
        return reply.code(409).send(
          errorBody(
            new NodexError('conflict', 'Idempotency-Key was already used with another request'),
            request.id,
          ),
        );
      }
      return reply
        .code(['queued', 'in_progress'].includes(reservation.record.status) ? 202 : 200)
        .send(responseState(reservation.record));
    }

    const controller = new AbortController();
    request.raw.once('aborted', () => controller.abort());

    if (!parsed.data.stream) {
      const work = executeStoredResponse({
        record: reservation.record,
        request: normalized,
        requestInputOffset,
        ...(sessionId ? { sessionId } : {}),
        ...(workspaceRoot ? { workspaceRoot } : {}),
        controller,
        requestId: request.id,
      });
      if (parsed.data.background) {
        void work.catch(() => undefined);
        const response = store.getResponse(reservation.record.responseId, false) ?? reservation.record;
        return reply.code(202).send(responseState(response));
      }
      try {
        return await work;
      } catch (error) {
        return sendApiError(reply, error, request.id);
      }
    }

    store.markResponseInProgress(reservation.record.responseId);
    activeResponses.set(reservation.record.responseId, controller);
    const mapper = new ResponsesStreamMapper(normalized);
    const stream = core.stream(
      normalized,
      sessionId,
      controller.signal,
      workspaceRoot,
      {
        responseId: reservation.record.responseId,
        createdAt: reservation.record.createdAt,
        requestId: request.id,
      },
    );
    const iterator = stream[Symbol.asyncIterator]();
    let first: IteratorResult<CoreTurnEvent>;

    try {
      first = await iterator.next();
    } catch (error) {
      if (controller.signal.aborted) {
        store.cancelResponse(reservation.record.responseId);
      } else {
        store.failResponse(reservation.record.responseId, errorBody(error, request.id).error);
      }
      activeResponses.delete(reservation.record.responseId);
      return sendApiError(reply, error, request.id);
    }

    if (first.done) {
      store.failResponse(
        reservation.record.responseId,
        errorBody(
          new NodexError('upstream_protocol', 'Responses stream ended early'),
          request.id,
        ).error,
      );
      activeResponses.delete(reservation.record.responseId);
      return reply
        .code(502)
        .send(
          errorBody(
            new NodexError('upstream_protocol', 'Responses stream ended early'),
            request.id,
          ),
        );
    }

    reply.hijack();
    const origin = headerString(request.headers.origin);

    reply.raw.writeHead(200, {
      'content-type': 'text/event-stream; charset=utf-8',
      'cache-control': 'no-cache',
      connection: 'keep-alive',
      'x-accel-buffering': 'no',
      'x-request-id': request.id,
      ...(origin ? { 'access-control-allow-origin': origin, vary: 'origin' } : {}),
    });

    reply.raw.once('close', () => controller.abort());
    const write = (events: unknown[]): void => {
      for (const event of events) sse(reply, event);
    };
    const ping = setInterval(() => reply.raw.write(': ping\n\n'), config.keepAliveMs);
    const persist = (event: CoreTurnEvent): void => {
      if (event.type !== 'response_done') return;
      const response = mapResponse(event.result, normalized);
      const output = responseContextOutputItems(
        event.result.events.at(-1),
        event.result.responseId,
        event.result.images,
      );
      const context = [...normalized.input, ...output];
      store.completeResponse(
        reservation.record.responseId,
        response,
        normalized.input.slice(requestInputOffset),
        context,
        referencedFileIds(context),
      );
    };

    try {
      persist(first.value);
      write(mapper.map(first.value));

      for (;;) {
        const next = await iterator.next();
        if (next.done) break;
        persist(next.value);
        write(mapper.map(next.value));
      }
    } catch (error) {
      const current = store.getResponse(reservation.record.responseId, false);
      if (controller.signal.aborted || current?.status === 'cancelled') {
        store.cancelResponse(reservation.record.responseId);
      } else {
        store.failResponse(reservation.record.responseId, errorBody(error, request.id).error);
        if (!reply.raw.destroyed) write(mapper.fail(error, request.id));
      }
    } finally {
      clearInterval(ping);
      controller.abort();
      await iterator.return?.();
      const finalRecord = store.getResponse(reservation.record.responseId, false);
      if (
        finalRecord &&
        !['completed', 'failed', 'cancelled'].includes(finalRecord.status)
      ) {
        store.cancelResponse(reservation.record.responseId);
      }
      activeResponses.delete(reservation.record.responseId);
      if (!reply.raw.destroyed) reply.raw.end();
    }

    return reply;
  });

  app.post('/v1/chat/completions', async (request, reply) => {
    const parsed = chatRequestSchema.safeParse(request.body);

    if (!parsed.success) {
      return sendApiError(reply, parsed.error, request.id);
    }
    const chatLimit = requestLimitError(config, {
      inputItems: parsed.data.messages.length,
      tools: parsed.data.tools.length,
    });
    if (chatLimit) return sendApiError(reply, chatLimit, request.id);

    const knownFields = new Set(['model', 'messages', 'stream', 'tools', 'tool_choice']);
    const ignoredFields = Object.keys(parsed.data).filter((field) => !knownFields.has(field));

    if (ignoredFields.length) {
      request.log.debug({ ignoredFields }, 'Ignored OpenAI request fields');
    }

    const workspaceRoot = requestWorkspaceRoot(request.headers);
    const sessionId = scopedSessionId(request.headers, workspaceRoot);
    const local = tryLocalMetaCompletion(parsed.data);

    request.log.debug(
      {
        requestId: request.id,
        workspaceScoped: Boolean(workspaceRoot),
        sessionScoped: Boolean(sessionId),
        localMetaCompletion: Boolean(local),
      },
      'Resolved Nodex request routing',
    );

    if (!parsed.data.stream) {
      try {
        const result: RunResult =
          local ??
          (await core.run(
            normalizeChatRequest(parsed.data),
            sessionId,
            undefined,
            workspaceRoot,
            { requestId: request.id },
          ));

        return mapCompletion(result.events, result.model, result.completionId);
      } catch (error) {
        return sendApiError(reply, error, request.id);
      }
    }

    const controller = new AbortController();

    request.raw.once('aborted', () => {
      controller.abort();
    });

    const run: Promise<RunOutcome> = local
      ? Promise.resolve({ kind: 'result', result: local })
      : core.run(
          normalizeChatRequest(parsed.data),
          sessionId,
          controller.signal,
          workspaceRoot,
          { requestId: request.id },
        ).then(
          (result: RunResult): RunOutcome => ({ kind: 'result', result }),
          (error: unknown): RunOutcome => ({ kind: 'error', error }),
        );

    let keepAliveTimer: NodeJS.Timeout | undefined;

    const first = await Promise.race([
      run,
      new Promise<{ kind: 'keepalive' }>((resolveKeepAlive) => {
        keepAliveTimer = setTimeout(
          () => resolveKeepAlive({ kind: 'keepalive' }),
          config.keepAliveMs,
        );
      }),
    ]);

    if (keepAliveTimer) clearTimeout(keepAliveTimer);

    if (first.kind === 'error') {
      return sendApiError(reply, first.error, request.id);
    }

    reply.hijack();
    const origin = headerString(request.headers.origin);

    reply.raw.writeHead(200, {
      'content-type': 'text/event-stream; charset=utf-8',
      'cache-control': 'no-cache',
      connection: 'keep-alive',
      'x-request-id': request.id,
      ...(origin ? { 'access-control-allow-origin': origin, vary: 'origin' } : {}),
    });

    reply.raw.once('close', () => {
      controller.abort();
    });

    let outcome: RunOutcome;
    let ping: NodeJS.Timeout | undefined;

    if (first.kind === 'keepalive') {
      reply.raw.write(': ping\n\n');

      ping = setInterval(() => {
        reply.raw.write(': ping\n\n');
      }, config.keepAliveMs);

      outcome = await run;
    } else {
      outcome = first;
    }

    try {
      if (outcome.kind === 'result') {
        for (const chunk of mapChunks(
          outcome.result.events,
          outcome.result.model,
          outcome.result.completionId,
        )) {
          sse(reply, chunk);
        }
      } else {
        sse(reply, errorBody(outcome.error, request.id));
      }
    } finally {
      if (ping) clearInterval(ping);

      reply.raw.write('data: [DONE]\n\n');
      reply.raw.end();
    }
  });

  return app;
}
