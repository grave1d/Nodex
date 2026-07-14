import type { NodexConfig } from '../config.js';
import type { EmbeddingService } from '../embeddings/service.js';
import type { ImageService } from '../images/service.js';
import type { NotionTransport } from '../transport/types.js';

export type ModelKind = 'responses' | 'image' | 'embedding';

export interface ModelCapabilities {
  textInput: boolean;
  textOutput: boolean;
  functionCalling: boolean;
  reasoningSummaries: boolean;
  imageInput: boolean;
  fileInput: boolean;
  imageGeneration: boolean;
  imageEdit: boolean;
  embeddings: boolean;
}

export interface RegisteredModel {
  id: string;
  object: 'model';
  created: number;
  owned_by: string;
  nodex: {
    kind: ModelKind;
    capabilities: ModelCapabilities;
  };
}

function emptyCapabilities(): ModelCapabilities {
  return {
    textInput: false,
    textOutput: false,
    functionCalling: false,
    reasoningSummaries: false,
    imageInput: false,
    fileInput: false,
    imageGeneration: false,
    imageEdit: false,
    embeddings: false,
  };
}

export class ModelRegistry {
  constructor(
    private readonly config: NodexConfig,
    private readonly transport: NotionTransport,
    private readonly images?: ImageService,
    private readonly embeddings?: EmbeddingService,
  ) {}

  list(): RegisteredModel[] {
    const imageCapability = this.images?.probe();
    const imageModels = imageCapability?.available ? imageCapability.models : [];
    const hasGeneration = imageModels.some((model) => model.generation);
    const hasEdit = imageModels.some((model) => model.edit);
    const responseModels: RegisteredModel[] = Object.entries(this.config.models).map(
      ([id, binding]) => ({
        id,
        object: 'model',
        created: 0,
        owned_by: 'nodex:notion-agent',
        nodex: {
          kind: 'responses',
          capabilities: {
            ...emptyCapabilities(),
            textInput: true,
            textOutput: true,
            functionCalling: binding.capabilities.functionCalling,
            reasoningSummaries: binding.capabilities.reasoningSummaries,
            imageInput:
              binding.capabilities.imageInput && this.transport.attachmentCapabilities.imageInput,
            fileInput:
              binding.capabilities.fileInput && this.transport.attachmentCapabilities.fileInput,
            imageGeneration: binding.capabilities.imageGeneration && hasGeneration,
            imageEdit: binding.capabilities.imageEdit && hasEdit,
          },
        },
      }),
    );
    const providerModels: RegisteredModel[] = imageModels.map((model) => ({
      id: model.id,
      object: 'model',
      created: 0,
      owned_by: 'nodex:image-provider',
      nodex: {
        kind: 'image',
        capabilities: {
          ...emptyCapabilities(),
          imageGeneration: model.generation,
          imageEdit: model.edit,
        },
      },
    }));
    const embeddingCapability = this.embeddings?.probe();
    const embeddingModels: RegisteredModel[] = (
      embeddingCapability?.available ? embeddingCapability.models : []
    ).map((model) => ({
      id: model.id,
      object: 'model',
      created: 0,
      owned_by: 'nodex:embedding-provider',
      nodex: {
        kind: 'embedding',
        capabilities: { ...emptyCapabilities(), embeddings: true },
      },
    }));
    return [...responseModels, ...providerModels, ...embeddingModels]
      .sort((left, right) => left.id.localeCompare(right.id));
  }

  get(id: string): RegisteredModel | undefined {
    return this.list().find((model) => model.id === id);
  }

  summary(): {
    counts: Record<ModelKind, number>;
    capabilities: Partial<Record<keyof ModelCapabilities, number>>;
  } {
    const counts: Record<ModelKind, number> = { responses: 0, image: 0, embedding: 0 };
    const capabilities: Partial<Record<keyof ModelCapabilities, number>> = {};
    for (const model of this.list()) {
      counts[model.nodex.kind] += 1;
      for (const [name, available] of Object.entries(model.nodex.capabilities) as Array<
        [keyof ModelCapabilities, boolean]
      >) {
        if (available) capabilities[name] = (capabilities[name] ?? 0) + 1;
      }
    }
    return { counts, capabilities };
  }
}
