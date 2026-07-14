import { randomUUID } from 'node:crypto';
import dns from 'node:dns';
import type { LookupFunction } from 'node:net';
import { Agent, fetch as undiciFetch } from 'undici';
import type { Credentials } from '../auth/credentials.js';
import { loadCredentials } from '../auth/credentials.js';
import { NodexError, parseRetryAfter } from '../errors.js';
import { KeyedMutex } from '../session/mutex.js';
import {
  bindingInstructionsPageId,
  type AgentBinding,
  type DiscoveredNotionAgent,
  type NotionTransport,
  type PreflightInfo,
  type TransportRequest,
  type TransportTurn,
} from './types.js';

const BASE_URL = 'https://www.notion.so/api/v3';
let addressCursor = 0;
const rotatingLookup: LookupFunction = (hostname, options, callback) => {
  dns.lookup(hostname, { ...options, all: true }, (error, addresses) => {
    if (error) { callback(error, ''); return; }
    const ipv4 = addresses.filter((address) => address.family === 4);
    const candidates = ipv4.length ? ipv4 : addresses;
    if (!candidates.length) { callback(Object.assign(new Error(`No addresses for ${hostname}`), { code: 'ENOTFOUND' }), ''); return; }
    const selected = candidates[addressCursor++ % candidates.length];
    if (!selected) { callback(Object.assign(new Error(`No selected address for ${hostname}`), { code: 'ENOTFOUND' }), ''); return; }
    if (options.all) callback(null, [selected]);
    else callback(null, selected.address, selected.family);
  });
};
const notionDispatcher = new Agent({
  connect: { autoSelectFamily: false, lookup: rotatingLookup },
  keepAliveTimeout: 1000,
  keepAliveMaxTimeout: 5000,
});
type FetchInit = NonNullable<Parameters<typeof undiciFetch>[1]>;
function isConnectFailure(error: unknown): boolean {
  const direct = error && typeof error === 'object' ? (error as { code?: unknown }).code : undefined;
  const cause = error && typeof error === 'object' ? (error as { cause?: { code?: unknown } }).cause?.code : undefined;
  return ['UND_ERR_CONNECT_TIMEOUT', 'ETIMEDOUT', 'ENETUNREACH', 'EHOSTUNREACH', 'ECONNREFUSED'].includes(String(cause ?? direct));
}
async function notionFetch(path: string, init: FetchInit) {
  for (let attempt = 0; ; attempt += 1) {
    try { return await undiciFetch(`${BASE_URL}/${path}`, { ...init, dispatcher: notionDispatcher }); }
    catch (error) {
      if (attempt >= 1 || init.signal?.aborted || !isConnectFailure(error)) throw error;
    }
  }
}
type NotionResponse = Awaited<ReturnType<typeof notionFetch>>;
export type NotionFetcher = (path: string, init: FetchInit) => Promise<NotionResponse>;

const KNOWN_MODEL_SLUGS: Readonly<Record<string, string>> = {
  'GPT-5.6 Sol': 'orange-mousse',
  'orange-mousse': 'orange-mousse',
};
const KNOWN_MODEL_NAMES: Readonly<Record<string, string>> = Object.fromEntries(
  Object.entries(KNOWN_MODEL_SLUGS).filter(([name, slug]) => name !== slug).map(([name, slug]) => [slug, name]),
);

interface Account extends PreflightInfo { credentials: Credentials }
interface ThreadState { configId: string; contextId: string; originalDatetime: string; notionModel: string; updatedConfigIds: string[] }

function headers(credentials: Credentials, userId?: string): Record<string, string> {
  return {
    accept: 'application/x-ndjson, application/json',
    'content-type': 'application/json',
    origin: 'https://www.notion.so',
    referer: 'https://www.notion.so/',
    'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/138.0.0.0 Safari/537.36',
    cookie: `token_v2=${credentials.token_v2}; notion_browser_id=${credentials.notion_browser_id}`,
    ...(userId ? { 'x-notion-active-user-header': userId } : {}),
  };
}

