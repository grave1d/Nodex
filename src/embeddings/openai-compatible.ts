import { fetch } from 'undici';
import type { NodexConfig } from '../config.js';
import { parseRetryAfter } from '../errors.js';
import {
  EmbeddingProviderError,
  type EmbeddingData,
  type EmbeddingModelCapability,
  type EmbeddingProvider,
  type EmbeddingProviderCapability,
  type EmbeddingRequest,
  type EmbeddingResult,
  type EmbeddingUsage,
} from './provider.js';

interface ProviderBody {
  data?: unknown;
  model?: unknown;
  object?: unknown;
  usage?: unknown;
  error?: { message?: unknown };
}

function models(config: NodexConfig['embeddings']): EmbeddingModelCapability[] {
  return Object.entries(config.models).map(([id, model]) => ({ id, ...model }));
}

function parseUsage(value: unknown): EmbeddingUsage | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const usage = value as { prompt_tokens?: unknown; total_tokens?: unknown };
  return Number.isInteger(usage.prompt_tokens) && Number.isInteger(usage.total_tokens)
    ? {
        prompt_tokens: usage.prompt_tokens as number,
        total_tokens: usage.total_tokens as number,
      }
    : undefined;
}

function parseData(value: unknown, encoding: 'float' | 'base64'): EmbeddingData[] {
  if (!Array.isArray(value)) {
    throw new EmbeddingProviderError('provider_error', 'Embedding provider response has no data array');
  }
  return value.map((raw) => {
    if (!raw || typeof raw !== 'object') {
      throw new EmbeddingProviderError('provider_error', 'Embedding provider returned an invalid item');
    }
    const item = raw as { index?: unknown; embedding?: unknown };
    if (!Number.isInteger(item.index) || (item.index as number) < 0) {
      throw new EmbeddingProviderError('provider_error', 'Embedding provider returned an invalid index');
    }
    const validFloat = Array.isArray(item.embedding) &&
      item.embedding.length > 0 &&
      item.embedding.every((number) => typeof number === 'number' && Number.isFinite(number));
    const validBase64 = typeof item.embedding === 'string' && item.embedding.length > 0;
    if ((encoding === 'float' && !validFloat) || (encoding === 'base64' && !validBase64)) {
      throw new EmbeddingProviderError(
        'provider_error',
        `Embedding provider did not honor encoding_format=${encoding}`,
      );
    }
    return {
      object: 'embedding',
      embedding: item.embedding as number[] | string,
      index: item.index as number,
    };
  });
}

export class OpenAICompatibleEmbeddingProvider implements EmbeddingProvider {
  constructor(private readonly config: NodexConfig['embeddings']) {}

  probe(): EmbeddingProviderCapability {
    if (!this.config.enabled) return { available: false, reason: 'disabled', models: [] };
    if (!process.env[this.config.apiKeyEnv]) {
      return { available: false, reason: `missing_env:${this.config.apiKeyEnv}`, models: [] };
    }
    const availableModels = models(this.config);
    return availableModels.length
      ? { available: true, models: availableModels }
      : { available: false, reason: 'no_models', models: [] };
  }

  async create(
    request: EmbeddingRequest,
    options: { signal: AbortSignal; requestId?: string },
  ): Promise<EmbeddingResult> {
    const model = models(this.config).find((item) => item.id === request.model);
    if (!model) {
      throw new EmbeddingProviderError('invalid_request', `Embedding model not found: ${request.model}`);
    }
    const key = process.env[this.config.apiKeyEnv];
    if (!key) throw new EmbeddingProviderError('disabled', `Missing ${this.config.apiKeyEnv}`);

    const timeout = new AbortController();
    const timer = setTimeout(() => timeout.abort(), this.config.timeoutMs);
    const abort = (): void => timeout.abort();
    options.signal.addEventListener('abort', abort, { once: true });
    try {
      const response = await fetch(`${this.config.baseUrl.replace(/\/$/, '')}/embeddings`, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${key}`,
          'content-type': 'application/json',
          ...(options.requestId ? { 'x-request-id': options.requestId } : {}),
        },
        body: JSON.stringify({
          model: model.providerModel,
          input: request.input,
          encoding_format: request.encodingFormat,
          ...(request.dimensions === undefined ? {} : { dimensions: request.dimensions }),
          ...(request.user === undefined ? {} : { user: request.user }),
        }),
        signal: timeout.signal,
      });
      let body: ProviderBody = {};
      try {
        body = await response.json() as ProviderBody;
      } catch {
        throw new EmbeddingProviderError('provider_error', 'Embedding provider returned invalid JSON');
      }
      if (!response.ok) {
        const message = typeof body.error?.message === 'string'
          ? body.error.message
          : `Embedding provider returned HTTP ${response.status}`;
        if (response.status === 401 || response.status === 403) {
          throw new EmbeddingProviderError('auth', message, response.status);
        }
        if (response.status === 429) {
          throw new EmbeddingProviderError(
            'rate_limit',
            message,
            response.status,
            parseRetryAfter(response.headers.get('retry-after')),
          );
        }
        throw new EmbeddingProviderError(
          response.status >= 400 && response.status < 500 ? 'invalid_request' : 'provider_error',
          message,
          response.status,
        );
      }
      const usage = parseUsage(body.usage);
      return {
        object: 'list',
        data: parseData(body.data, request.encodingFormat),
        model: typeof body.model === 'string' ? body.model : model.providerModel,
        ...(usage ? { usage } : {}),
      };
    } catch (error) {
      if (error instanceof EmbeddingProviderError) throw error;
      if (timeout.signal.aborted) {
        throw new EmbeddingProviderError(
          options.signal.aborted ? 'cancelled' : 'timeout',
          options.signal.aborted ? 'Embedding request cancelled' : 'Embedding request timed out',
        );
      }
      throw new EmbeddingProviderError('network', 'Cannot reach embedding provider');
    } finally {
      clearTimeout(timer);
      options.signal.removeEventListener('abort', abort);
    }
  }
}
