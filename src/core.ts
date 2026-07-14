import { createHash, randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import type { NodexConfig } from './config.js';
import { buildRuntimeWorkspaceEnvelope, EnvelopeCache } from './context/envelope.js';
import { NodexError } from './errors.js';
import type { FileStore } from './files/store.js';
import { ImageProviderError, type ImageInput } from './images/provider.js';
import type { ImageService } from './images/service.js';
import { normalizeChatRequest } from './openai/adapters.js';
import type { ChatRequest } from './openai/types.js';
import { generateProtocolPreamble } from './protocol/preamble.js';
import { IncrementalProtocolParser } from './protocol/incremental.js';
import { assertCompleteTurn, parseProtocol } from './protocol/parser.js';
import type { ProtocolEvent, StatusEvent } from './protocol/schema.js';
import { KeyedMutex } from './session/mutex.js';
import type { Session } from './session/store.js';
import { SessionStore } from './session/store.js';
import type { NotionTransport, TransportAttachment } from './transport/types.js';
import { AsyncQueue } from './turn/queue.js';
import type {
  CoreTurnEvent,
  GeneratedImageResult,
  NormalizedTurn,
  TurnImageGenerationTool,
  TurnInputItem,
  TurnMessage,
} from './turn/types.js';

type TransportTurn = Awaited<ReturnType<NotionTransport['send']>>;

async function boundedBackoff(signal: AbortSignal, milliseconds: number): Promise<void> {
  if (signal.aborted) throw new NodexError('cancelled', 'Request cancelled during retry backoff');
  await new Promise<void>((resolveWait, rejectWait) => {
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', abort);
      resolveWait();
    }, milliseconds);
    const abort = (): void => {
      clearTimeout(timer);
      rejectWait(new NodexError('cancelled', 'Request cancelled during retry backoff'));
    };
    signal.addEventListener('abort', abort, { once: true });
  });
}

