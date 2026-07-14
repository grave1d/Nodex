import type { Conversation, ConversationItem } from '../session/store.js';
import type { TurnInputItem } from '../turn/types.js';

export function conversationObject(conversation: Conversation) {
  return {
    id: conversation.id,
    object: 'conversation',
    created_at: conversation.createdAt,
    metadata: conversation.metadata,
  };
}

export function conversationItemObject(item: ConversationItem) {
  const payload = item.payload as TurnInputItem;

  if (payload.type === 'message') {
    return {
      id: item.id,
      type: 'message',
      role: payload.role,
      status: payload.status ?? 'completed',
      ...(payload.phase ? { phase: payload.phase } : {}),
      content: payload.content.map((part) => {
        if (part.type === 'text') {
          return payload.role === 'assistant'
            ? { type: 'output_text', text: part.text, annotations: [] }
            : { type: 'input_text', text: part.text };
        }
        if (part.type === 'image') {
          return {
            type: 'input_image',
            ...(part.fileId ? { file_id: part.fileId } : {}),
            ...(part.url ? { image_url: part.url } : {}),
            detail: part.detail,
          };
        }
        return {
          type: 'input_file',
          ...(part.fileId ? { file_id: part.fileId } : {}),
          ...(part.filename ? { filename: part.filename } : {}),
        };
      }),
    };
  }

  if (payload.type === 'function_call') {
    return {
      id: item.id,
      type: 'function_call',
      call_id: payload.callId,
      name: payload.name,
      arguments: payload.arguments,
      status: payload.status ?? 'completed',
    };
  }

  if (payload.type === 'custom_tool_call') {
    return {
      id: item.id,
      type: 'custom_tool_call',
      call_id: payload.callId,
      name: payload.name,
      input: payload.input,
      status: payload.status ?? 'completed',
    };
  }

  if (payload.type === 'image_generation_call') {
    return {
      id: item.id,
      type: 'image_generation_call',
      ...(payload.fileId ? { nodex_file_id: payload.fileId } : {}),
    };
  }

  if (payload.type === 'function_call_output') {
    return {
      id: item.id,
      type: 'function_call_output',
      call_id: payload.callId,
      output: payload.output,
    };
  }

  return {
    id: item.id,
    type: 'custom_tool_call_output',
    call_id: payload.callId,
    output: payload.output,
  };
}
