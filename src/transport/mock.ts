import { randomUUID } from 'node:crypto';
import type { NotionTransport, PreflightInfo, TransportRequest, TransportTurn } from './types.js';

export class MockTransport implements NotionTransport {
  readonly attachmentCapabilities = { imageInput: true, fileInput: true };
  async preflight(): Promise<PreflightInfo> {
    return { userId: 'mock-user', userName: 'Mock User', userEmail: 'mock@example.invalid', workspaceId: 'mock-space', workspaceName: 'Mock Workspace', spaceViewId: 'mock-view' };
  }

  async send(request: TransportRequest): Promise<TransportTurn> {
    let stage = 0;
    try { stage = (JSON.parse(request.state) as { stage?: number }).stage ?? 0; } catch { /* first turn */ }
    const scenarios = [
      { status: 'Читаю проект', name: 'read_file', arguments: { path: 'README.md' } },
      { status: 'Правлю файл', name: 'edit_file', arguments: { path: 'README.md', patch: 'mock' } },
      { status: 'Запускаю проверку', name: 'run_command', arguments: { command: 'npm test' } },
    ];
    const scenario = scenarios[stage];
    const response = request.message.includes('NO_TOOL')
      ? JSON.stringify({ type: 'final', text: 'Mock ответ' })
      : scenario
        ? `${JSON.stringify({ type: 'status', text: scenario.status })}\n${JSON.stringify({ type: 'tool_call', calls: [{ id: `call_${randomUUID()}`, name: scenario.name, arguments: scenario.arguments }] })}`
        : `${JSON.stringify({ type: 'status', text: 'Результаты приняты' })}\n${JSON.stringify({ type: 'final', text: 'Mock tool-цикл завершён' })}`;
    async function* chunks(): AsyncIterable<string> {
      for (const part of response.match(/.{1,17}/gs) ?? []) yield part;
    }
    return { chunks: chunks(), nextState: JSON.stringify({ stage: request.message.includes('NO_TOOL') ? stage : stage + 1 }) };
  }
}
