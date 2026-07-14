export type TurnRole = 'system' | 'developer' | 'user' | 'assistant';

export interface TextContentPart {
  type: 'text';
  text: string;
}

export interface ImageContentPart {
  type: 'image';
  fileId?: string;
  url?: string;
  detail: 'auto' | 'low' | 'high';
}

export interface FileContentPart {
  type: 'file';
  fileId?: string;
  filename?: string;
  data?: string;
}

export type TurnContentPart = TextContentPart | ImageContentPart | FileContentPart;

export interface TurnMessage {
  type: 'message';
  id?: string;
  role: TurnRole;
  content: TurnContentPart[];
  status?: 'in_progress' | 'completed' | 'incomplete';
  phase?: 'commentary' | 'final_answer';
}

export interface TurnFunctionCallOutput {
  type: 'function_call_output';
  id?: string;
  callId: string;
  output: string;
}

export interface TurnFunctionCall {
  type: 'function_call';
  id?: string;
  callId: string;
  name: string;
  arguments: string;
  status?: 'in_progress' | 'completed' | 'incomplete';
}

export interface TurnCustomToolCallOutput {
  type: 'custom_tool_call_output';
  id?: string;
  callId: string;
  output: string;
}

export interface TurnCustomToolCall {
  type: 'custom_tool_call';
  id?: string;
  callId: string;
  name: string;
  input: string;
  status?: 'in_progress' | 'completed' | 'incomplete';
}

export interface TurnImageGenerationCall {
  type: 'image_generation_call';
  id: string;
  fileId?: string;
}

export type TurnInputItem =
  | TurnMessage
  | TurnFunctionCall
  | TurnFunctionCallOutput
  | TurnCustomToolCall
  | TurnCustomToolCallOutput
  | TurnImageGenerationCall;

export interface TurnToolDefinition {
  type: 'function';
  name: string;
  description?: string;
  parameters: Record<string, unknown>;
  strict: boolean;
}

export interface TurnImageGenerationTool {
  type: 'image_generation';
  action: 'auto' | 'generate' | 'edit';
  model?: string;
  size: string;
  quality: 'auto' | 'low' | 'medium' | 'high';
  background: 'auto' | 'opaque' | 'transparent';
  outputFormat: 'png' | 'jpeg' | 'webp';
  outputCompression?: number;
  partialImages: number;
}

export interface TurnCustomToolDefinition {
  type: 'custom';
  name: string;
  description?: string;
  format?:
    | { type: 'text'; [key: string]: unknown }
    | { type: 'grammar'; syntax: 'lark' | 'regex'; definition: string; [key: string]: unknown };
}

export type NormalizedToolDefinition =
  | TurnToolDefinition
  | TurnCustomToolDefinition
  | TurnImageGenerationTool;

export type TurnToolChoice =
  | 'none'
  | 'auto'
  | 'required'
  | { type: 'function' | 'custom'; name: string };

export interface NormalizedTurn {
  model: string;
  input: TurnInputItem[];
  instructions?: string;
  stream: boolean;
  tools: NormalizedToolDefinition[];
  toolChoice: TurnToolChoice;
  parallelToolCalls: boolean;
  metadata: Record<string, string>;
  store: boolean;
  background: boolean;
  previousResponseId?: string;
  conversationId?: string;
  promptCacheKey?: string;
  reasoningSummary: 'auto' | 'concise' | 'detailed' | 'none';
}

export interface NormalizedToolCall {
  id: string;
  callId: string;
  name: string;
  arguments: string;
  status: 'completed';
}

export interface GeneratedImageResult {
  id: string;
  fileId: string;
  mimeType: string;
  base64: string;
  revisedPrompt?: string;
}

export type CoreTurnEvent =
  | {
      type: 'response_start';
      responseId: string;
      completionId: string;
      model: string;
      createdAt: number;
    }
  | { type: 'status'; event: import('../protocol/schema.js').StatusEvent }
  | { type: 'text_delta'; delta: string }
  | { type: 'tool_call'; event: import('../protocol/schema.js').ToolCallEvent }
  | { type: 'image_generation'; items: GeneratedImageResult[] }
  | { type: 'final'; event: import('../protocol/schema.js').FinalEvent }
  | { type: 'response_done'; result: import('../core.js').RunResult };
