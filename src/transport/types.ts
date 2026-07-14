import type { Credentials } from '../auth/credentials.js';
import type { Readable } from 'node:stream';

export interface AgentBinding {
  agentPageId: string;
  agentName: string;
  notionModel: string;
  notionModelSlug?: string | undefined;
  syncNotionModel?: boolean | undefined;
  capabilities: {
    reasoningSummaries: boolean;
    functionCalling: boolean;
    imageInput: boolean;
    fileInput: boolean;
    imageGeneration: boolean;
    imageEdit: boolean;
  };
}
export interface PreflightInfo { userId: string; userName: string; userEmail: string; workspaceId: string; workspaceName: string; spaceViewId: string }
export interface TransportAttachment {
  kind: 'image' | 'file';
  order: number;
  fileId: string;
  filename: string;
  mimeType: string;
  bytes: number;
  detail?: 'auto' | 'low' | 'high';
  open(): Readable;
}
export interface TransportRequest {
  requestId?: string;
  threadId: string;
  newThread: boolean;
  message: string;
  agent: AgentBinding;
  state: string;
  signal: AbortSignal;
  attachments: TransportAttachment[];
}
export interface TransportTurn { chunks: AsyncIterable<string>; nextState: string }

export interface NotionTransport {
  readonly attachmentCapabilities: { imageInput: boolean; fileInput: boolean };
  preflight(credentials?: Credentials): Promise<PreflightInfo>;
  send(request: TransportRequest): Promise<TransportTurn>;
}
