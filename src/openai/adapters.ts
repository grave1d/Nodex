import { contentToText } from './content.js';
import { NodexError } from '../errors.js';
import type {
  ResponseCustomTool,
  ResponseFunctionTool,
  ResponseImageGenerationTool,
  ResponseInputItem,
  ResponseRequest,
  ResponseTool,
} from './responses.js';
import type { ChatRequest } from './types.js';
import type {
  NormalizedTurn,
  TurnContentPart,
  TurnInputItem,
  TurnCustomToolDefinition,
  TurnMessage,
  TurnToolDefinition,
} from '../turn/types.js';

function stringifyUnknown(value: unknown): string {
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : undefined;
}

function optionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value ? value : undefined;
}

function detailValue(value: unknown): 'auto' | 'low' | 'high' {
  return value === 'low' || value === 'high' ? value : 'auto';
}

function statusValue(value: unknown): 'in_progress' | 'completed' | 'incomplete' | undefined {
  return value === 'in_progress' || value === 'completed' || value === 'incomplete' ? value : undefined;
}

function roleValue(value: unknown): TurnMessage['role'] | undefined {
  return value === 'user' || value === 'developer' || value === 'system' || value === 'assistant'
    ? value
    : undefined;
}

function imageUrlValue(value: unknown): string | undefined {
  if (typeof value === 'string' && value) return value;
  const record = asRecord(value);
  return optionalString(record?.['url']);
}

function toolName(tool: ResponseTool): string | undefined {
  const record = asRecord(tool);
  return optionalString(record?.['name']);
}

function isResponseFunctionTool(tool: ResponseTool): tool is ResponseFunctionTool {
  return tool.type === 'function' && typeof (tool as Record<string, unknown>)['name'] === 'string';
}

function isResponseCustomTool(tool: ResponseTool): tool is ResponseCustomTool {
  return tool.type === 'custom' && typeof (tool as Record<string, unknown>)['name'] === 'string';
}

function isResponseImageGenerationTool(tool: ResponseTool): tool is ResponseImageGenerationTool {
  return tool.type === 'image_generation';
}

function customToolFormat(value: ResponseCustomTool['format']): TurnCustomToolDefinition['format'] | undefined {
  const record = asRecord(value);
  if (!record) return undefined;

  if (record['type'] === 'text') {
    return { ...record, type: 'text' };
  }

  if (
    record['type'] === 'grammar' &&
    (record['syntax'] === 'lark' || record['syntax'] === 'regex') &&
    typeof record['definition'] === 'string'
  ) {
    return {
      ...record,
      type: 'grammar',
      syntax: record['syntax'],
      definition: record['definition'],
    };
  }

  return undefined;
}

function normalizeResponseTools(tools: ResponseRequest['tools']): NormalizedTurn['tools'] {
  const normalized: NormalizedTurn['tools'] = [];

  for (const tool of tools) {
    if (isResponseFunctionTool(tool)) {
      normalized.push({
        type: 'function',
        name: tool.name,
        ...(tool.description ? { description: tool.description } : {}),
        parameters: tool.parameters,
        strict: tool.strict,
      });
      continue;
    }

    if (isResponseCustomTool(tool)) {
      const format = customToolFormat(tool.format);
      normalized.push({
        type: 'custom',
        name: tool.name,
        ...(tool.description ? { description: tool.description } : {}),
        ...(format ? { format } : {}),
      });
      continue;
    }

    if (isResponseImageGenerationTool(tool)) {
      normalized.push({
        type: 'image_generation',
        action: tool.action,
        ...(tool.model ? { model: tool.model } : {}),
        size: tool.size,
        quality: tool.quality,
        background: tool.background,
        outputFormat: tool.output_format,
        ...(tool.output_compression === undefined ? {} : { outputCompression: tool.output_compression }),
        partialImages: tool.partial_images,
      });
      continue;
    }

    // Hosted/client-side tools from Codex, for example shell/local_shell/browser/computer,
    // are valid Responses API payloads but are not Notion Custom Agent tools.
    // Accept them at the HTTP compatibility layer and omit them from the Notion turn.
  }

  return normalized;
}

