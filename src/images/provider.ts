export type ImageOutputFormat = 'png' | 'jpeg' | 'webp';
export type ImageQuality = 'auto' | 'low' | 'medium' | 'high';
export type ImageBackground = 'auto' | 'opaque' | 'transparent';

export interface ImageProgress {
  phase: 'preparing' | 'uploading_inputs' | 'generating' | 'storing' | 'completed';
  message: string;
}

export interface ImageInput {
  filename: string;
  mimeType: string;
  bytes: Uint8Array;
}

export interface ImageGenerationRequest {
  model: string;
  prompt: string;
  n: number;
  size: string;
  quality: ImageQuality;
  background: ImageBackground;
  outputFormat: ImageOutputFormat;
  outputCompression?: number;
}

export interface ImageEditRequest extends ImageGenerationRequest {
  images: ImageInput[];
  mask?: ImageInput;
}

export interface ImageArtifact {
  bytes: Uint8Array;
  mimeType: string;
  filename: string;
  revisedPrompt?: string;
}

export interface ImageModelCapability {
  id: string;
  providerModel: string;
  generation: boolean;
  edit: boolean;
  sizes: string[];
  qualities: ImageQuality[];
  outputFormats: ImageOutputFormat[];
  backgrounds: ImageBackground[];
  maxImages: number;
}

export interface ImageProviderCapability {
  available: boolean;
  reason?: string;
  models: ImageModelCapability[];
}

export type ImageProgressCallback = (progress: ImageProgress) => void;

export interface ImageProvider {
  probe(): ImageProviderCapability;
  generate(
    request: ImageGenerationRequest,
    options: { signal: AbortSignal; onProgress?: ImageProgressCallback; requestId?: string },
  ): Promise<ImageArtifact[]>;
  edit(
    request: ImageEditRequest,
    options: { signal: AbortSignal; onProgress?: ImageProgressCallback; requestId?: string },
  ): Promise<ImageArtifact[]>;
}

export type ImageProviderErrorCode =
  | 'disabled'
  | 'invalid_request'
  | 'auth'
  | 'rate_limit'
  | 'timeout'
  | 'cancelled'
  | 'network'
  | 'provider_error';

export class ImageProviderError extends Error {
  constructor(
    public readonly code: ImageProviderErrorCode,
    message: string,
    public readonly status?: number,
    public readonly retryAfterMs?: number,
  ) {
    super(message);
    this.name = 'ImageProviderError';
  }
}