function unwrap(record: unknown): Record<string, unknown> {
  if (!record || typeof record !== 'object') return {};
  const value = (record as { value?: unknown }).value;
  if (!value || typeof value !== 'object') return record as Record<string, unknown>;
  const inner = (value as { value?: unknown }).value;
  return inner && typeof inner === 'object' ? inner as Record<string, unknown> : value as Record<string, unknown>;
}

function extractAccount(data: unknown, credentials: Credentials): Account {
  const recordMap = data && typeof data === 'object' ? (data as { recordMap?: unknown }).recordMap : undefined;
  if (!recordMap || typeof recordMap !== 'object') throw new NodexError('auth', 'Notion authentication failed. Run: nodex auth');
  const map = recordMap as Record<string, unknown>;
  const users = map['notion_user'] as Record<string, unknown> | undefined;
  const spaces = map['space'] as Record<string, unknown> | undefined;
  const views = map['space_view'] as Record<string, unknown> | undefined;
  const userEntry = Object.entries(users ?? {})[0];
  const spaceEntry = Object.entries(spaces ?? {})[0];
  if (!userEntry || !spaceEntry) throw new NodexError('auth', 'Notion credentials expired or workspace unavailable. Run: nodex auth');
  const user = unwrap(userEntry[1]);
  const space = unwrap(spaceEntry[1]);
  const viewEntry = Object.entries(views ?? {}).find(([, record]) => unwrap(record)['space_id'] === spaceEntry[0]);
  const given = typeof user['given_name'] === 'string' ? user['given_name'] : '';
  const family = typeof user['family_name'] === 'string' ? user['family_name'] : '';
  return {
    credentials,
    userId: userEntry[0], userName: `${given} ${family}`.trim(), userEmail: typeof user['email'] === 'string' ? user['email'] : '',
    workspaceId: spaceEntry[0], workspaceName: typeof space['name'] === 'string' ? space['name'] : '', spaceViewId: viewEntry?.[0] ?? '',
  };
}

function configValue(model: string, subsequent: boolean): Record<string, unknown> {
  return {
    type: 'workflow', modelFromUser: !subsequent, enableAgentAutomations: true, enableAgentIntegrations: true,
    enableCustomAgents: true, enableAgentDiffs: true, enableAgentUpdatePagePatch: true,
    enableScriptAgent: true, enableScriptAgentCustomToolCalling: true, enableCreateAndRunThread: true,
    useWebSearch: true, searchScopes: [{ type: 'everything' }], useReadOnlyMode: false,
    model, isCustomAgent: false, isCustomAgentBuilder: false, isMobile: false,
    ...(subsequent ? { isThreadStartedByAdmin: true } : {}),
  };
}

function contextValue(account: Account, agent: AgentBinding, originalDatetime: string, workflowId: string): Record<string, unknown> {
  return {
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone, userName: account.userName, userId: account.userId,
    userEmail: account.userEmail, spaceName: account.workspaceName, spaceId: account.workspaceId,
    spaceViewId: account.spaceViewId, currentDatetime: originalDatetime, surface: 'custom_agent', workflowId,
    agentName: agent.agentName, context_page_id: bindingInstructionsPageId(agent),
  };
}

function textValue(value: unknown): string | undefined {
  if (typeof value === 'string') return value.trim() || undefined;
  if (Array.isArray(value)) {
    const joined = value.map(textValue).filter((part): part is string => Boolean(part)).join('');
    return joined || undefined;
  }
  if (!value || typeof value !== 'object') return undefined;
  const record = value as Record<string, unknown>;
  for (const key of ['name', 'title', 'displayName', 'display_name', 'plain_text', 'text', 'content']) {
    const found = textValue(record[key]);
    if (found) return found;
  }
  return undefined;
}

function workflowRecords(syncResponse: unknown): Record<string, unknown> {
  if (!syncResponse || typeof syncResponse !== 'object') return {};
  const recordMap = (syncResponse as { recordMap?: unknown }).recordMap;
  if (!recordMap || typeof recordMap !== 'object') return {};
  const workflows = (recordMap as Record<string, unknown>)['workflow'];
  return workflows && typeof workflows === 'object' ? workflows as Record<string, unknown> : {};
}