function canonical(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(canonical).join(',')}]`;
  }

  if (value && typeof value === 'object') {
    const object = value as Record<string, unknown>;

    return `{${Object.keys(object)
      .sort((a, b) => a.localeCompare(b))
      .map((key) => `${JSON.stringify(key)}:${canonical(object[key])}`)
      .join(',')}}`;
  }

  return JSON.stringify(value);
}

function hash(value: unknown): string {
  return createHash('sha256').update(canonical(value)).digest('hex');
}

function parseIssuedCalls(raw: string | undefined): Set<string> {
  try {
    const value: unknown = JSON.parse(raw ?? '[]');

    if (!Array.isArray(value)) return new Set();

    return new Set(value.filter((item): item is string => typeof item === 'string'));
  } catch {
    return new Set();
  }
}

function messageText(message: TurnMessage | undefined): string {
  if (!message) return '';

  return message.content
    .filter((part) => part.type === 'text')
    .map((part) => part.text)
    .join('\n');
}

type TurnToolOutput =
  | Extract<TurnInputItem, { type: 'function_call_output' }>
  | Extract<TurnInputItem, { type: 'custom_tool_call_output' }>;

function isTurnToolOutput(item: TurnInputItem | undefined): item is TurnToolOutput {
  return item?.type === 'function_call_output' || item?.type === 'custom_tool_call_output';
}

function serializeTurnItem(item: TurnInputItem): Record<string, unknown> {
  if (item.type === 'message') {
    return {
      type: 'message',
      role: item.role,
      ...(item.phase ? { phase: item.phase } : {}),
      content: item.content.map((part) => {
        if (part.type === 'text') return part;
        if (part.type === 'image') {
          return {
            type: 'image',
            file_id: part.fileId ?? '[resolved-inline-image]',
            detail: part.detail,
          };
        }
        return {
          type: 'file',
          file_id: part.fileId ?? '[resolved-inline-file]',
          ...(part.filename ? { filename: part.filename } : {}),
        };
      }),
    };
  }
  if (item.type === 'function_call') {
    return {
      type: 'function_call',
      call_id: item.callId,
      name: item.name,
      arguments: item.arguments,
    };
  }
  if (item.type === 'custom_tool_call') {
    return {
      type: 'custom_tool_call',
      call_id: item.callId,
      name: item.name,
      input: item.input,
    };
  }
  if (item.type === 'image_generation_call') {
    return { type: 'image_generation_call', id: item.id };
  }
  return {
    type: 'tool_result',
    tool_call_id: item.callId,
    content: item.output,
  };
}

function deriveTurnSessionId(request: NormalizedTurn, explicit?: string): string {
  if (explicit) return explicit;

  const messages = request.input.filter((item): item is TurnMessage => item.type === 'message');
  const system = messageText(messages.find((message) => message.role === 'system'));
  const developer = messageText(messages.find((message) => message.role === 'developer'));
  const user = messageText(messages.find((message) => message.role === 'user'));

  return hash({ system, developer, user });
}

export function deriveSessionId(request: ChatRequest, explicit?: string): string {
  return deriveTurnSessionId(normalizeChatRequest(request), explicit);
}

export function truncateUtf8(value: string, limit: number): string {
  const bytes = Buffer.from(value, 'utf8');

  if (bytes.length <= limit) return value;

  let end = limit;

  while (end > 0 && (bytes[end] ?? 0) >> 6 === 2) {
    end -= 1;
  }

  return `${bytes.subarray(0, end).toString('utf8')}\n[NODEX: tool output truncated at ${limit} UTF-8 bytes]`;
}

function inputPayload(request: NormalizedTurn, session: Session | undefined, limit: number): string {
  const trailingTools: TurnToolOutput[] = [];

  for (let i = request.input.length - 1; i >= 0; i -= 1) {
    const item = request.input[i];

    if (!isTurnToolOutput(item)) break;

    trailingTools.unshift(item);
  }

  if (trailingTools.length) {
    const allowed = parseIssuedCalls(session?.issuedCalls);

    const results = trailingTools.map((item) => {
      if (!item.callId || !allowed.has(item.callId)) {
        throw new NodexError(
          'invalid_request',
          `Unknown call_id: ${item.callId || '(missing)'}`,
        );
      }

      return {
        type: 'tool_result',
        tool_call_id: item.callId,
        content: truncateUtf8(item.output, limit),
      };
    });

    return results.map((result) => JSON.stringify(result)).join('\n');
  }

  const lastUser = [...request.input]
    .reverse()
    .find((item): item is TurnMessage => item.type === 'message' && item.role === 'user');
  const text = messageText(lastUser);

  if (!lastUser || !text.trim()) {
    throw new NodexError(
      'invalid_request',
      'Request must contain a user message or trailing tool results',
    );
  }

  const messages = request.input.filter((item) => item.type === 'message');
  if (
    messages.length === 1 &&
    lastUser === messages[0] &&
    lastUser.content.every((part) => part.type === 'text')
  ) return text;
  return request.input.map((item) => JSON.stringify(serializeTurnItem(item))).join('\n');
}

export function responseContextOutputItems(
  terminal: ProtocolEvent | undefined,
  responseId: string,
  images?: GeneratedImageResult[],
): TurnInputItem[] {
  if (images?.length) {
    return images.map((image) => ({
      type: 'image_generation_call',
      id: image.id,
      fileId: image.fileId,
    }));
  }
  if (terminal?.type === 'final') {
    return [{
      type: 'message',
      id: `msg_${responseId.slice(5)}`,
      role: 'assistant',
      status: 'completed',
      phase: 'final_answer',
      content: [{ type: 'text', text: terminal.text.trim() || terminal.summary?.trim() || '' }],
    }];
  }
  if (terminal?.type === 'tool_call') {
    return terminal.calls.map((call, index): TurnInputItem => 'input' in call
      ? {
          type: 'custom_tool_call',
          id: `ctc_${responseId.slice(5)}_${index}`,
          callId: call.id,
          name: call.name,
          input: call.input,
          status: 'completed',
        }
      : {
          type: 'function_call',
          id: `fc_${responseId.slice(5)}_${index}`,
          callId: call.id,
          name: call.name,
          arguments: JSON.stringify(call.arguments),
          status: 'completed',
        });
  }
  return [];
}

function validateToolPolicy(request: NormalizedTurn, terminal: ProtocolEvent | undefined): void {
  const tools = new Map(
    request.tools.map((tool) => [tool.type === 'image_generation' ? 'image_generation' : tool.name, tool]),
  );

  if (typeof request.toolChoice === 'object' && !tools.has(request.toolChoice.name)) {
    throw new NodexError(
      'invalid_request',
      `tool_choice references unknown function: ${request.toolChoice.name}`,
    );
  }

  if (!terminal) return;

  if (terminal.type === 'tool_call') {
    if (request.toolChoice === 'none') {
      throw new Error('protocol_tool_call_forbidden');
    }

    if (!request.parallelToolCalls && terminal.calls.length > 1) {
      throw new Error('protocol_parallel_tool_calls_forbidden');
    }

    for (const call of terminal.calls) {
      const tool = tools.get(call.name);
      if (!tool) {
        throw new Error(`protocol_unknown_tool:${call.name}`);
      }

      if (tool.type === 'custom' && !('input' in call)) {
        throw new Error(`protocol_custom_tool_requires_input:${call.name}`);
      }

      if (tool.type !== 'custom' && !('arguments' in call)) {
        throw new Error(`protocol_function_tool_requires_arguments:${call.name}`);
      }

      if (
        typeof request.toolChoice === 'object' &&
        (call.name !== request.toolChoice.name || request.toolChoice.type !== tool.type)
      ) {
        throw new Error(`protocol_wrong_tool:${call.name}`);
      }
    }
  } else if (request.toolChoice === 'required' || typeof request.toolChoice === 'object') {
    throw new Error('protocol_required_tool_missing');
  }
}

function hasRuntimeWorkspaceTools(request: NormalizedTurn): boolean {
  return request.tools.some((tool) => {
    if (tool.type === 'image_generation') return false;
    const name = tool.name;

    return (
      name === 'shell_command' ||
      name === 'codex_app__read_thread_terminal' ||
      name === 'apply_patch' ||
      name === 'tool_search'
    );
  });
}

function workspaceDiscoveryInstructions(): string {
  return [
    'Nodex не получил x-nodex-workspace-cwd, поэтому PROJECT не содержит дерево реального проекта.',
    'Реальный workspace — это default cwd инструментов клиента Codex/Cockpit, особенно shell_command.',
    'Если задача зависит от проекта, сначала вызови shell_command и определи workspace:',
    '1. Get-Location',
    '2. git rev-parse --show-toplevel, если это git repo',
    '3. Get-Content -Raw AGENTS.md, если файл есть',
    '4. затем README.md, package.json или другие manifest/config файлы по ситуации',
    'Не делай вывод, что проект — Nodex, только потому что Nodex является bridge-сервером.',
  ].join('\n');
}

function responseStyleInstructions(): string {
  const finalExample = JSON.stringify({
    type: 'final',
    text: [
      '## Zanos',
      '',
      '**Zanos** — multi-repo workspace для интерактивных Twitch-розыгрышей.',
      '',
      '### Главное',
      '- Первый режим: 2D race-визуализация.',
      '- Winner selection отделён от renderer.',
      '- OBS overlay только показывает outcome/timeline.',
      '',
      'Могу дальше разобрать архитектуру сервисов или проверить конкретный repo.',
    ].join('\n'),
  });

  return [
    'Пиши final.text как нативный пользовательский ответ Codex, а не как сухой лог.',
    '',
    'Обязательные правила:',
    '- Для содержательных ответов используй Markdown внутри final.text.',
    '- Используй заголовки `##`, списки, короткие секции, **акценты**, `inline code` и таблицы, когда это улучшает читаемость.',
    '- Не пиши ответ одной длинной строкой, если есть 2+ смысловых блока.',
    '- Не добавляй видимый постскриптум `Итог: ...`, `Summary: ...`, `Задача выполнена`.',
    '- Для приветствий и простых коротких ответов отвечай естественно и без summary.',
    '- Поле summary можно опустить. Если оно есть, оно внутреннее и не должно дублировать финальный ответ.',
    '- status.text — это промежуточный commentary: один короткий абзац без заголовков, списков, таблиц и fenced code.',
    '',
    'Важно для JSONL:',
    '- Внешний ответ всё равно должен быть одним JSON-объектом в одной строке.',
    '- Markdown-разметку помещай в строку final.text.',
    '- Переносы строк внутри final.text должны быть JSON-escaped как `\\n`.',
    '',
    'Хороший пример final:',
    finalExample,
    '',
    'Плохой пример final:',
    '{"type":"final","text":"Это проект Zanos: multi-repo workspace для Twitch...","summary":"Ответил по workspace."}',
  ].join('\n');
}