function normalizeContentPart(value: unknown): TurnContentPart | undefined {
  if (typeof value === 'string') {
    return { type: 'text', text: value };
  }

  const part = asRecord(value);
  if (!part) return undefined;

  const type = optionalString(part['type']);

  if (type === 'input_text' || type === 'output_text' || type === 'text') {
    const text = optionalString(part['text']) ?? optionalString(part['content']);
    return text === undefined ? undefined : { type: 'text', text };
  }

  if (type === 'input_image') {
    const fileId = optionalString(part['file_id']);
    const url = imageUrlValue(part['image_url']);
    if (!fileId && !url) return undefined;
    return {
      type: 'image',
      ...(fileId ? { fileId } : {}),
      ...(url ? { url } : {}),
      detail: detailValue(part['detail']),
    };
  }

  if (type === 'input_file') {
    const fileId = optionalString(part['file_id']);
    const filename = optionalString(part['filename']);
    const data = optionalString(part['file_data']);
    if (!fileId && !data) return undefined;
    return {
      type: 'file',
      ...(fileId ? { fileId } : {}),
      ...(filename ? { filename } : {}),
      ...(data ? { data } : {}),
    };
  }

  const text = optionalString(part['text']) ?? optionalString(part['content']);
  return text === undefined ? undefined : { type: 'text', text };
}

function normalizeResponseMessage(item: ResponseInputItem): TurnMessage | undefined {
  const record = asRecord(item);
  if (!record) return undefined;

  const role = roleValue(record['role']);
  if (!role) return undefined;

  const rawContent = record['content'];
  const content: TurnContentPart[] =
    typeof rawContent === 'string'
      ? [{ type: 'text', text: rawContent }]
      : Array.isArray(rawContent)
        ? rawContent.flatMap((part): TurnContentPart[] => {
            const normalized = normalizeContentPart(part);
            return normalized ? [normalized] : [];
          })
        : [];

  if (!content.length) return undefined;

  const message: TurnMessage = {
    type: 'message',
    role,
    content,
  };

  const id = optionalString(record['id']);
  if (id) message.id = id;

  const status = statusValue(record['status']);
  if (status) message.status = status;

  if (record['phase'] === 'commentary' || record['phase'] === 'final_answer') {
    message.phase = record['phase'];
  }

  return message;
}

function embeddedResponseTools(request: ResponseRequest): ResponseTool[] {
  if (typeof request.input === 'string') return [];

  return request.input.flatMap((item): ResponseTool[] => {
    const record = asRecord(item);
    if (record?.['type'] !== 'additional_tools' || !Array.isArray(record['tools'])) return [];
    return record['tools'] as ResponseTool[];
  });
}

function mergedResponseTools(request: ResponseRequest): ResponseTool[] {
  const merged: ResponseTool[] = [];
  const named = new Map<string, string>();

  for (const tool of [...request.tools, ...embeddedResponseTools(request)]) {
    if (tool.type === 'image_generation') {
      merged.push(tool);
      continue;
    }

    const name = toolName(tool);
    if (!name) {
      merged.push(tool);
      continue;
    }

    const key = `${tool.type}:${name}`;
    const serialized = JSON.stringify(tool);
    const previous = named.get(key);

    if (previous === serialized) continue;

    if (previous !== undefined) {
      throw new NodexError('invalid_request', `Conflicting tool definition: ${name}`);
    }

    named.set(key, serialized);
    merged.push(tool);
  }

  return merged;
}

export function normalizeResponseRequest(request: ResponseRequest): NormalizedTurn {
  const input: TurnInputItem[] =
    typeof request.input === 'string'
      ? [{ type: 'message', role: 'user', content: [{ type: 'text', text: request.input }] }]
      : normalizeResponseItems(request.input);

  return {
    model: request.model,
    input,
    ...(request.instructions ? { instructions: request.instructions } : {}),
    stream: request.stream,
    tools: normalizeResponseTools(mergedResponseTools(request)),
    toolChoice: request.tool_choice,
    parallelToolCalls: request.parallel_tool_calls,
    metadata: request.metadata,
    store: request.store,
    background: request.background,
    ...(request.previous_response_id ? { previousResponseId: request.previous_response_id } : {}),
    ...(request.conversation
      ? { conversationId: typeof request.conversation === 'string' ? request.conversation : request.conversation.id }
      : {}),
    ...(request.prompt_cache_key ? { promptCacheKey: request.prompt_cache_key } : {}),
    reasoningSummary:
      request.model_supports_reasoning_summaries === false
        ? 'none'
        : request.model_reasoning_summary ?? request.reasoning?.summary ?? 'auto',
  };
}

