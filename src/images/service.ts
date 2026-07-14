import type { NodexConfig } from '../config.js';
import type { FileStore } from '../files/store.js';
import type { StoredFileRecord } from '../session/store.js';
import { OpenAICompatibleImageProvider } from './openai-compatible.js';
import {
  ImageProviderError,
  type ImageArtifact,
  type ImageEditRequest,
  type ImageGenerationRequest,
  type ImageProgressCallback,
  type ImageProvider,
  type ImageProviderCapability,
  type ImageModelCapability,
} from './provider.js';

export interface StoredImageArtifact {
  file: StoredFileRecord;
  artifact: ImageArtifact;
}

function imageDimensions(bytes: Uint8Array, mimeType: string): string | undefined {
  const buffer = Buffer.from(bytes);

  if (mimeType === 'image/png' && buffer.length >= 24) {
    return `${buffer.readUInt32BE(16)}x${buffer.readUInt32BE(20)}`;
  }

  return undefined;
}

export class ImageService {
  constructor(
    private readonly provider: ImageProvider,
    private readonly files: FileStore,
    private readonly limits: { maxInputImages: number; maxInputBytes: number } = {
      maxInputImages: 8,
      maxInputBytes: 50 * 1024 * 1024,
    },
  ) {}

  probe(): ImageProviderCapability {
    return this.provider.probe();
  }

  async generate(
    request: ImageGenerationRequest,
    options: { signal: AbortSignal; onProgress?: ImageProgressCallback; requestId?: string },
  ): Promise<StoredImageArtifact[]> {
    this.validateRequest(request, 'generation');

    return this.store(await this.provider.generate(request, options), options.onProgress);
  }

  async edit(
    request: ImageEditRequest,
    options: { signal: AbortSignal; onProgress?: ImageProgressCallback; requestId?: string },
  ): Promise<StoredImageArtifact[]> {
    this.validateRequest(request, 'edit');

    if (!request.images.length || request.images.length > this.limits.maxInputImages) {
      throw new ImageProviderError(
        'invalid_request',
        `Image edit requires 1-${this.limits.maxInputImages} input images`,
      );
    }

    const firstImage = request.images[0];

    if (!firstImage) {
      throw new ImageProviderError('invalid_request', 'Image edit requires at least one input image');
    }

    const bytes = [...request.images, ...(request.mask ? [request.mask] : [])].reduce(
      (total, image) => total + image.bytes.byteLength,
      0,
    );

    if (bytes > this.limits.maxInputBytes) {
      throw new ImageProviderError('invalid_request', 'Image edit inputs exceed byte limit');
    }

    if (request.images.some((image) => !image.mimeType.startsWith('image/'))) {
      throw new ImageProviderError('invalid_request', 'Image edit inputs must be image MIME types');
    }

    if (request.mask) {
      if (request.mask.mimeType !== firstImage.mimeType) {
        throw new ImageProviderError('invalid_request', 'Mask and first image formats must match');
      }

      const imageSize = imageDimensions(firstImage.bytes, firstImage.mimeType);
      const maskSize = imageDimensions(request.mask.bytes, request.mask.mimeType);

      if (imageSize && maskSize && imageSize !== maskSize) {
        throw new ImageProviderError('invalid_request', 'Mask and first image dimensions must match');
      }
    }

    return this.store(await this.provider.edit(request, options), options.onProgress);
  }

  resolveModel(id: string | undefined, operation: 'generation' | 'edit'): ImageModelCapability {
    const models = this.probe().models.filter((model) => model[operation]);
    const model = id ? models.find((candidate) => candidate.id === id) : models[0];

    if (!model) {
      throw new ImageProviderError('invalid_request', `No image model supports ${operation}${id ? `: ${id}` : ''}`);
    }

    return model;
  }

  private validateRequest(request: ImageGenerationRequest, operation: 'generation' | 'edit'): void {
    const model = this.resolveModel(request.model, operation);

    if (!request.prompt.trim()) {
      throw new ImageProviderError('invalid_request', 'Image prompt is empty');
    }

    if (request.n < 1 || request.n > model.maxImages) {
      throw new ImageProviderError('invalid_request', `Image count exceeds model limit ${model.maxImages}`);
    }

    if (!model.sizes.includes(request.size)) {
      throw new ImageProviderError('invalid_request', `Unsupported image size: ${request.size}`);
    }

    if (!model.qualities.includes(request.quality)) {
      throw new ImageProviderError('invalid_request', `Unsupported image quality: ${request.quality}`);
    }

    if (!model.outputFormats.includes(request.outputFormat)) {
      throw new ImageProviderError('invalid_request', `Unsupported output format: ${request.outputFormat}`);
    }

    if (!model.backgrounds.includes(request.background)) {
      throw new ImageProviderError('invalid_request', `Unsupported background: ${request.background}`);
    }
  }

  private async store(
    artifacts: ImageArtifact[],
    onProgress?: ImageProgressCallback,
  ): Promise<StoredImageArtifact[]> {
    onProgress?.({ phase: 'storing', message: 'Сохраняю готовое изображение' });

    const stored: StoredImageArtifact[] = [];

    for (const artifact of artifacts) {
      const file = await this.files.upload(
        (async function* () {
          yield artifact.bytes;
        })(),
        { filename: artifact.filename, purpose: 'user_data', mimeType: artifact.mimeType },
      );

      stored.push({ file, artifact });
    }

    onProgress?.({ phase: 'completed', message: 'Изображение сохранено' });

    return stored;
  }
}

export function createImageService(config: NodexConfig, files: FileStore): ImageService | undefined {
  if (!config.images.enabled) {
    return undefined;
  }

  const service = new ImageService(new OpenAICompatibleImageProvider(config.images), files, {
    maxInputImages: config.images.maxInputImages,
    maxInputBytes: config.images.maxInputBytes,
  });

  if (!service.probe().available) {
    return undefined;
  }

  return service;
}

export function requireImageService(service: ImageService | undefined): ImageService {
  if (!service) {
    throw new ImageProviderError('disabled', 'Image provider is unavailable');
  }

  return service;
}