export function normalizeNotionId(value: string): string {
  return value.replaceAll('-', '').toLowerCase();
}

export function sameNotionId(left: string, right: string): boolean {
  return normalizeNotionId(left) === normalizeNotionId(right);
}

export function discoveredAgentsFromRecords(
  syncResponse: unknown,
  workflowIds: readonly string[],
  space: { id: string; name?: string },
): DiscoveredNotionAgent[] {
  const workflows = workflowRecords(syncResponse);
  const result: DiscoveredNotionAgent[] = [];

  for (const workflowId of workflowIds) {
    const entry = Object.entries(workflows).find(([id]) => sameNotionId(id, workflowId));
    if (!entry) continue;
    const value = unwrap(entry[1]);
    const data = value['data'];
    const details = data && typeof data === 'object' ? data as Record<string, unknown> : {};
    const instructions = details['instructions'];
    const instructionsPageId = instructions && typeof instructions === 'object'
      ? (instructions as Record<string, unknown>)['id']
      : undefined;
    if (typeof instructionsPageId !== 'string' || !instructionsPageId) continue;

    const model = details['model'];
    const modelRecord = model && typeof model === 'object' ? model as Record<string, unknown> : {};
    const modelSlug = typeof modelRecord['type'] === 'string' && modelRecord['type']
      ? modelRecord['type']
      : undefined;
    const modelName = textValue(modelRecord['displayName'])
      ?? textValue(modelRecord['name'])
      ?? (modelSlug ? KNOWN_MODEL_NAMES[modelSlug] : undefined);
    const name = textValue(details['name'])
      ?? textValue(details['title'])
      ?? textValue(value['name'])
      ?? textValue(value['title'])
      ?? 'Custom Agent';
    const resolvedWorkflowId = entry[0];

    result.push({
      name,
      workflowId: resolvedWorkflowId,
      agentInstructionsPageId: instructionsPageId,
      spaceId: space.id,
      ...(space.name ? { spaceName: space.name } : {}),
      ...(modelSlug ? { modelSlug } : {}),
      ...(modelName ? { modelName } : {}),
      url: `https://app.notion.com/agent/${normalizeNotionId(resolvedWorkflowId)}`,
    });
  }

  return result;
}

export function workflowPageMap(syncResponse: unknown): Map<string, string> {
  const result = new Map<string, string>();
  for (const [workflowId, raw] of Object.entries(workflowRecords(syncResponse))) {
    const value = unwrap(raw); const data = value['data'];
    const instructions = data && typeof data === 'object' ? (data as Record<string, unknown>)['instructions'] : undefined;
    const pageId = instructions && typeof instructions === 'object' ? (instructions as Record<string, unknown>)['id'] : undefined;
    if (typeof pageId === 'string' && pageId) result.set(pageId, workflowId);
  }
  return result;
}

export function workflowModelMap(syncResponse: unknown): Map<string, string> {
  const result = new Map<string, string>();
  for (const [workflowId, raw] of Object.entries(workflowRecords(syncResponse))) {
    const value = unwrap(raw);
    const data = value['data'];
    const model = data && typeof data === 'object'
      ? (data as Record<string, unknown>)['model']
      : undefined;
    const type = model && typeof model === 'object'
      ? (model as Record<string, unknown>)['type']
      : undefined;
    if (typeof type === 'string' && type) result.set(workflowId, type);
  }

  return result;
}

function desiredModelSlug(agent: AgentBinding): string | undefined {
  if (agent.syncNotionModel === false) return undefined;
  return agent.notionModelSlug ?? KNOWN_MODEL_SLUGS[agent.notionModel];
}

async function* releaseAfter(
  chunks: AsyncIterable<string>,
  release: () => void,
): AsyncIterable<string> {
  try {
    for await (const chunk of chunks) yield chunk;
  } finally {
    release();
  }
}

