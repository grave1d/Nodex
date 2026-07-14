import type { NodexConfig } from '../config.js';
import { OpenAICompatibleEmbeddingProvider } from './openai-compatible.js';
import {
  EmbeddingProviderError,
  type EmbeddingInput,
  type EmbeddingProvider,
  type EmbeddingProviderCapability,
  type EmbeddingRequest,
  type EmbeddingResult,
} from './provider.js';

function inputCount(input: EmbeddingInput): number {
  if (typeof input === 'string') return 1;
  if (!input.length) return 0;
  return typeof input[0] === 'string' || Array.isArray(input[0]) ? input.length : 1;
}

function isTokenInput(input: EmbeddingInput): boolean {
  return Array.isArray(input) && input.length > 0 &&
    (typeof input[0] === 'number' || Array.isArray(input[0]));
}

function inputBytes(input: EmbeddingInput): number {
  return Buffer.byteLength(JSON.stringify(input), 'utf8');
}

function vectorDimensions(value: number[] | string): number {
  if (Array.isArray(value)) return value.length;
  const bytes = Buffer.from(value, 'base64');
  if (!bytes.length || bytes.length % 4 !== 0) {
    throw new EmbeddingProviderError('provider_error', 'Provider returned invalid base64 embedding');
  }
  return bytes.length / 4;
}

export class EmbeddingService {
  constructor(
    private readonly provider: EmbeddingProvider,
    private readonly limits: { maxInputCount: number; maxInputBytes: number },
  ) {}

  probe(): EmbeddingProviderCapability {
    return this.provider.probe();
  }

  async create(
    request: EmbeddingRequest,
    signal: AbortSignal,
    requestId?: string,
  ): Promise<EmbeddingResult> {
    const capability = this.probe();
    if (!capability.available) {
      throw new EmbeddingProviderError('disabled', 'Embedding provider is unavailable');
    }
    const model = capability.models.find((item) => item.id === request.model);
    if (!model) {
      throw new EmbeddingProviderError('invalid_request', `Embedding model not found: ${request.model}`);
    }
    const count = inputCount(request.input);
    if (count < 1 || count > this.limits.maxInputCount) {
      throw new EmbeddingProviderError(
        'invalid_request',
        `Embedding input count must be between 1 and ${this.limits.maxInputCount}`,
      );
    }
    if (inputBytes(request.input) > this.limits.maxInputBytes) {
      throw new EmbeddingProviderError('invalid_request', 'Embedding inputs exceed byte limit');
    }
    if (isTokenInput(request.input) && !model.tokenArrays) {
      throw new EmbeddingProviderError('invalid_request', 'This embedding model does not accept token arrays');
    }
    if (request.dimensions !== undefined && !model.dimensions.includes(request.dimensions)) {
      throw new EmbeddingProviderError(
        'invalid_request',
        `Unsupported embedding dimensions: ${request.dimensions}`,
      );
    }

    const result = await this.provider.create(request, {
      signal,
      ...(requestId ? { requestId } : {}),
    });
    if (result.data.length !== count) {
      throw new EmbeddingProviderError('provider_error', 'Provider returned an unexpected embedding count');
    }
    const ordered = [...result.data].sort((left, right) => left.index - right.index);
    if (ordered.some((item, index) => item.index !== index)) {
      throw new EmbeddingProviderError('provider_error', 'Provider returned invalid embedding indexes');
    }
    const dimensions = ordered.map((item) => vectorDimensions(item.embedding));
    if (new Set(dimensions).size !== 1) {
      throw new EmbeddingProviderError('provider_error', 'Provider returned inconsistent vector dimensions');
    }
    if (request.dimensions !== undefined && dimensions[0] !== request.dimensions) {
      throw new EmbeddingProviderError('provider_error', 'Provider returned the wrong vector dimensions');
    }
    return { ...result, model: request.model, data: ordered };
  }
}

function pointsBackToNodex(config: NodexConfig): boolean {
  try {
    const url = new URL(config.embeddings.baseUrl);
    const localHost = ['127.0.0.1', 'localhost', '::1'].includes(url.hostname);
    const port = Number(url.port || (url.protocol === 'https:' ? 443 : 80));
    return localHost && port === config.server.port;
  } catch {
    return false;
  }
}

export function createEmbeddingService(config: NodexConfig): EmbeddingService | undefined {
  if (!config.embeddings.enabled || pointsBackToNodex(config)) return undefined;
  const service = new EmbeddingService(
    new OpenAICompatibleEmbeddingProvider(config.embeddings),
    {
      maxInputCount: config.embeddings.maxInputCount,
      maxInputBytes: config.embeddings.maxInputBytes,
    },
  );
  return service.probe().available ? service : undefined;
}