export interface RunResult {
  events: ProtocolEvent[];
  model: string;
  completionId: string;
  responseId: string;
  createdAt: number;
  images?: GeneratedImageResult[];
}

export interface CoreRunIdentity {
  responseId?: string;
  completionId?: string;
  createdAt?: number;
  requestId?: string;
}

interface ProjectEnvelopeResult {
  envelope: Record<string, unknown>;
  scope: string;
  discovery?: string;
}

interface CoreLogger {
  debug(data: Record<string, unknown>, message: string): void;
}

export class NodexCore {
  private readonly mutex = new KeyedMutex();
  private readonly envelopes = new Map<string, EnvelopeCache>();

  constructor(
    private readonly config: NodexConfig,
    private readonly store: SessionStore,
    private readonly transport: NotionTransport,
    private readonly logger?: CoreLogger,
    private readonly files?: FileStore,
    private readonly images?: ImageService,
  ) {}

  private validateImageTool(
    request: NormalizedTurn,
    binding: NodexConfig['models'][string],
  ): void {
    const tool = request.tools.find(
      (candidate): candidate is TurnImageGenerationTool => candidate.type === 'image_generation',
    );
    if (!tool) return;
    if (!binding.capabilities.imageGeneration) {
      throw new NodexError(
        'capability_unavailable',
        `Responses model ${request.model} does not enable image generation`,
      );
    }
    if (tool.action === 'edit' && !binding.capabilities.imageEdit) {
      throw new NodexError(
        'capability_unavailable',
        `Responses model ${request.model} does not enable image editing`,
      );
    }
    if (!this.images) {
      throw new NodexError('capability_unavailable', 'Image generation provider is unavailable');
    }
    if (tool.partialImages > 0) {
      throw new NodexError(
        'capability_unavailable',
        'Partial image streaming is not supported by the configured provider',
      );
    }
    const operation = tool.action === 'edit' ? 'edit' : 'generation';
    try { this.images.resolveModel(tool.model, operation); }
    catch (error) { throw this.mapImageError(error); }
  }