function createState(request: TransportRequest): { state: ThreadState; transcript: unknown[] } {
  const now = new Date().toISOString();
  if (request.newThread) {
    const state: ThreadState = { configId: randomUUID(), contextId: randomUUID(), originalDatetime: now, notionModel: request.agent.notionModel, updatedConfigIds: [] };
    return { state, transcript: [] };
  }
  let previous: ThreadState;
  try { previous = JSON.parse(request.state) as ThreadState; }
  catch { throw new NodexError('thread_not_found', 'Stored Notion thread state is invalid'); }
  if (!previous.configId || !previous.contextId) throw new NodexError('thread_not_found', 'Stored Notion thread state is incomplete');
  return {
    state: {
      ...previous,
      notionModel: request.agent.notionModel,
      updatedConfigIds: [...previous.updatedConfigIds, randomUUID()],
    },
    transcript: [],
  };
}

export async function* decodeNotionStream(body: ReadableStream<Uint8Array>, signal: AbortSignal): AsyncIterable<string> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let current = '';
  const types = new Map<string, string>();
  const content = new Map<string, string>();
  const counts = new Map<string, number>();
  let sectionCount = 0;
  const aborted = (): boolean => signal.aborted;
  const stringValue = (value: unknown, fallback = ''): string => typeof value === 'string' ? value : fallback;
  function checkError(entry: Record<string, unknown>): void {
    if (entry['type'] !== 'error') return;
    const subtype = stringValue(entry['subType']);
    throw new NodexError(subtype === 'trust-rule-denied' ? 'trust_backoff' : 'upstream_protocol', `Notion error: ${stringValue(entry['message'], 'unknown')}`, 30_000);
  }
  function absorbSection(section: Record<string, unknown>, index: number): string[] {
    checkError(section);
    const entries = section['value']; const prefix = `/s/${index}`; const deltas: string[] = [];
    if (!Array.isArray(entries)) return deltas;
    counts.set(prefix, entries.length);
    entries.forEach((entry, entryIndex) => {
      if (!entry || typeof entry !== 'object') return;
      const item = entry as Record<string, unknown>; checkError(item);
      const path = `${prefix}/value/${entryIndex}`; const type = stringValue(item['type']); types.set(path, type);
      if (type === 'text' && typeof item['content'] === 'string') { content.set(path, item['content']); current += item['content']; deltas.push(item['content']); }
    });
    return deltas;
  }
  function absorb(event: Record<string, unknown>): string[] {
    checkError(event);
    if (event['type'] === 'premium-feature-unavailable') throw new NodexError('upstream_protocol', 'Notion premium feature unavailable');
    if (event['type'] === 'agent-inference' && Array.isArray(event['value'])) {
      const text = event['value'].filter((item): item is Record<string, unknown> => !!item && typeof item === 'object').filter((item) => item['type'] === 'text').map((item) => stringValue(item['content'])).join('');
      const delta = text.startsWith(current) ? text.slice(current.length) : text;
      current = text;
      return delta ? [delta] : [];
    }
    if (event['type'] === 'patch-start') {
      const sections = (event['data'] as Record<string, unknown> | undefined)?.['s'];
      const deltas: string[] = [];
      if (Array.isArray(sections)) {
        sectionCount = sections.length;
        sections.forEach((section, index) => { if (section && typeof section === 'object') deltas.push(...absorbSection(section as Record<string, unknown>, index)); });
      }
      return deltas;
    }
    if (event['type'] !== 'patch' || !Array.isArray(event['v'])) return [];
    const deltas: string[] = [];
    for (const operation of event['v']) {
      if (!operation || typeof operation !== 'object') continue;
      const op = operation as Record<string, unknown>;
      const kind = op['o']; const path = op['p']; const value = op['v'];
      if (kind === 'a' && path === '/s/-' && value && typeof value === 'object') {
        deltas.push(...absorbSection(value as Record<string, unknown>, sectionCount++));
      } else if (kind === 'a' && typeof path === 'string' && path.includes('/value/-') && value && typeof value === 'object') {
        const prefix = path.slice(0, path.indexOf('/value/')); const index = counts.get(prefix) ?? 0; const item = value as Record<string, unknown>;
        checkError(item); const entryPath = `${prefix}/value/${index}`;
        types.set(entryPath, stringValue(item['type'])); counts.set(prefix, index + 1);
        if (item['type'] === 'text' && typeof item['content'] === 'string') { content.set(entryPath, item['content']); current += item['content']; deltas.push(item['content']); }
      } else if (typeof path === 'string' && path.endsWith('/content') && typeof value === 'string') {
        const entryPath = path.slice(0, -8); const type = types.get(entryPath) ?? 'text';
        if (type !== 'text') continue;
        const previous = content.get(entryPath) ?? '';
        const delta = kind === 'p' && value.startsWith(previous) ? value.slice(previous.length) : kind === 'x' ? value : '';
        content.set(entryPath, kind === 'p' ? value : previous + value); current += delta;
        if (delta) deltas.push(delta);
      }
    }
    return deltas;
  }
  while (!aborted()) {
    let value: Uint8Array | undefined;
    let done: boolean;
    try { ({ value, done } = await reader.read()); }
    catch {
      if (aborted()) {
        throw new NodexError(
          signal.reason === 'cancelled' ? 'cancelled' : 'timeout',
          signal.reason === 'cancelled' ? 'Notion request cancelled' : 'Notion request timed out',
        );
      }
      throw new NodexError('network', 'Notion response stream interrupted');
    }
    buffer += decoder.decode(value, { stream: !done });
    const lines = buffer.split(/\r?\n/); buffer = lines.pop() ?? '';
    for (const line of lines) {
      if (!line.trim()) continue;
      try { for (const delta of absorb(JSON.parse(line) as Record<string, unknown>)) yield delta; }
      catch (error) { if (error instanceof SyntaxError) continue; throw error; }
    }
    if (done) {
      if (buffer.trim()) {
        try { for (const delta of absorb(JSON.parse(buffer) as Record<string, unknown>)) yield delta; }
        catch (error) { if (!(error instanceof SyntaxError)) throw error; }
      }
      break;
    }
  }
  if (aborted()) {
    throw new NodexError(
      signal.reason === 'cancelled' ? 'cancelled' : 'timeout',
      signal.reason === 'cancelled' ? 'Notion request cancelled' : 'Notion request timed out',
    );
  }
}

