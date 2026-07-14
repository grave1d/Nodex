import type { RunResult } from '../core.js';
import { normalizeApiError } from '../http/errors.js';
import type { CoreTurnEvent, NormalizedTurn } from '../turn/types.js';
import { mapResponse, mapResponseTools } from './mapper.js';

interface StreamIdentity {
  responseId: string;
  model: string;
  createdAt: number;
}

function inProgressResponse(identity: StreamIdentity, request: NormalizedTurn) {
  return {
    id: identity.responseId,
    object: 'response',
    created_at: identity.createdAt,
    status: 'in_progress',
    background: request.background,
    error: null,
    incomplete_details: null,
    instructions: request.instructions ?? null,
    max_output_tokens: null,
    model: identity.model,
    conversation: request.conversationId ? { id: request.conversationId } : null,
    output: [],
    parallel_tool_calls: request.parallelToolCalls,
    previous_response_id: request.previousResponseId ?? null,
    reasoning: {
      effort: null,
      summary: request.reasoningSummary === 'none' ? null : request.reasoningSummary,
    },
    store: request.store,
    text: { format: { type: 'text' }, verbosity: 'medium' },
    tool_choice: request.toolChoice,
    tools: mapResponseTools(request),
    truncation: 'disabled',
    usage: null,
    metadata: request.metadata,
  };
}

export class ResponsesStreamMapper {
  private sequence = 0;
  private identity?: StreamIdentity;
  private textStarted = false;
  private nextOutputIndex = 0;
  private finalOutputIndex?: number;
  private commentaryCount = 0;

  constructor(private readonly request: NormalizedTurn) {}

  private event<T extends Record<string, unknown>>(value: T): T & { sequence_number: number } {
    return { ...value, sequence_number: this.sequence++ };
  }