  private mapImageError(error: unknown): NodexError {
    if (!(error instanceof ImageProviderError)) {
      return new NodexError('upstream_protocol', 'Image provider failed');
    }
    if (error.code === 'rate_limit') {
      return new NodexError('rate_limit', error.message, error.retryAfterMs);
    }
    if (error.code === 'auth') return new NodexError('auth', error.message);
    if (error.code === 'timeout') return new NodexError('timeout', error.message);
    if (error.code === 'invalid_request') return new NodexError('invalid_request', error.message);
    if (error.code === 'disabled') return new NodexError('capability_unavailable', error.message);
    return new NodexError('network', error.message);
  }

  private async attachmentInput(attachment: TransportAttachment): Promise<ImageInput> {
    const chunks: Buffer[] = [];

    for await (const chunk of attachment.open() as AsyncIterable<Uint8Array>) {
      chunks.push(Buffer.from(chunk));
    }

    return {
      filename: attachment.filename,
      mimeType: attachment.mimeType,
      bytes: Buffer.concat(chunks),
    };
  }

  private async runImageTool(
    request: NormalizedTurn,
    call: Extract<Extract<ProtocolEvent, { type: 'tool_call' }>['calls'][number], { arguments: unknown }>,
    attachments: TransportAttachment[],
    responseId: string,
    signal: AbortSignal,
    onStatus: (event: StatusEvent) => void,
    requestId?: string,
  ): Promise<GeneratedImageResult[]> {
    const service = this.images;
    const tool = request.tools.find(
      (candidate): candidate is TurnImageGenerationTool => candidate.type === 'image_generation',
    );
    if (!service || !tool) {
      throw new NodexError('capability_unavailable', 'Image generation tool is unavailable');
    }
    const args = call.arguments;
    const prompt = typeof args['prompt'] === 'string' ? args['prompt'] : '';
    if (!prompt.trim()) throw new NodexError('invalid_request', 'image_generation requires prompt');
    const requestedAction = typeof args['action'] === 'string' ? args['action'] : tool.action;
    const binding = this.config.models[request.model];
    if (!binding) throw new NodexError('invalid_request', `Unknown model: ${request.model}`);
    if (requestedAction === 'edit' && !binding.capabilities.imageEdit) {
      throw new NodexError('capability_unavailable', 'Image editing is unavailable for this model');
    }
    const action = requestedAction === 'edit'
      ? 'edit'
      : requestedAction === 'generate'
        ? 'generation'
        : binding.capabilities.imageEdit && attachments.some((attachment) => attachment.kind === 'image')
          ? 'edit'
          : 'generation';
    const model = service.resolveModel(
      typeof args['model'] === 'string' ? args['model'] : tool.model,
      action,
    );
    const common = {
      model: model.id,
      prompt,
      n: typeof args['n'] === 'number' ? args['n'] : 1,
      size: typeof args['size'] === 'string' ? args['size'] : tool.size,
      quality: tool.quality,
      background: tool.background,
      outputFormat: tool.outputFormat,
      ...(tool.outputCompression === undefined
        ? {}
        : { outputCompression: tool.outputCompression }),
    };
    const onProgress = (progress: { message: string; phase: string }): void => {
      onStatus({
        type: 'status',
        text: progress.message,
        phase: progress.phase === 'completed' ? 'after_result' : 'before_action',
      });
    };
    try {
      const stored = action === 'edit'
        ? await service.edit(
            {
              ...common,
              images: await Promise.all(
                attachments
                  .filter((attachment) => attachment.kind === 'image')
                  .map((attachment) => this.attachmentInput(attachment)),
              ),
            },
            { signal, onProgress, ...(requestId ? { requestId } : {}) },
          )
        : await service.generate(common, {
            signal,
            onProgress,
            ...(requestId ? { requestId } : {}),
          });
      return stored.map(({ artifact, file }, index) => ({
        id: `ig_${responseId.slice(5)}_${index}`,
        fileId: file.id,
        mimeType: artifact.mimeType,
        base64: Buffer.from(artifact.bytes).toString('base64'),
        ...(artifact.revisedPrompt ? { revisedPrompt: artifact.revisedPrompt } : {}),
      }));
    } catch (error) {
      throw this.mapImageError(error);
    }
  }