export class InternalNotionTransport implements NotionTransport {
  readonly attachmentCapabilities = { imageInput: false, fileInput: false };
  private account?: Account;
  private readonly workflows = new Map<string, string>();
  private readonly workflowModels = new Map<string, string>();
  private readonly workflowMutex = new KeyedMutex();

  constructor(private readonly fetcher: NotionFetcher = notionFetch) {}

  private async postJson(path: string, body: unknown): Promise<unknown> {
    const account = this.account;
    if (!account) throw new NodexError('auth', 'Notion preflight unavailable. Run: nodex auth');
    let response: NotionResponse;
    try { response = await this.fetcher(path, { method: 'POST', headers: headers(account.credentials, account.userId), body: JSON.stringify(body) }); }
    catch { throw new NodexError('network', `Cannot reach Notion ${path}`); }
    if (response.status === 401 || response.status === 403) throw new NodexError('auth', 'Notion credentials rejected. Run: nodex auth');
    if (response.status === 429) {
      throw new NodexError(
        'rate_limit',
        'Notion rate limit',
        parseRetryAfter(response.headers.get('retry-after')),
      );
    }
    if (!response.ok) throw new NodexError('upstream_protocol', `Notion ${path} failed: HTTP ${response.status}`);
    return response.json();
  }

  private async syncCustomAgentRecords(): Promise<{ ids: string[]; sync: unknown }> {
    const account = this.account;
    if (!account) throw new NodexError('auth', 'Notion preflight unavailable. Run: nodex auth');
    const customAgents = await this.postJson('getCustomAgents', { spaceId: account.workspaceId });
    const idsRaw = customAgents && typeof customAgents === 'object'
      ? (customAgents as Record<string, unknown>)['agentIds']
      : undefined;
    const ids = Array.isArray(idsRaw)
      ? idsRaw.filter((id): id is string => typeof id === 'string' && Boolean(id))
      : [];
    if (!ids.length) return { ids, sync: { recordMap: { workflow: {} } } };
    const sync = await this.postJson('syncRecordValuesMain', {
      requests: ids.map((id) => ({
        pointer: { table: 'workflow', id, spaceId: account.workspaceId },
        version: -1,
      })),
    });
    for (const [pageId, workflowId] of workflowPageMap(sync)) this.workflows.set(pageId, workflowId);
    for (const [workflowId, model] of workflowModelMap(sync)) this.workflowModels.set(workflowId, model);
    return { ids, sync };
  }

