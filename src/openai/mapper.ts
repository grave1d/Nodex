import type { ProtocolEvent, ToolCall } from '../protocol/schema.js';
import type { RunResult } from '../core.js';
import type { NormalizedTurn } from '../turn/types.js';

export function finalContent(text: string, summary?: string): string {
  const value = text.trim();

  if (value) return value;

  return summary?.trim() ?? '';
}

export function mapCompletion(
  events: ProtocolEvent[],
  model: string,
  id: string,
  created = Math.floor(Date.now() / 1000),
) {
  const statuses = events.filter((event) => event.type === 'status').map((event) => event.text);
  const terminal = events.at(-1);
  const toolCalls = terminal?.type === 'tool_call' ? terminal.calls : undefined;

  const content =
    terminal?.type === 'final'
      ? finalContent(terminal.text, terminal.summary)
      : statuses.length
        ? statuses.join('\n')
        : null;

  return {
    id,
    object: 'chat.completion',
    created,
    model,
    choices: [
      {
        index: 0,
        message: {
          role: 'assistant',
          content,
          ...(toolCalls ? { tool_calls: toolCalls.map(toOpenAIToolCall) } : {}),
        },
        finish_reason: toolCalls ? 'tool_calls' : 'stop',
      },
    ],
    usage: null,
  };
}

function responseOutput(
  result: RunResult,
): unknown[] {
  const events = result.events;
  const responseId = result.responseId;
  const terminal = events.at(-1);
  const output: unknown[] = [];
  const statuses = events
    .filter((event) => event.type === 'status')
    .map((event) => event.text.trim())
    .filter(Boolean);

  output.push(...statuses.map((text, index) => ({
    id: `msg_${responseId.slice(5)}_commentary_${index}`,
    type: 'message',
    role: 'assistant',
    phase: 'commentary',
    status: 'completed',
    content: [{ type: 'output_text', text, annotations: [] }],
  })));

  if (result.images?.length) {
    output.push(
      ...result.images.map((image) => ({
        id: image.id,
        type: 'image_generation_call',
        status: 'completed',
        result: image.base64,
        nodex_file_id: image.fileId,
      })),
    );
  } else if (terminal?.type === 'tool_call') {
    output.push(
      ...terminal.calls.map((call, index) => 'input' in call
        ? {
            id: `ctc_${responseId.slice(5)}_${index}`,
            type: 'custom_tool_call',
            call_id: call.id,
            name: call.name,
            input: call.input,
            status: 'completed',
          }
        : {
            id: `fc_${responseId.slice(5)}_${index}`,
            type: 'function_call',
            call_id: call.id,
            name: call.name,
            arguments: JSON.stringify(call.arguments),
            status: 'completed',
          }),
    );
  }

  if (terminal?.type === 'final') {
    output.push({
      id: `msg_${responseId.slice(5)}`,
      type: 'message',
      role: 'assistant',
      phase: 'final_answer',
      status: 'completed',
      content: [
        {
          type: 'output_text',
          text: finalContent(terminal.text, terminal.summary),
          annotations: [],
        },
      ],
    });
  }

  return output;
}

export function mapResponseTools(request: NormalizedTurn): unknown[] {
  return request.tools.map((tool) => {
    if (tool.type === 'function' || tool.type === 'custom') return tool;

    return {
      type: 'image_generation',
      action: tool.action,
      size: tool.size,
      quality: tool.quality,
      background: tool.background,
      output_format: tool.outputFormat,
      ...(tool.outputCompression === undefined
        ? {}
        : { output_compression: tool.outputCompression }),
      partial_images: tool.partialImages,
    };
  });
}

export function mapResponse(result: RunResult, request: NormalizedTurn) {
  return {
    id: result.responseId,
    object: 'response',
    created_at: result.createdAt,
    status: 'completed',
    background: request.background,
    error: null,
    incomplete_details: null,
    instructions: request.instructions ?? null,
    max_output_tokens: null,
    max_tool_calls: null,
    model: result.model,
    conversation: request.conversationId ? { id: request.conversationId } : null,
    output: responseOutput(result),
    parallel_tool_calls: request.parallelToolCalls,
    previous_response_id: request.previousResponseId ?? null,
    prompt_cache_key: request.promptCacheKey ?? null,
    reasoning: {
      effort: null,
      summary: request.reasoningSummary === 'none' ? null : request.reasoningSummary,
    },
    safety_identifier: null,
    service_tier: 'default',
    store: request.store,
    temperature: null,
    text: { format: { type: 'text' }, verbosity: 'medium' },
    tool_choice: request.toolChoice,
    tools: mapResponseTools(request),
    top_logprobs: 0,
    top_p: null,
    truncation: 'disabled',
    usage: null,
    user: null,
    metadata: request.metadata,
  };
}

export function toOpenAIToolCall(call: ToolCall) {
  return {
    id: call.id,
    type: 'function' as const,
    function: {
      name: call.name,
      arguments: 'arguments' in call ? JSON.stringify(call.arguments) : JSON.stringify({ input: call.input }),
    },
  };
}

export function mapChunks(
  events: ProtocolEvent[],
  model: string,
  id: string,
  created = Math.floor(Date.now() / 1000),
) {
  const chunks: unknown[] = [
    {
      id,
      object: 'chat.completion.chunk',
      created,
      model,
      choices: [
        {
          index: 0,
          delta: { role: 'assistant' },
          finish_reason: null,
        },
      ],
    },
  ];

  for (const event of events) {
    if (event.type === 'tool_call') {
      event.calls.forEach((call, index) => {
        chunks.push({
          id,
          object: 'chat.completion.chunk',
          created,
          model,
          choices: [
            {
              index: 0,
              delta: {
                tool_calls: [{ index, ...toOpenAIToolCall(call) }],
              },
              finish_reason: null,
            },
          ],
        });
      });
    }

    if (event.type === 'final') {
      const content = finalContent(event.text, event.summary);

      if (content) {
        chunks.push({
          id,
          object: 'chat.completion.chunk',
          created,
          model,
          choices: [
            {
              index: 0,
              delta: { content },
              finish_reason: null,
            },
          ],
        });
      }
    }
  }

  const terminal = events.at(-1);

  chunks.push({
    id,
    object: 'chat.completion.chunk',
    created,
    model,
    choices: [
      {
        index: 0,
        delta: {},
        finish_reason: terminal?.type === 'tool_call' ? 'tool_calls' : 'stop',
      },
    ],
  });

  return chunks;
}