  private async resolveAttachments(
    request: NormalizedTurn,
    binding: NodexConfig['models'][string],
  ): Promise<TransportAttachment[]> {
    const parts = request.input
      .filter((item): item is TurnMessage => item.type === 'message')
      .flatMap((message) => message.content);
    const requested = parts.filter((part) => part.type !== 'text');
    if (!requested.length) return [];
    if (!this.files) {
      throw new NodexError('capability_unavailable', 'FileStore is unavailable for attachments');
    }

    const attachments: TransportAttachment[] = [];
    for (let order = 0; order < parts.length; order += 1) {
      const part = parts[order];
      if (!part || part.type === 'text') continue;
      const image = part.type === 'image';
      if (image) {
        if (!binding.capabilities.imageInput || !this.transport.attachmentCapabilities.imageInput) {
          throw new NodexError('capability_unavailable', 'Selected model/transport has no image input');
        }
      } else if (
        !binding.capabilities.fileInput ||
        !this.transport.attachmentCapabilities.fileInput
      ) {
        throw new NodexError('capability_unavailable', 'Selected model/transport has no file input');
      }

      let fileId = part.fileId;
      if (!fileId) {
        const data = part.type === 'image' ? part.url : part.data;
        if (!data?.startsWith('data:')) {
          throw new NodexError(
            'invalid_request',
            'Remote attachment URLs are disabled; upload through Files API or use a data URL',
          );
        }
        const stored = await this.files.importDataUrl(data, {
          filename: part.type === 'file' ? part.filename ?? 'inline-file.bin' : 'inline-image.bin',
          purpose: image ? 'vision' : 'user_data',
        });
        fileId = stored.id;
        part.fileId = fileId;
        if (part.type === 'image') delete part.url;
        else delete part.data;
      }

      attachments.push(
        await this.files.attachment(
          fileId,
          image ? 'image' : 'file',
          order,
          part.type === 'image' ? part.detail : undefined,
        ),
      );
    }
    return attachments;
  }

  private envelopeFor(root: string): EnvelopeCache {
    const resolved = resolve(root);
    const existing = this.envelopes.get(resolved);

    if (existing) return existing;

    const created = new EnvelopeCache(resolved, this.config.envelope);
    this.envelopes.set(resolved, created);

    return created;
  }

  private async projectEnvelope(
    request: NormalizedTurn,
    workspaceRoot?: string,
  ): Promise<ProjectEnvelopeResult> {
    if (workspaceRoot) {
      const resolved = resolve(workspaceRoot);

      return {
        envelope: await this.envelopeFor(resolved).get(),
        scope: resolved,
      };
    }

    if (hasRuntimeWorkspaceTools(request)) {
      return {
        envelope: buildRuntimeWorkspaceEnvelope(),
        scope: 'runtime_tool_workspace',
        discovery: workspaceDiscoveryInstructions(),
      };
    }

    const fallback = resolve(this.config.projectRoot);

    return {
      envelope: await this.envelopeFor(fallback).get(),
      scope: fallback,
    };
  }