  async discoverCustomAgents(): Promise<DiscoveredNotionAgent[]> {
    if (!this.account) await this.preflight();
    const account = this.account;
    if (!account) throw new NodexError('auth', 'Notion preflight unavailable. Run: nodex auth');
    const { ids, sync } = await this.syncCustomAgentRecords();
    return discoveredAgentsFromRecords(sync, ids, {
      id: account.workspaceId,
      ...(account.workspaceName ? { name: account.workspaceName } : {}),
    });
  }

  private async workflowId(agent: AgentBinding): Promise<string> {
    const instructionsPageId = bindingInstructionsPageId(agent);
    const cached = [...this.workflows.entries()].find(([pageId]) => sameNotionId(pageId, instructionsPageId))?.[1];
    if (cached) return cached;
    const account = this.account;
    if (!account) throw new NodexError('auth', 'Notion preflight unavailable. Run: nodex auth');
    const { ids, sync } = await this.syncCustomAgentRecords();
    const resolved = [...this.workflows.entries()]
      .find(([pageId]) => sameNotionId(pageId, instructionsPageId))?.[1];
    if (resolved) return resolved;
    const agents = discoveredAgentsFromRecords(sync, ids, { id: account.workspaceId });
    const workflowMatch = agents.find((candidate) => sameNotionId(candidate.workflowId, instructionsPageId));
    if (workflowMatch) {
      throw new NodexError(
        'upstream_protocol',
        `Configured ID is a workflowId. Use agentInstructionsPageId: ${workflowMatch.agentInstructionsPageId}`,
      );
    }
    throw new NodexError(
      'upstream_protocol',
      `Custom Agent not found for agentInstructionsPageId: ${instructionsPageId}`,
    );
  }

  private async ensureWorkflowModel(workflowId: string, agent: AgentBinding): Promise<void> {
    const desired = desiredModelSlug(agent);
    if (!desired || this.workflowModels.get(workflowId) === desired) return;
    const account = this.account;
    if (!account) throw new NodexError('auth', 'Notion preflight unavailable. Run: nodex auth');
    const pointer = { table: 'workflow', id: workflowId, spaceId: account.workspaceId };

    await this.postJson('saveTransactionsFanout', {
      requestId: randomUUID(),
      transactions: [{
        id: randomUUID(),
        spaceId: account.workspaceId,
        debug: { userAction: 'WorkflowActions.saveModel' },
        operations: [
          {
            pointer,
            command: 'set',
            path: ['data', 'model'],
            args: { type: desired },
          },
          {
            pointer,
            path: [],
            args: {
              last_edited_time: Date.now(),
              last_edited_by_id: account.userId,
              last_edited_by_table: 'notion_user',
            },
            command: 'update',
          },
        ],
      }],
    });
    await this.postJson('publishCustomAgentVersion', {
      workflowId,
      spaceId: account.workspaceId,
    });
    this.workflowModels.set(workflowId, desired);
  }