export function normalizeResponseItems(items: ResponseInputItem[]): TurnInputItem[] {
  return items.flatMap((item): TurnInputItem[] => {
    if (typeof item === 'string') {
      return [{ type: 'message', role: 'user', content: [{ type: 'text', text: item }] }];
    }

    const record = asRecord(item);
    if (!record) return [];

    switch (record['type']) {
      case 'message': {
        const message = normalizeResponseMessage(item);
        return message ? [message] : [];
      }

      case 'function_call': {
        const callId = optionalString(record['call_id']);
        const name = optionalString(record['name']);
        if (!callId || !name) return [];

        const functionCall: TurnInputItem = {
          type: 'function_call',
          callId,
          name,
          arguments: stringifyUnknown(record['arguments']),
        };

        const id = optionalString(record['id']);
        if (id) functionCall.id = id;

        const status = statusValue(record['status']);
        if (status) functionCall.status = status;

        return [functionCall];
      }

      case 'custom_tool_call': {
        const callId = optionalString(record['call_id']);
        const name = optionalString(record['name']);
        if (!callId || !name || record['input'] === undefined) return [];

        const customCall: TurnInputItem = {
          type: 'custom_tool_call',
          callId,
          name,
          input: stringifyUnknown(record['input']),
        };

        const id = optionalString(record['id']);
        if (id) customCall.id = id;

        const status = statusValue(record['status']);
        if (status) customCall.status = status;

        return [customCall];
      }

      case 'image_generation_call': {
        const id = optionalString(record['id']);
        const fileId = optionalString(record['file_id']) ?? optionalString(record['nodex_file_id']);
        if (!id) return [];

        const imageCall: TurnInputItem = { type: 'image_generation_call', id };
        if (fileId) imageCall.fileId = fileId;

        return [imageCall];
      }

      case 'function_call_output': {
        const callId = optionalString(record['call_id']);
        if (!callId) return [];

        const output: TurnInputItem = {
          type: 'function_call_output',
          callId,
          output: stringifyUnknown(record['output']),
        };

        const id = optionalString(record['id']);
        if (id) output.id = id;

        return [output];
      }

      case 'custom_tool_call_output': {
        const callId = optionalString(record['call_id']);
        if (!callId) return [];

        const output: TurnInputItem = {
          type: 'custom_tool_call_output',
          callId,
          output: stringifyUnknown(record['output']),
        };

        const id = optionalString(record['id']);
        if (id) output.id = id;

        return [output];
      }

      case 'additional_tools':
      case 'reasoning':
      case 'shell_call':
      case 'local_shell_call':
      case 'shell_call_output':
      case 'local_shell_call_output':
        return [];

      default: {
        const message = normalizeResponseMessage(item);
        return message ? [message] : [];
      }
    }
  });
}

function chatTools(request: ChatRequest): TurnToolDefinition[] {
  return request.tools.map((tool) => ({
    type: 'function',
    name: tool.function.name,
    ...(tool.function.description ? { description: tool.function.description } : {}),
    parameters: tool.function.parameters ?? {},
    strict: tool.function.strict ?? false,
  }));
}

export function normalizeChatRequest(request: ChatRequest): NormalizedTurn {
  const input: TurnInputItem[] = request.messages.flatMap((message): TurnInputItem[] => {
    if (message.role === 'tool') {
      return [
        {
          type: 'function_call_output',
          callId: message.tool_call_id ?? '',
          output: contentToText(message.content),
        },
      ];
    }

    const result: TurnInputItem[] = [];

    if (message.content != null) {
      result.push({
        type: 'message',
        role: message.role,
        content: [{ type: 'text', text: contentToText(message.content) }],
      });
    }

    for (const call of message.tool_calls ?? []) {
      result.push({
        type: 'function_call',
        id: call.id,
        callId: call.id,
        name: call.function.name,
        arguments: call.function.arguments,
        status: 'completed',
      });
    }

    return result;
  });

  return {
    model: request.model,
    input,
    stream: request.stream,
    tools: chatTools(request),
    toolChoice: typeof request.tool_choice === 'object' ? { type: 'function', name: request.tool_choice.function.name } : request.tool_choice,
    parallelToolCalls: true,
    metadata: {},
    store: true,
    background: false,
    reasoningSummary: 'none',
  };
}