  async close(): Promise<void> {
    await Promise.all([...this.envelopes.values()].map((envelope) => envelope.close()));
  }

  async *stream(
    source: NormalizedTurn | ChatRequest,
    explicitSessionId?: string,
    externalSignal?: AbortSignal,
    workspaceRoot?: string,
    identity?: CoreRunIdentity,
  ): AsyncIterable<CoreTurnEvent> {
    const request = 'messages' in source ? normalizeChatRequest(source) : source;
    const controller = new AbortController();
    const queue = new AsyncQueue<CoreTurnEvent>();
    const abort = (): void => controller.abort('cancelled');

    if (externalSignal?.aborted) abort();
    else externalSignal?.addEventListener('abort', abort, { once: true });

    const work = this.execute(
      request,
      explicitSessionId,
      controller.signal,
      workspaceRoot,
      identity,
      (event) => queue.push(event),
    ).then(
      (result) => {
        queue.push({ type: 'response_done', result });
        queue.end();
      },
      (error: unknown) => queue.fail(error),
    );

    try {
      for await (const event of queue) yield event;
      await work;
    } finally {
      controller.abort('cancelled');
      externalSignal?.removeEventListener('abort', abort);
      await work.catch(() => undefined);
    }
  }

  async run(
    source: NormalizedTurn | ChatRequest,
    explicitSessionId?: string,
    externalSignal?: AbortSignal,
    workspaceRoot?: string,
    identity?: CoreRunIdentity,
  ): Promise<RunResult> {
    let result: RunResult | undefined;

    for await (const event of this.stream(
      source,
      explicitSessionId,
      externalSignal,
      workspaceRoot,
      identity,
    )) {
      if (event.type === 'response_done') result = event.result;
    }

    if (!result) throw new NodexError('upstream_protocol', 'Turn ended without a result');
    return result;
  }