  map(coreEvent: CoreTurnEvent): unknown[] {
    switch (coreEvent.type) {
      case 'response_start': {
        this.identity = {
          responseId: coreEvent.responseId,
          model: coreEvent.model,
          createdAt: coreEvent.createdAt,
        };

        const response = inProgressResponse(this.identity, this.request);

        return [
          this.event({ type: 'response.created', response }),
          this.event({ type: 'response.in_progress', response }),
        ];
      }

      case 'status': {
        const identity = this.requireIdentity();
        const outputIndex = this.nextOutputIndex++;
        const itemId = `msg_${identity.responseId.slice(5)}_commentary_${this.commentaryCount++}`;
        const text = coreEvent.event.text;

        return [
          this.event({
            type: 'response.output_item.added',
            output_index: outputIndex,
            item: {
              id: itemId,
              type: 'message',
              role: 'assistant',
              phase: 'commentary',
              status: 'in_progress',
              content: [],
            },
          }),
          this.event({
            type: 'response.content_part.added',
            item_id: itemId,
            output_index: outputIndex,
            content_index: 0,
            part: { type: 'output_text', text: '', annotations: [] },
          }),
          this.event({
            type: 'response.output_text.delta',
            item_id: itemId,
            output_index: outputIndex,
            content_index: 0,
            delta: text,
            logprobs: [],
          }),
          this.event({
            type: 'response.output_text.done',
            item_id: itemId,
            output_index: outputIndex,
            content_index: 0,
            text,
            logprobs: [],
          }),
          this.event({
            type: 'response.content_part.done',
            item_id: itemId,
            output_index: outputIndex,
            content_index: 0,
            part: { type: 'output_text', text, annotations: [] },
          }),
          this.event({
            type: 'response.output_item.done',
            output_index: outputIndex,
            item: {
              id: itemId,
              type: 'message',
              role: 'assistant',
              phase: 'commentary',
              status: 'completed',
              content: [{ type: 'output_text', text, annotations: [] }],
            },
          }),
        ];
      }

      case 'text_delta': {
        const identity = this.requireIdentity();
        const itemId = `msg_${identity.responseId.slice(5)}`;
        const events: unknown[] = [];

        if (!this.textStarted) {
          this.textStarted = true;
          this.finalOutputIndex = this.nextOutputIndex++;

          events.push(
            this.event({
              type: 'response.output_item.added',
              output_index: this.finalOutputIndex,
              item: {
                id: itemId,
                type: 'message',
                role: 'assistant',
                phase: 'final_answer',
                status: 'in_progress',
                content: [],
              },
            }),
            this.event({
              type: 'response.content_part.added',
              item_id: itemId,
              output_index: this.finalOutputIndex,
              content_index: 0,
              part: { type: 'output_text', text: '', annotations: [] },
            }),
          );
        }

        events.push(
          this.event({
            type: 'response.output_text.delta',
            item_id: itemId,
            output_index: this.finalOutputIndex,
            content_index: 0,
            delta: coreEvent.delta,
            logprobs: [],
          }),
        );

        return events;
      }

      case 'final': {
        const identity = this.requireIdentity();
        const itemId = `msg_${identity.responseId.slice(5)}`;
        const events: unknown[] = [];

        if (!this.textStarted) {
          events.push(...this.map({ type: 'text_delta', delta: coreEvent.event.text }));
        }
        const outputIndex = this.finalOutputIndex ?? this.nextOutputIndex++;

        events.push(
          this.event({
            type: 'response.output_text.done',
            item_id: itemId,
            output_index: outputIndex,
            content_index: 0,
            text: coreEvent.event.text,
            logprobs: [],
          }),
          this.event({
            type: 'response.content_part.done',
            item_id: itemId,
            output_index: outputIndex,
            content_index: 0,
            part: { type: 'output_text', text: coreEvent.event.text, annotations: [] },
          }),
          this.event({
            type: 'response.output_item.done',
            output_index: outputIndex,
            item: {
              id: itemId,
              type: 'message',
              role: 'assistant',
              phase: 'final_answer',
              status: 'completed',
              content: [
                {
                  type: 'output_text',
                  text: coreEvent.event.text,
                  annotations: [],
                },
              ],
            },
          }),
        );

        return events;
      }

      case 'tool_call': {
        const identity = this.requireIdentity();

        return coreEvent.event.calls.flatMap<unknown>((call, callIndex): unknown[] => {
          const outputIndex = this.nextOutputIndex++;

          if ('input' in call) {
            const itemId = `ctc_${identity.responseId.slice(5)}_${callIndex}`;

            return [
                this.event({
                  type: 'response.output_item.added',
                  output_index: outputIndex,
                  item: {
                    id: itemId,
                    type: 'custom_tool_call',
                    call_id: call.id,
                    name: call.name,
                    input: '',
                    status: 'in_progress',
                  },
                }),
                this.event({
                  type: 'response.custom_tool_call_input.delta',
                  item_id: itemId,
                  call_id: call.id,
                  output_index: outputIndex,
                  delta: call.input,
                }),
                this.event({
                  type: 'response.custom_tool_call_input.done',
                  item_id: itemId,
                  call_id: call.id,
                  output_index: outputIndex,
                  input: call.input,
                }),
                this.event({
                  type: 'response.output_item.done',
                  output_index: outputIndex,
                  item: {
                    id: itemId,
                    type: 'custom_tool_call',
                    call_id: call.id,
                    name: call.name,
                    input: call.input,
                    status: 'completed',
                  },
                }),
            ];
          }

          const itemId = `fc_${identity.responseId.slice(5)}_${callIndex}`;
          const argumentsText = JSON.stringify(call.arguments);

          return [
              this.event({
                type: 'response.output_item.added',
                output_index: outputIndex,
                item: {
                  id: itemId,
                  type: 'function_call',
                  call_id: call.id,
                  name: call.name,
                  arguments: '',
                  status: 'in_progress',
                },
              }),
              this.event({
                type: 'response.function_call_arguments.delta',
                item_id: itemId,
                output_index: outputIndex,
                delta: argumentsText,
              }),
              this.event({
                type: 'response.function_call_arguments.done',
                item_id: itemId,
                output_index: outputIndex,
                arguments: argumentsText,
              }),
              this.event({
                type: 'response.output_item.done',
                output_index: outputIndex,
                item: {
                  id: itemId,
                  type: 'function_call',
                  call_id: call.id,
                  name: call.name,
                  arguments: argumentsText,
                  status: 'completed',
                },
              }),
          ];
        });
      }

      case 'image_generation': {
        return coreEvent.items.flatMap((image) => {
          const outputIndex = this.nextOutputIndex++;
          const item = {
            id: image.id,
            type: 'image_generation_call',
            status: 'completed',
            result: image.base64,
            nodex_file_id: image.fileId,
          };

          return [
              this.event({
                type: 'response.output_item.added',
                output_index: outputIndex,
                item: { ...item, status: 'in_progress', result: null },
              }),
              this.event({
                type: 'response.image_generation_call.completed',
                item_id: image.id,
                output_index: outputIndex,
              }),
              this.event({
                type: 'response.output_item.done',
                output_index: outputIndex,
                item,
              }),
          ];
        });
      }

      case 'response_done':
        return [
          this.event({
            type: 'response.completed',
            response: mapResponse(coreEvent.result, this.request),
          }),
        ];

      default:
        return [];
    }
  }

  fail(error: unknown, requestId?: string): unknown[] {
    const identity = this.requireIdentity();
    const body = normalizeApiError(error, requestId).error;
    const response = {
      ...inProgressResponse(identity, this.request),
      status: 'failed',
      error: body,
    };

    const { type: errorType, ...errorPayload } = body;

    return [
      this.event({
        type: 'error',
        error: {
          type: errorType,
          ...errorPayload,
        },
      }),
      this.event({ type: 'response.failed', response }),
    ];
  }

  private requireIdentity(): StreamIdentity {
    if (!this.identity) {
      throw new Error('Responses stream has no response identity');
    }

    return this.identity;
  }
}

export function resultFromDone(event: CoreTurnEvent): RunResult | undefined {
  if (event.type !== 'response_done') {
    return undefined;
  }

  return event.result;
}