  async preflight(credentials?: Credentials): Promise<PreflightInfo> {
    const resolved = credentials ?? await loadCredentials();
    let response: NotionResponse;
    try { response = await this.fetcher('loadUserContent', { method: 'POST', headers: headers(resolved), body: '{}' }); }
    catch { throw new NodexError('network', 'Cannot reach Notion'); }
    if (response.status === 401 || response.status === 403) throw new NodexError('auth', 'Notion credentials rejected. Run: nodex auth');
    if (response.status === 429) {
      throw new NodexError(
        'rate_limit',
        'Notion rate limit',
        parseRetryAfter(response.headers.get('retry-after')),
      );
    }
    if (!response.ok) throw new NodexError('upstream_protocol', `Notion preflight failed: HTTP ${response.status}`);
    this.account = extractAccount(await response.json(), resolved);
    this.workflows.clear();
    this.workflowModels.clear();
    return { userId: this.account.userId, userName: this.account.userName, userEmail: this.account.userEmail, workspaceId: this.account.workspaceId, workspaceName: this.account.workspaceName, spaceViewId: this.account.spaceViewId };
  }

  async send(request: TransportRequest): Promise<TransportTurn> {
    if (request.attachments.length) {
      throw new NodexError(
        'capability_unavailable',
        'Notion attachment upload wire contract is not verified for this transport',
      );
    }
    if (!this.account) await this.preflight();
    const account = this.account;
    if (!account) throw new NodexError('auth', 'Notion preflight unavailable. Run: nodex auth');
    const workflowId = await this.workflowId(request.agent);
    const release = await this.workflowMutex.acquire(workflowId);
    let releaseWithStream = false;

    try {
      await this.ensureWorkflowModel(workflowId, request.agent);
      const prepared = createState(request);
      const state = prepared.state;
      const transcript: unknown[] = [
        { id: state.configId, type: 'config', value: configValue(state.notionModel, !request.newThread) },
        { id: state.contextId, type: 'context', value: contextValue(account, request.agent, state.originalDatetime, workflowId) },
        ...(!request.newThread ? state.updatedConfigIds.map((id) => ({ id, type: 'updated-config' })) : []),
        { id: randomUUID(), type: 'user', value: [[request.message]], userId: account.userId, createdAt: new Date().toISOString() },
      ];
      const body = {
        traceId: randomUUID(), spaceId: account.workspaceId, transcript, threadId: request.threadId,
        createThread: request.newThread, isPartialTranscript: !request.newThread, generateTitle: request.newThread,
        saveAllThreadOperations: true, setUnreadState: true, threadType: 'workflow', asPatchResponse: true,
        hasHeartbeat: false, createdSource: 'custom_agent', isUserInAnySalesAssistedSpace: false, isSpaceSalesAssisted: false,
        debugOverrides: { emitAgentSearchExtractedResults: true, cachedInferences: {}, annotationInferences: {}, emitInferences: false },
        ...(request.newThread ? { threadParentPointer: { table: 'workflow', id: workflowId, spaceId: account.workspaceId } } : {}),
      };
      let response: NotionResponse;
      try { response = await this.fetcher('runInferenceTranscript', { method: 'POST', headers: headers(account.credentials, account.userId), body: JSON.stringify(body), signal: request.signal }); }
      catch {
        if (request.signal.aborted) {
          throw new NodexError(
            request.signal.reason === 'cancelled' ? 'cancelled' : 'timeout',
            request.signal.reason === 'cancelled' ? 'Notion turn cancelled' : 'Notion turn timed out',
          );
        }
        throw new NodexError('network', 'Notion request failed');
      }
      if (response.status === 401 || response.status === 403) throw new NodexError('auth', 'Notion credentials rejected. Run: nodex auth');
      if (response.status === 404) throw new NodexError('thread_not_found', 'Notion thread not found');
      if (response.status === 429) {
        throw new NodexError(
          'rate_limit',
          'Notion rate limit',
          parseRetryAfter(response.headers.get('retry-after')),
        );
      }
      if (!response.ok || !response.body) throw new NodexError('upstream_protocol', `Notion inference failed: HTTP ${response.status}`);
      releaseWithStream = true;
      return {
        chunks: releaseAfter(
          decodeNotionStream(response.body as unknown as ReadableStream<Uint8Array>, request.signal),
          release,
        ),
        nextState: JSON.stringify(state),
      };
    } finally {
      if (!releaseWithStream) release();
    }
  }
}