  private async execute(
    request: NormalizedTurn,
    explicitSessionId: string | undefined,
    externalSignal: AbortSignal,
    workspaceRoot: string | undefined,
    identity: CoreRunIdentity | undefined,
    emit: (event: CoreTurnEvent) => void,
  ): Promise<RunResult> {
    const binding = this.config.models[request.model];

    if (!binding) {
      throw new NodexError('invalid_request', `Unknown model: ${request.model}`);
    }

    validateToolPolicy(request, undefined);
    this.validateImageTool(request, binding);

    if (request.conversationId && !this.store.getConversation(request.conversationId)) {
      throw new NodexError(
        'invalid_request',
        `Unknown or deleted conversation: ${request.conversationId}`,
      );
    }

    const completionId = identity?.completionId ?? `chatcmpl-${randomUUID()}`;
    const responseId = identity?.responseId ?? `resp_${randomUUID().replaceAll('-', '')}`;
    const createdAt = identity?.createdAt ?? Math.floor(Date.now() / 1000);

    emit({ type: 'response_start', responseId, completionId, model: request.model, createdAt });

    const sessionId = request.conversationId ?? deriveTurnSessionId(request, explicitSessionId);
    const project = await this.projectEnvelope(request, workspaceRoot);
    const mutexKey = `${project.scope}:${sessionId}:${request.model}`;

    const release = await this.mutex.acquire(mutexKey);

    try {
      const attachments = await this.resolveAttachments(request, binding);
      let session = this.store.getTurnSession(
        sessionId,
        request.model,
        request.conversationId,
      );
      const newSession = !session;

      if (!session) {
        session = this.store.createTurnSession(
          sessionId,
          randomUUID(),
          request.model,
          request.conversationId,
        );
      }

      const toolsHash = hash(request.tools);
      const fullTools = newSession || session.toolsHash !== toolsHash;
      const input = inputPayload(request, session, this.config.toolOutputLimitBytes);
      let conversationContext = request.conversationId
        ? this.store.conversationContextItems(
            request.conversationId,
            newSession ? -1 : session.lastSyncedPosition ?? -1,
            this.config.conversation.maxBootstrapItems,
          )
        : { items: [], latestPosition: -1, omitted: 0 };
      const localStatuses: StatusEvent[] = [];
      const addLocalStatus = (text: string): void => {
        const event: StatusEvent = { type: 'status', text, phase: 'before_action' };
        localStatuses.push(event);
        emit({ type: 'status', event });
      };

      if (request.conversationId && newSession && conversationContext.items.length) {
        addLocalStatus('Восстанавливаю контекст для выбранной модели');
      }
      if (conversationContext.omitted) {
        addLocalStatus('Компактно восстанавливаю длинную историю диалога');
      }

      const makeMessage = (newThread: boolean, includeFullTools: boolean): string =>
        [
          ...(newThread ? [generateProtocolPreamble()] : []),
          includeFullTools
            ? `TOOLS hash=${toolsHash}\n${JSON.stringify(request.tools)}`
            : `TOOLS hash=${toolsHash}`,
          `TOOL_CHOICE ${JSON.stringify(request.toolChoice)}`,
          `PARALLEL_TOOL_CALLS ${JSON.stringify(request.parallelToolCalls)}`,
          ...(request.instructions ? [`INSTRUCTIONS\n${request.instructions}`] : []),
          ...(conversationContext.items.length || conversationContext.omitted
            ? [
                `${newThread ? 'CONVERSATION_CONTEXT' : 'CONVERSATION_DELTA'}\n${[
                  ...(conversationContext.omitted
                    ? [
                        JSON.stringify({
                          type: 'context_compaction',
                          omitted_items: conversationContext.omitted,
                          policy: 'first_and_latest',
                        }),
                      ]
                    : []),
                  ...conversationContext.items.map((item) => JSON.stringify(item.payload)),
                ].join('\n')}`,
              ]
            : []),
          `PROJECT ${JSON.stringify(project.envelope)}`,
          ...(project.discovery ? [`WORKSPACE_DISCOVERY\n${project.discovery}`] : []),
          `RESPONSE_STYLE\n${responseStyleInstructions()}`,
          `INPUT\n${input}`,
        ].join('\n\n');

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort('timeout'), this.config.turnTimeoutMs);
      const abort = (): void => controller.abort('cancelled');

      if (externalSignal.aborted) abort();
      else externalSignal.addEventListener('abort', abort, { once: true });

      const allEvents: ProtocolEvent[] = [...localStatuses];
      let message = makeMessage(newSession, fullTools);
      let forceNew = newSession;
      let resetUsed = false;

      try {
        for (let attempt = 0; attempt <= this.config.protocolRetries; attempt += 1) {
          let raw = '';
          let turn: TransportTurn | undefined;
          let incremental = new IncrementalProtocolParser();
          let streamedStatusCount = 0;

          for (let upstreamAttempt = 0; upstreamAttempt < 2; upstreamAttempt += 1) {
            try {
              turn = await this.transport.send({
                ...(identity?.requestId ? { requestId: identity.requestId } : {}),
                threadId: session.notionThreadId,
                newThread: forceNew,
                message,
                agent: binding,
                state: forceNew ? '{}' : session.transportState,
                signal: controller.signal,
                attachments,
              });

              for await (const chunk of turn.chunks) {
                raw += chunk;
                const update = incremental.push(chunk);

                for (const event of update.events) {
                  if (event.type !== 'status') continue;
                  allEvents.push(event);
                  streamedStatusCount += 1;
                  emit({ type: 'status', event });
                }

                if (update.textDelta) emit({ type: 'text_delta', delta: update.textDelta });
              }

              break;
            } catch (error) {
              if (error instanceof NodexError && error.code === 'thread_not_found' && !resetUsed) {
                resetUsed = true;
                forceNew = true;

                const threadId = randomUUID();

                this.store.replaceTurnThread(
                  session,
                  threadId,
                  '{}',
                  request.conversationId,
                );

                session.notionThreadId = threadId;
                session.transportState = '{}';
                if (request.conversationId) {
                  conversationContext = this.store.conversationContextItems(
                    request.conversationId,
                    -1,
                    this.config.conversation.maxBootstrapItems,
                  );
                  const event: StatusEvent = {
                    type: 'status',
                    text: 'Восстанавливаю контекст после потери Notion-треда',
                    phase: 'before_action',
                  };
                  allEvents.push(event);
                  emit({ type: 'status', event });
                }
                message = makeMessage(true, true);
                upstreamAttempt -= 1;

                continue;
              }

              if (
                error instanceof NodexError &&
                (error.code === 'rate_limit' || error.code === 'trust_backoff') &&
                upstreamAttempt === 0
              ) {
                await boundedBackoff(
                  controller.signal,
                  Math.min(error.retryAfterMs ?? 1_000, 30_000),
                );

                raw = '';
                incremental = new IncrementalProtocolParser();
                streamedStatusCount = 0;

                continue;
              }

              throw error;
            }
          }

          if (!turn) {
            throw new NodexError('upstream_protocol', 'Notion transport produced no turn');
          }

          if (this.config.verbose) {
            this.logger?.debug(
              {
                attempt,
                upstreamBytes: Buffer.byteLength(raw, 'utf8'),
                ...(identity?.requestId ? { requestId: identity.requestId } : {}),
              },
              'Received Notion agent response',
            );
          }

          const parsed = parseProtocol(raw);
          const statuses = parsed.events.filter((event) => event.type === 'status');

          for (const event of statuses.slice(streamedStatusCount)) {
            allEvents.push(event);
            emit({ type: 'status', event });
          }

          try {
            assertCompleteTurn(parsed.events);

            const terminal = parsed.events.at(-1);

            validateToolPolicy(request, terminal);
            let generatedImages: GeneratedImageResult[] | undefined;

            if (terminal && terminal.type !== 'status') {
              allEvents.push(terminal);

              if (terminal.type === 'final') {
                const streamed = incremental.emittedText;
                if (terminal.text.startsWith(streamed)) {
                  const remaining = terminal.text.slice(streamed.length);
                  if (remaining) emit({ type: 'text_delta', delta: remaining });
                }
                emit({ type: 'final', event: terminal });
              } else {
                const imageCalls = terminal.calls.filter(
                  (call): call is Extract<typeof call, { arguments: unknown }> =>
                    call.name === 'image_generation' && 'arguments' in call,
                );
                if (imageCalls.length) {
                  if (terminal.calls.length !== 1) {
                    throw new NodexError(
                      'invalid_request',
                      'image_generation cannot be mixed with function calls in one terminal event',
                    );
                  }
                  const imageCall = imageCalls[0];

                  if (!imageCall) {
                    throw new NodexError('invalid_request', 'image_generation call is missing');
                  }

                  generatedImages = await this.runImageTool(
                    request,
                    imageCall,
                    attachments,
                    responseId,
                    controller.signal,
                    (event) => {
                      allEvents.splice(Math.max(0, allEvents.length - 1), 0, event);
                      emit({ type: 'status', event });
                    },
                    identity?.requestId,
                  );
                  emit({ type: 'image_generation', items: generatedImages });
                } else {
                  emit({ type: 'tool_call', event: terminal });
                }
              }
            }

            session.transportState = turn.nextState;
            session.toolsHash = toolsHash;
            session.issuedCalls =
              terminal?.type === 'tool_call' && !generatedImages
                ? JSON.stringify(terminal.calls.map((call) => call.id))
                : '[]';

            if (request.conversationId) {
              const appended = this.store.appendConversationItems(request.conversationId, [
                ...request.input,
                ...responseContextOutputItems(terminal, responseId, generatedImages),
              ]);
              session.lastSyncedPosition =
                appended.at(-1)?.position ?? conversationContext.latestPosition;
            }

            this.store.touchTurnSession(session, request.conversationId);

            return {
              events: allEvents,
              model: request.model,
              completionId,
              responseId,
              createdAt,
              ...(generatedImages ? { images: generatedImages } : {}),
            };
          } catch (error) {
            session.transportState = turn.nextState;
            this.store.touchTurnSession(session, request.conversationId);

            if (error instanceof NodexError) throw error;

            if (incremental.emittedText || attempt >= this.config.protocolRetries) {
              throw new NodexError(
                'upstream_protocol',
                'Agent did not produce one valid terminal protocol event',
              );
            }

            forceNew = false;
            message = JSON.stringify({
              type: 'protocol_error',
              message: 'Return exactly one terminal tool_call or final event.\nNo markdown or prose.',
              attempt: attempt + 1,
            });
          }
        }

        throw new NodexError('upstream_protocol', 'Protocol retry loop exhausted');
      } finally {
        clearTimeout(timeout);
        externalSignal.removeEventListener('abort', abort);
      }
    } finally {
      release();
    }
  }
}
