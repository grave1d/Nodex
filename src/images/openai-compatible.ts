import { Blob } from 'node:buffer';
import { fetch, FormData, Headers } from 'undici';
import type { NodexConfig } from '../config.js';
import { parseRetryAfter } from '../errors.js';
import {
  ImageProviderError,
  type ImageArtifact,
  type ImageEditRequest,
  type ImageGenerationRequest,
  type ImageModelCapability,
  type ImageProgressCallback,
  type ImageProvider,
  type ImageProviderCapability,
} from './provider.js';

interface ProviderImage {
  b64_json?: unknown;
  revised_prompt?: unknown;
}

interface ProviderResponse {
  data?: unknown;
  error?: {
    message?: unknown;
    code?: unknown;
  };
}

type FetchResponse = Awaited<ReturnType<typeof fetch>>;
type FetchInit = NonNullable<Parameters<typeof fetch>[1]>;

function mimeFor(format: string): string {
  return format === 'jpeg' ? 'image/jpeg' : `image/${format}`;
}

function capabilityModels(config: NodexConfig['images']): ImageModelCapability[] {
  return Object.entries(config.models).map(([id, model]) => ({ id, ...model }));
}

function toBlobPart(bytes: Uint8Array): ArrayBuffer {
  const copy = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(copy).set(bytes);
  return copy;
}

async function parseResponse(response: FetchResponse): Promise<ProviderResponse> {
  let body: ProviderResponse = {};

  try {
    body = (await response.json()) as ProviderResponse;
  } catch {
    // safe provider error below
  }

  if (!response.ok) {
    const message =
      typeof body.error?.message === 'string'
        ? body.error.message
        : `Image provider returned HTTP ${response.status}`;

    if (response.status === 401 || response.status === 403) {
      throw new ImageProviderError('auth', message, response.status);
    }

    if (response.status === 429) {
      throw new ImageProviderError(
        'rate_limit',
        message,
        response.status,
        parseRetryAfter(response.headers.get('retry-after')),
      );
    }

    throw new ImageProviderError(
      response.status >= 400 && response.status < 500 ? 'invalid_request' : 'provider_error',
      message,
      response.status,
    );
  }

  return body;
}

function artifacts(body: ProviderResponse, format: string): ImageArtifact[] {
  if (!Array.isArray(body.data)) {
    throw new ImageProviderError('provider_error', 'Image provider response has no data array');
  }

  return body.data.map((item, index) => {
    const image = item as ProviderImage;

    if (typeof image.b64_json !== 'string') {
      throw new ImageProviderError('provider_error', 'Image provider did not return b64_json');
    }

    return {
      bytes: Buffer.from(image.b64_json, 'base64'),
      mimeType: mimeFor(format),
      filename: `generated-${index + 1}.${format === 'jpeg' ? 'jpg' : format}`,
      ...(typeof image.revised_prompt === 'string' ? { revisedPrompt: image.revised_prompt } : {}),
    };
  });
}

export class OpenAICompatibleImageProvider implements ImageProvider {
  constructor(private readonly config: NodexConfig['images']) {}

  probe(): ImageProviderCapability {
    if (!this.config.enabled) {
      return { available: false, reason: 'disabled', models: [] };
    }

    if (!process.env[this.config.apiKeyEnv]) {
      return { available: false, reason: `missing_env:${this.config.apiKeyEnv}`, models: [] };
    }

    const models = capabilityModels(this.config);
    return models.length ? { available: true, models } : { available: false, reason: 'no_models', models: [] };
  }

  async generate(
    request: ImageGenerationRequest,
    options: { signal: AbortSignal; onProgress?: ImageProgressCallback; requestId?: string },
  ): Promise<ImageArtifact[]> {
    options.onProgress?.({ phase: 'preparing', message: 'Проверяю параметры изображения' });

    const model = this.requireModel(request.model, 'generation');

    options.onProgress?.({ phase: 'generating', message: 'Создаю изображение у провайдера' });

    const headers = new Headers();
    headers.set('content-type', 'application/json');

    if (options.requestId) {
      headers.set('x-request-id', options.requestId);
    }

    const body = await this.request('/images/generations', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: model.providerModel,
        prompt: request.prompt,
        n: request.n,
        size: request.size,
        quality: request.quality,
        background: request.background,
        output_format: request.outputFormat,
        ...(request.outputCompression === undefined ? {} : { output_compression: request.outputCompression }),
      }),
      signal: options.signal,
    });

    return artifacts(body, request.outputFormat);
  }

  async edit(
    request: ImageEditRequest,
    options: { signal: AbortSignal; onProgress?: ImageProgressCallback; requestId?: string },
  ): Promise<ImageArtifact[]> {
    options.onProgress?.({ phase: 'uploading_inputs', message: 'Передаю изображения провайдеру' });

    const model = this.requireModel(request.model, 'edit');
    const form = new FormData();

    form.set('model', model.providerModel);
    form.set('prompt', request.prompt);
    form.set('n', String(request.n));
    form.set('size', request.size);
    form.set('quality', request.quality);
    form.set('background', request.background);
    form.set('output_format', request.outputFormat);

    if (request.outputCompression !== undefined) {
      form.set('output_compression', String(request.outputCompression));
    }

    for (const image of request.images) {
      form.append('image[]', new Blob([toBlobPart(image.bytes)], { type: image.mimeType }), image.filename);
    }

    if (request.mask) {
      form.set(
        'mask',
        new Blob([toBlobPart(request.mask.bytes)], { type: request.mask.mimeType }),
        request.mask.filename,
      );
    }

    options.onProgress?.({ phase: 'generating', message: 'Редактирую изображение у провайдера' });

    const headers = new Headers();

    if (options.requestId) {
      headers.set('x-request-id', options.requestId);
    }

    const body = await this.request('/images/edits', {
      method: 'POST',
      headers,
      body: form,
      signal: options.signal,
    });

    return artifacts(body, request.outputFormat);
  }

  private requireModel(id: string, operation: 'generation' | 'edit'): ImageModelCapability {
    const model = capabilityModels(this.config).find((item) => item.id === id);

    if (!model || !model[operation]) {
      throw new ImageProviderError('invalid_request', `Image model does not support ${operation}: ${id}`);
    }

    return model;
  }

  private async request(path: string, init: FetchInit): Promise<ProviderResponse> {
    const key = process.env[this.config.apiKeyEnv];

    if (!key) {
      throw new ImageProviderError('disabled', `Missing ${this.config.apiKeyEnv}`);
    }

    const timeout = new AbortController();
    const timer = setTimeout(() => timeout.abort(), this.config.timeoutMs);
    const external = init.signal;
    const abort = (): void => timeout.abort('cancelled');

    external?.addEventListener('abort', abort, { once: true });

    try {
      const headers = new Headers(init.headers);
      headers.set('authorization', `Bearer ${key}`);

      const response = await fetch(`${this.config.baseUrl.replace(/\/$/, '')}${path}`, {
        ...init,
        headers,
        signal: timeout.signal,
      });

      return await parseResponse(response);
    } catch (error) {
      if (error instanceof ImageProviderError) {
        throw error;
      }

      if (timeout.signal.aborted) {
        throw new ImageProviderError(
          external?.aborted ? 'cancelled' : 'timeout',
          external?.aborted ? 'Image request cancelled' : 'Image request timed out',
        );
      }

      throw new ImageProviderError('network', 'Cannot reach image provider');
    } finally {
      clearTimeout(timer);
      external?.removeEventListener('abort', abort);
    }
  }
}