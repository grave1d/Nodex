export type EmbeddingEncoding = 'float' | 'base64';
export type EmbeddingInput = string | string[] | number[] | number[][];

export interface EmbeddingRequest {
  model: string;
  input: EmbeddingInput;
  encodingFormat: EmbeddingEncoding;
  dimensions?: number;
  user?: string;
}

export interface EmbeddingData {
  object: 'embedding';
  embedding: number[] | string;
  index: number;
}

export interface EmbeddingUsage {
  prompt_tokens: number;
  total_tokens: number;
}

export interface EmbeddingResult {
  object: 'list';
  data: EmbeddingData[];
  model: string;
  usage?: EmbeddingUsage;
}

export interface EmbeddingModelCapability {
  id: string;
  providerModel: string;
  tokenArrays: boolean;
  dimensions: number[];
}

export interface EmbeddingProviderCapability {
  available: boolean;
  reason?: string;
  models: EmbeddingModelCapability[];
}

export interface EmbeddingProvider {
  probe(): EmbeddingProviderCapability;
  create(
    request: EmbeddingRequest,
    options: { signal: AbortSignal; requestId?: string },
  ): Promise<EmbeddingResult>;
}

export type EmbeddingProviderErrorCode =
  | 'disabled'
  | 'invalid_request'
  | 'auth'
  | 'rate_limit'
  | 'timeout'
  | 'cancelled'
  | 'network'
  | 'provider_error';

export class EmbeddingProviderError extends Error {
  constructor(
    public readonly code: EmbeddingProviderErrorCode,
    message: string,
    public readonly status?: number,
    public readonly retryAfterMs?: number,
  ) {
    super(message);
    this.name = 'EmbeddingProviderError';
  }
}
