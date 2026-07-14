import { randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import Database from 'better-sqlite3';

export interface Session {
  sessionId: string;
  notionThreadId: string;
  agent: string;
  createdAt: number;
  lastUsedAt: number;
  toolsHash: string;
  transportState: string;
  issuedCalls: string;
  lastSyncedPosition?: number;
  resetGeneration?: number;
}

interface SessionRow {
  session_id: string; notion_thread_id: string; agent: string; created_at: number; last_used_at: number;
  tools_hash: string; transport_state: string; issued_calls: string;
}

export interface Conversation {
  id: string;
  createdAt: number;
  updatedAt: number;
  metadata: Record<string, string>;
}

export interface ConversationItem {
  id: string;
  conversationId: string;
  position: number;
  createdAt: number;
  type: string;
  role?: string;
  status?: string;
  payload: unknown;
}

export interface StoredFileRecord {
  id: string;
  filename: string;
  purpose: string;
  mimeType: string;
  bytes: number;
  checksum: string;
  createdAt: number;
  expiresAt?: number;
  storageKey: string;
}

export type StoredResponseStatus =
  | 'queued'
  | 'in_progress'
  | 'completed'
  | 'failed'
  | 'cancelled';

export interface StoredResponseRecord {
  responseId: string;
  idempotencyKey?: string;
  fingerprint: string;
  conversationId?: string;
  model: string;
  agentBinding: string;
  status: StoredResponseStatus;
  createdAt: number;
  updatedAt: number;
  expiresAt?: number;
  storeFull: boolean;
  background: boolean;
  input: unknown[];
  context: unknown[];
  response?: unknown;
  error?: unknown;
}

interface ConversationRow {
  id: string;
  created_at: number;
  updated_at: number;
  metadata: string;
  deleted_at: number | null;
}

interface ConversationItemRow {
  id: string;
  conversation_id: string;
  position: number;
  created_at: number;
  type: string;
  role: string | null;
  status: string | null;
  payload: string;
}

interface AgentThreadRow {
  conversation_id: string;
  agent_id: string;
  notion_thread_id: string;
  transport_state: string;
  tools_hash: string;
  issued_calls: string;
  last_synced_position: number;
  reset_generation: number;
  created_at: number;
  updated_at: number;
}

interface FileRow {
  id: string;
  filename: string;
  purpose: string;
  mime_type: string;
  bytes: number;
  checksum: string;
  created_at: number;
  expires_at: number | null;
  deleted_at: number | null;
  storage_key: string;
}

interface ResponseRow {
  response_id: string;
  idempotency_key: string | null;
  fingerprint: string;
  conversation_id: string | null;
  model: string;
  agent_binding: string;
  status: StoredResponseStatus;
  created_at: number;
  updated_at: number;
  expires_at: number | null;
  store_full: number;
  background: number;
  input_json: string | null;
  context_json: string | null;
  response_json: string | null;
  error_json: string | null;
  deleted_at: number | null;
}

function fromRow(row: SessionRow): Session {
  return { sessionId: row.session_id, notionThreadId: row.notion_thread_id, agent: row.agent, createdAt: row.created_at, lastUsedAt: row.last_used_at, toolsHash: row.tools_hash, transportState: row.transport_state, issuedCalls: row.issued_calls };
}

function parseObject(value: string): Record<string, string> {
  try {
    const parsed: unknown = JSON.parse(value);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    return Object.fromEntries(
      Object.entries(parsed).filter(
        (entry): entry is [string, string] => typeof entry[1] === 'string',
      ),
    );
  } catch {
    return {};
  }
}

function fromConversationRow(row: ConversationRow): Conversation {
  return {
    id: row.id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    metadata: parseObject(row.metadata),
  };
}

function fromConversationItemRow(row: ConversationItemRow): ConversationItem {
  let payload: unknown = {};
  try { payload = JSON.parse(row.payload) as unknown; } catch { /* corrupted rows stay opaque */ }
  return {
    id: row.id,
    conversationId: row.conversation_id,
    position: row.position,
    createdAt: row.created_at,
    type: row.type,
    ...(row.role ? { role: row.role } : {}),
    ...(row.status ? { status: row.status } : {}),
    payload,
  };
}

function fromAgentThreadRow(row: AgentThreadRow): Session {
  return {
    sessionId: row.conversation_id,
    notionThreadId: row.notion_thread_id,
    agent: row.agent_id,
    createdAt: row.created_at,
    lastUsedAt: row.updated_at,
    toolsHash: row.tools_hash,
    transportState: row.transport_state,
    issuedCalls: row.issued_calls,
    lastSyncedPosition: row.last_synced_position,
    resetGeneration: row.reset_generation,
  };
}

function fromFileRow(row: FileRow): StoredFileRecord {
  return {
    id: row.id,
    filename: row.filename,
    purpose: row.purpose,
    mimeType: row.mime_type,
    bytes: row.bytes,
    checksum: row.checksum,
    createdAt: row.created_at,
    ...(row.expires_at ? { expiresAt: row.expires_at } : {}),
    storageKey: row.storage_key,
  };
}

function parseJson(value: string | null, fallback: unknown): unknown {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return fallback;
  }
}

function fromResponseRow(row: ResponseRow): StoredResponseRecord {
  const input = parseJson(row.input_json, []);
  const context = parseJson(row.context_json, []);
  const response = parseJson(row.response_json, undefined);
  const error = parseJson(row.error_json, undefined);
  return {
    responseId: row.response_id,
    ...(row.idempotency_key ? { idempotencyKey: row.idempotency_key } : {}),
    fingerprint: row.fingerprint,
    ...(row.conversation_id ? { conversationId: row.conversation_id } : {}),
    model: row.model,
    agentBinding: row.agent_binding,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    ...(row.expires_at ? { expiresAt: row.expires_at } : {}),
    storeFull: row.store_full === 1,
    background: row.background === 1,
    input: Array.isArray(input) ? input : [],
    context: Array.isArray(context) ? context : [],
    ...(response === undefined ? {} : { response }),
    ...(error === undefined ? {} : { error }),
  };
}

export class SessionStore {
  private readonly db: Database.Database;
  private readonly getStatement;
  private readonly createStatement;
  private readonly touchStatement;
  private readonly replaceStatement;

  constructor(path: string) {
    mkdirSync(dirname(path), { recursive: true });
    this.db = new Database(path);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');
    this.db.exec(`CREATE TABLE IF NOT EXISTS sessions (
      session_id TEXT NOT NULL, notion_thread_id TEXT NOT NULL, agent TEXT NOT NULL,
      created_at INTEGER NOT NULL, last_used_at INTEGER NOT NULL, tools_hash TEXT NOT NULL DEFAULT '',
      transport_state TEXT NOT NULL DEFAULT '{}', issued_calls TEXT NOT NULL DEFAULT '[]',
      PRIMARY KEY(session_id, agent)
    );
    CREATE TABLE IF NOT EXISTS conversations (
      id TEXT PRIMARY KEY,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      metadata TEXT NOT NULL DEFAULT '{}',
      deleted_at INTEGER
    );
    CREATE TABLE IF NOT EXISTS conversation_items (
      id TEXT PRIMARY KEY,
      conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
      position INTEGER NOT NULL,
      created_at INTEGER NOT NULL,
      type TEXT NOT NULL,
      role TEXT,
      status TEXT,
      payload TEXT NOT NULL,
      UNIQUE(conversation_id, position)
    );
    CREATE INDEX IF NOT EXISTS conversation_items_page
      ON conversation_items(conversation_id, position);
    CREATE TABLE IF NOT EXISTS agent_threads (
      conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
      agent_id TEXT NOT NULL,
      notion_thread_id TEXT NOT NULL,
      transport_state TEXT NOT NULL DEFAULT '{}',
      tools_hash TEXT NOT NULL DEFAULT '',
      issued_calls TEXT NOT NULL DEFAULT '[]',
      last_synced_position INTEGER NOT NULL DEFAULT -1,
      reset_generation INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      PRIMARY KEY(conversation_id, agent_id)
    );
    CREATE TABLE IF NOT EXISTS files (
      id TEXT PRIMARY KEY,
      filename TEXT NOT NULL,
      purpose TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      bytes INTEGER NOT NULL,
      checksum TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      expires_at INTEGER,
      deleted_at INTEGER,
      storage_key TEXT NOT NULL UNIQUE
    );
    CREATE INDEX IF NOT EXISTS files_created ON files(created_at, id);
    CREATE TABLE IF NOT EXISTS file_references (
      file_id TEXT NOT NULL REFERENCES files(id),
      owner_type TEXT NOT NULL,
      owner_id TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      PRIMARY KEY(file_id, owner_type, owner_id)
    );
    CREATE TABLE IF NOT EXISTS response_records (
      response_id TEXT PRIMARY KEY,
      idempotency_key TEXT,
      fingerprint TEXT NOT NULL,
      conversation_id TEXT,
      model TEXT NOT NULL,
      agent_binding TEXT NOT NULL,
      status TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      expires_at INTEGER,
      store_full INTEGER NOT NULL,
      background INTEGER NOT NULL DEFAULT 0,
      input_json TEXT,
      context_json TEXT,
      response_json TEXT,
      error_json TEXT,
      deleted_at INTEGER
    );
    CREATE UNIQUE INDEX IF NOT EXISTS response_idempotency
      ON response_records(idempotency_key)
      WHERE idempotency_key IS NOT NULL AND deleted_at IS NULL;
    CREATE INDEX IF NOT EXISTS responses_retention
      ON response_records(updated_at, response_id);
    PRAGMA user_version = 5;`);
    this.getStatement = this.db.prepare('SELECT * FROM sessions WHERE session_id = ? AND agent = ?');
    this.createStatement = this.db.prepare('INSERT INTO sessions VALUES (@session_id,@notion_thread_id,@agent,@created_at,@last_used_at,@tools_hash,@transport_state,@issued_calls)');
    this.touchStatement = this.db.prepare('UPDATE sessions SET last_used_at=@last_used_at, tools_hash=@tools_hash, transport_state=@transport_state, issued_calls=@issued_calls WHERE session_id=@session_id AND agent=@agent');
    this.replaceStatement = this.db.prepare('UPDATE sessions SET notion_thread_id=@notion_thread_id, last_used_at=@last_used_at, transport_state=@transport_state WHERE session_id=@session_id AND agent=@agent');
  }

  get(sessionId: string, agent: string): Session | undefined {
    const row = this.getStatement.get(sessionId, agent) as SessionRow | undefined;
    return row ? fromRow(row) : undefined;
  }

  create(sessionId: string, notionThreadId: string, agent: string): Session {
    const now = Date.now();
    const row: SessionRow = { session_id: sessionId, notion_thread_id: notionThreadId, agent, created_at: now, last_used_at: now, tools_hash: '', transport_state: '{}', issued_calls: '[]' };
    this.createStatement.run(row);
    return fromRow(row);
  }

  touch(session: Session): void {
    this.touchStatement.run({ session_id: session.sessionId, agent: session.agent, last_used_at: Date.now(), tools_hash: session.toolsHash, transport_state: session.transportState, issued_calls: session.issuedCalls });
  }

  replaceThread(session: Session, notionThreadId: string, transportState = '{}'): void {
    this.replaceStatement.run({ session_id: session.sessionId, agent: session.agent, notion_thread_id: notionThreadId, last_used_at: Date.now(), transport_state: transportState });
  }

  getTurnSession(
    sessionId: string,
    agent: string,
    conversationId?: string,
  ): Session | undefined {
    if (!conversationId) return this.get(sessionId, agent);
    const row = this.db
      .prepare('SELECT * FROM agent_threads WHERE conversation_id = ? AND agent_id = ?')
      .get(conversationId, agent) as AgentThreadRow | undefined;
    if (row) return fromAgentThreadRow(row);

    const legacy = this.get(conversationId, agent);
    if (!legacy) return undefined;
    this.createAgentThread(conversationId, agent, legacy.notionThreadId, legacy);
    return this.getTurnSession(sessionId, agent, conversationId);
  }

  createTurnSession(
    sessionId: string,
    notionThreadId: string,
    agent: string,
    conversationId?: string,
  ): Session {
    if (!conversationId) return this.create(sessionId, notionThreadId, agent);
    return this.createAgentThread(conversationId, agent, notionThreadId);
  }

  touchTurnSession(session: Session, conversationId?: string): void {
    if (!conversationId) {
      this.touch(session);
      return;
    }
    this.db.prepare(`UPDATE agent_threads SET
      updated_at=@updated_at, tools_hash=@tools_hash, transport_state=@transport_state,
      issued_calls=@issued_calls, last_synced_position=@last_synced_position
      WHERE conversation_id=@conversation_id AND agent_id=@agent_id`).run({
      conversation_id: conversationId,
      agent_id: session.agent,
      updated_at: Date.now(),
      tools_hash: session.toolsHash,
      transport_state: session.transportState,
      issued_calls: session.issuedCalls,
      last_synced_position: session.lastSyncedPosition ?? -1,
    });
  }

  replaceTurnThread(
    session: Session,
    notionThreadId: string,
    transportState = '{}',
    conversationId?: string,
  ): void {
    if (!conversationId) {
      this.replaceThread(session, notionThreadId, transportState);
      return;
    }
    this.db.prepare(`UPDATE agent_threads SET
      notion_thread_id = ?, transport_state = ?, reset_generation = reset_generation + 1,
      last_synced_position = -1, updated_at = ?
      WHERE conversation_id = ? AND agent_id = ?`).run(
      notionThreadId,
      transportState,
      Date.now(),
      conversationId,
      session.agent,
    );
    session.lastSyncedPosition = -1;
    session.resetGeneration = (session.resetGeneration ?? 0) + 1;
  }

  conversationContextItems(
    conversationId: string,
    afterPosition = -1,
    maxItems = 100,
  ): { items: ConversationItem[]; latestPosition: number; omitted: number } {
    const countRow = this.db.prepare(`SELECT COUNT(*) AS count, COALESCE(MAX(position), -1) AS latest
      FROM conversation_items WHERE conversation_id = ? AND position > ?`).get(
      conversationId,
      afterPosition,
    ) as { count: number; latest: number };
    if (countRow.count <= maxItems) {
      const rows = this.db.prepare(`SELECT * FROM conversation_items
        WHERE conversation_id = ? AND position > ? ORDER BY position ASC`).all(
        conversationId,
        afterPosition,
      ) as ConversationItemRow[];
      return {
        items: rows.map(fromConversationItemRow),
        latestPosition: countRow.latest,
        omitted: 0,
      };
    }

    const headCount = afterPosition < 0 ? Math.min(20, Math.floor(maxItems / 4)) : 0;
    const tailCount = maxItems - headCount;
    const head = headCount
      ? this.db.prepare(`SELECT * FROM conversation_items
          WHERE conversation_id = ? AND position > ? ORDER BY position ASC LIMIT ?`).all(
          conversationId,
          afterPosition,
          headCount,
        ) as ConversationItemRow[]
      : [];
    const tail = this.db.prepare(`SELECT * FROM (
        SELECT * FROM conversation_items WHERE conversation_id = ? AND position > ?
        ORDER BY position DESC LIMIT ?
      ) ORDER BY position ASC`).all(conversationId, afterPosition, tailCount) as ConversationItemRow[];
    return {
      items: [...head, ...tail].map(fromConversationItemRow),
      latestPosition: countRow.latest,
      omitted: countRow.count - head.length - tail.length,
    };
  }

  private createAgentThread(
    conversationId: string,
    agent: string,
    notionThreadId: string,
    legacy?: Session,
  ): Session {
    const now = Date.now();
    this.db.prepare(`INSERT INTO agent_threads(
      conversation_id,agent_id,notion_thread_id,transport_state,tools_hash,issued_calls,
      last_synced_position,reset_generation,created_at,updated_at
    ) VALUES (?,?,?,?,?,?,?,?,?,?)`).run(
      conversationId,
      agent,
      notionThreadId,
      legacy?.transportState ?? '{}',
      legacy?.toolsHash ?? '',
      legacy?.issuedCalls ?? '[]',
      legacy?.lastSyncedPosition ?? -1,
      legacy?.resetGeneration ?? 0,
      legacy?.createdAt ?? now,
      legacy?.lastUsedAt ?? now,
    );
    const created = this.getTurnSession(conversationId, agent, conversationId);
    if (!created) throw new Error('Failed to create agent thread');
    return created;
  }

  createFileRecord(file: StoredFileRecord): void {
    this.db.prepare(`INSERT INTO files(
      id,filename,purpose,mime_type,bytes,checksum,created_at,expires_at,storage_key
    ) VALUES (?,?,?,?,?,?,?,?,?)`).run(
      file.id,
      file.filename,
      file.purpose,
      file.mimeType,
      file.bytes,
      file.checksum,
      file.createdAt,
      file.expiresAt ?? null,
      file.storageKey,
    );
  }

  getFile(id: string): StoredFileRecord | undefined {
    const row = this.db
      .prepare('SELECT * FROM files WHERE id = ? AND deleted_at IS NULL')
      .get(id) as FileRow | undefined;
    return row ? fromFileRow(row) : undefined;
  }

  listFiles(limit = 20, after?: string): StoredFileRecord[] {
    const safeLimit = Math.min(Math.max(limit, 1), 100);
    const cursor = after
      ? this.db.prepare('SELECT created_at, id FROM files WHERE id = ?').get(after) as
          | { created_at: number; id: string }
          | undefined
      : undefined;
    const rows = cursor
      ? this.db.prepare(`SELECT * FROM files WHERE deleted_at IS NULL AND
          (created_at < ? OR (created_at = ? AND id < ?))
          ORDER BY created_at DESC, id DESC LIMIT ?`).all(
          cursor.created_at,
          cursor.created_at,
          cursor.id,
          safeLimit,
        ) as FileRow[]
      : this.db.prepare(`SELECT * FROM files WHERE deleted_at IS NULL
          ORDER BY created_at DESC, id DESC LIMIT ?`).all(safeLimit) as FileRow[];
    return rows.map(fromFileRow);
  }

  markFileDeleted(id: string): boolean {
    const result = this.db
      .prepare('UPDATE files SET deleted_at = ? WHERE id = ? AND deleted_at IS NULL')
      .run(Math.floor(Date.now() / 1000), id);
    return result.changes > 0;
  }

  isFileReferenced(id: string): boolean {
    return this.db
      .prepare('SELECT 1 AS found FROM file_references WHERE file_id = ? LIMIT 1')
      .get(id) !== undefined;
  }

  reserveResponse(args: {
    responseId: string;
    idempotencyKey?: string;
    fingerprint: string;
    conversationId?: string;
    model: string;
    agentBinding: string;
    storeFull: boolean;
    background: boolean;
    input: unknown[];
  }): { record: StoredResponseRecord; created: boolean } {
    const reserve = this.db.transaction(() => {
      if (args.idempotencyKey) {
        const existing = this.db
          .prepare(`SELECT * FROM response_records
            WHERE idempotency_key = ? AND deleted_at IS NULL`)
          .get(args.idempotencyKey) as ResponseRow | undefined;
        if (existing) return { row: existing, created: false };
      }
      const now = Math.floor(Date.now() / 1_000);
      this.db.prepare(`INSERT INTO response_records(
        response_id,idempotency_key,fingerprint,conversation_id,model,agent_binding,status,
        created_at,updated_at,store_full,background,input_json,context_json
      ) VALUES (?,?,?,?,?,?,'queued',?,?,?,?,?,?)`).run(
        args.responseId,
        args.idempotencyKey ?? null,
        args.fingerprint,
        args.conversationId ?? null,
        args.model,
        args.agentBinding,
        now,
        now,
        args.storeFull ? 1 : 0,
        args.background ? 1 : 0,
        JSON.stringify(args.input),
        JSON.stringify(args.input),
      );
      const row = this.db
        .prepare('SELECT * FROM response_records WHERE response_id = ?')
        .get(args.responseId) as ResponseRow;
      return { row, created: true };
    });
    const result = reserve();
    return { record: fromResponseRow(result.row), created: result.created };
  }

  getResponse(id: string, retrievableOnly = true): StoredResponseRecord | undefined {
    const row = this.db.prepare(`SELECT * FROM response_records
      WHERE response_id = ? AND deleted_at IS NULL${retrievableOnly ? ' AND store_full = 1' : ''}`)
      .get(id) as ResponseRow | undefined;
    return row ? fromResponseRow(row) : undefined;
  }

  markResponseInProgress(id: string): StoredResponseRecord | undefined {
    this.db.prepare(`UPDATE response_records SET status = 'in_progress', updated_at = ?
      WHERE response_id = ? AND status = 'queued' AND deleted_at IS NULL`).run(
      Math.floor(Date.now() / 1_000),
      id,
    );
    return this.getResponse(id, false);
  }

  completeResponse(
    id: string,
    response: unknown,
    input: unknown[],
    context: unknown[],
    referencedFileIds: string[] = [],
  ): StoredResponseRecord | undefined {
    const complete = this.db.transaction(() => {
      const row = this.db.prepare('SELECT * FROM response_records WHERE response_id = ?')
        .get(id) as ResponseRow | undefined;
      if (!row || row.deleted_at || !['queued', 'in_progress'].includes(row.status)) return;
      const now = Math.floor(Date.now() / 1_000);
      const keep = row.store_full === 1;
      this.db.prepare(`UPDATE response_records SET status = 'completed', updated_at = ?,
        expires_at = ?, input_json = ?, context_json = ?, response_json = ?, error_json = NULL
        WHERE response_id = ?`).run(
        now,
        keep ? null : now + 86_400,
        keep ? JSON.stringify(input) : null,
        keep ? JSON.stringify(context) : null,
        keep ? JSON.stringify(response) : null,
        id,
      );
      if (keep) {
        const reference = this.db.prepare(`INSERT OR IGNORE INTO file_references(
          file_id,owner_type,owner_id,created_at
        ) VALUES (?, 'response', ?, ?)`);
        for (const fileId of new Set(referencedFileIds)) reference.run(fileId, id, now);
      }
    });
    complete();
    return this.getResponse(id, false);
  }

  failResponse(id: string, error: unknown): StoredResponseRecord | undefined {
    const now = Math.floor(Date.now() / 1_000);
    this.db.prepare(`UPDATE response_records SET status = 'failed', updated_at = ?, error_json = ?,
      expires_at = CASE WHEN store_full = 1 THEN expires_at ELSE ? END,
      input_json = CASE WHEN store_full = 1 THEN input_json ELSE NULL END,
      context_json = CASE WHEN store_full = 1 THEN context_json ELSE NULL END
      WHERE response_id = ? AND status IN ('queued','in_progress') AND deleted_at IS NULL`).run(
      now,
      JSON.stringify(error),
      now + 86_400,
      id,
    );
    return this.getResponse(id, false);
  }

  cancelResponse(id: string): StoredResponseRecord | undefined {
    const row = this.getResponse(id, false);
    if (!row) return undefined;
    if (row.status === 'queued' || row.status === 'in_progress') {
      const now = Math.floor(Date.now() / 1_000);
      this.db.prepare(`UPDATE response_records SET status = 'cancelled', updated_at = ?,
        error_json = ?, expires_at = CASE WHEN store_full = 1 THEN expires_at ELSE ? END,
        input_json = CASE WHEN store_full = 1 THEN input_json ELSE NULL END,
        context_json = CASE WHEN store_full = 1 THEN context_json ELSE NULL END
        WHERE response_id = ? AND status IN ('queued','in_progress')`).run(
        now,
        JSON.stringify({ message: 'Response cancelled', type: 'cancelled', code: 'cancelled' }),
        now + 86_400,
        id,
      );
    }
    return this.getResponse(id, false);
  }

  deleteResponse(id: string): boolean {
    const remove = this.db.transaction(() => {
      const now = Math.floor(Date.now() / 1_000);
      const result = this.db.prepare(`UPDATE response_records SET deleted_at = ?,
        input_json = NULL, context_json = NULL, response_json = NULL, error_json = NULL
        WHERE response_id = ? AND deleted_at IS NULL AND store_full = 1
          AND status NOT IN ('queued','in_progress')`).run(now, id);
      if (result.changes) {
        this.db.prepare(`DELETE FROM file_references
          WHERE owner_type = 'response' AND owner_id = ?`).run(id);
      }
      return result.changes > 0;
    });
    return remove();
  }

  cleanupResponses(retentionDays: number): number {
    const now = Math.floor(Date.now() / 1_000);
    const cutoff = retentionDays > 0 ? now - retentionDays * 86_400 : -1;
    const rows = this.db.prepare(`SELECT response_id FROM response_records
      WHERE deleted_at IS NOT NULL OR (expires_at IS NOT NULL AND expires_at <= ?)
        OR (? >= 0 AND updated_at <= ? AND status NOT IN ('queued','in_progress'))`).all(
      now,
      cutoff,
      cutoff,
    ) as Array<{ response_id: string }>;
    const cleanup = this.db.transaction(() => {
      const references = this.db.prepare(`DELETE FROM file_references
        WHERE owner_type = 'response' AND owner_id = ?`);
      const remove = this.db.prepare('DELETE FROM response_records WHERE response_id = ?');
      for (const row of rows) {
        references.run(row.response_id);
        remove.run(row.response_id);
      }
    });
    cleanup();
    return rows.length;
  }

  createConversation(
    metadata: Record<string, string> = {},
    items: unknown[] = [],
  ): Conversation {
    const now = Math.floor(Date.now() / 1000);
    const id = `conv_${randomUUID().replaceAll('-', '')}`;
    const create = this.db.transaction(() => {
      this.db.prepare(
        'INSERT INTO conversations(id,created_at,updated_at,metadata) VALUES (?,?,?,?)',
      ).run(id, now, now, JSON.stringify(metadata));
      this.insertConversationItems(id, items, now);
    });
    create();
    return { id, createdAt: now, updatedAt: now, metadata };
  }

  getConversation(id: string): Conversation | undefined {
    const row = this.db
      .prepare('SELECT * FROM conversations WHERE id = ? AND deleted_at IS NULL')
      .get(id) as ConversationRow | undefined;
    return row ? fromConversationRow(row) : undefined;
  }

  updateConversation(id: string, metadata: Record<string, string>): Conversation | undefined {
    const now = Math.floor(Date.now() / 1000);
    const result = this.db
      .prepare(
        'UPDATE conversations SET metadata = ?, updated_at = ? WHERE id = ? AND deleted_at IS NULL',
      )
      .run(JSON.stringify(metadata), now, id);
    return result.changes ? this.getConversation(id) : undefined;
  }

  deleteConversation(id: string): boolean {
    const now = Math.floor(Date.now() / 1000);
    const remove = this.db.transaction(() => {
      const result = this.db
        .prepare('UPDATE conversations SET deleted_at = ?, updated_at = ? WHERE id = ? AND deleted_at IS NULL')
        .run(now, now, id);
      if (result.changes) {
        this.db.prepare(`DELETE FROM file_references WHERE owner_type = 'conversation_item'
          AND owner_id IN (SELECT id FROM conversation_items WHERE conversation_id = ?)`).run(id);
        this.db.prepare('DELETE FROM conversation_items WHERE conversation_id = ?').run(id);
      }
      return result.changes > 0;
    });
    return remove();
  }

  appendConversationItems(id: string, items: unknown[]): ConversationItem[] {
    if (!this.getConversation(id)) return [];
    const now = Math.floor(Date.now() / 1000);
    const append = this.db.transaction(() => {
      const created = this.insertConversationItems(id, items, now);
      this.db.prepare('UPDATE conversations SET updated_at = ? WHERE id = ?').run(now, id);
      return created;
    });
    return append();
  }

  getConversationItem(conversationId: string, itemId: string): ConversationItem | undefined {
    const row = this.db
      .prepare('SELECT * FROM conversation_items WHERE conversation_id = ? AND id = ?')
      .get(conversationId, itemId) as ConversationItemRow | undefined;
    return row ? fromConversationItemRow(row) : undefined;
  }

  deleteConversationItem(conversationId: string, itemId: string): boolean {
    this.db.prepare(
      `DELETE FROM file_references WHERE owner_type = 'conversation_item' AND owner_id = ?`,
    ).run(itemId);
    const result = this.db
      .prepare('DELETE FROM conversation_items WHERE conversation_id = ? AND id = ?')
      .run(conversationId, itemId);
    if (result.changes) {
      this.db
        .prepare('UPDATE conversations SET updated_at = ? WHERE id = ?')
        .run(Math.floor(Date.now() / 1000), conversationId);
    }
    return result.changes > 0;
  }

  listConversationItems(
    conversationId: string,
    options: { limit?: number; after?: string; order?: 'asc' | 'desc' } = {},
  ): { data: ConversationItem[]; hasMore: boolean; firstId?: string; lastId?: string } {
    const limit = Math.min(Math.max(options.limit ?? 20, 1), 100);
    const order = options.order ?? 'desc';
    const cursor = options.after
      ? this.getConversationItem(conversationId, options.after)?.position
      : undefined;
    const comparison = order === 'asc' ? '>' : '<';
    const sql = `SELECT * FROM conversation_items WHERE conversation_id = ?${
      cursor === undefined ? '' : ` AND position ${comparison} ?`
    } ORDER BY position ${order === 'asc' ? 'ASC' : 'DESC'} LIMIT ?`;
    const params = cursor === undefined
      ? [conversationId, limit + 1]
      : [conversationId, cursor, limit + 1];
    const rows = this.db.prepare(sql).all(...params) as ConversationItemRow[];
    const hasMore = rows.length > limit;
    const data = rows.slice(0, limit).map(fromConversationItemRow);
    const first = data[0];
    const last = data.at(-1);
    return {
      data,
      hasMore,
      ...(first ? { firstId: first.id } : {}),
      ...(last ? { lastId: last.id } : {}),
    };
  }

  private insertConversationItems(
    conversationId: string,
    items: unknown[],
    createdAt: number,
  ): ConversationItem[] {
    const current = this.db
      .prepare('SELECT COALESCE(MAX(position), -1) AS position FROM conversation_items WHERE conversation_id = ?')
      .get(conversationId) as { position: number };
    const insert = this.db.prepare(`INSERT INTO conversation_items(
      id,conversation_id,position,created_at,type,role,status,payload
    ) VALUES (?,?,?,?,?,?,?,?)`);
    return items.map((payload, offset) => {
      const value = payload && typeof payload === 'object'
        ? payload as { id?: unknown; type?: unknown; role?: unknown; status?: unknown }
        : {};
      const id = typeof value.id === 'string' && value.id
        ? value.id
        : `item_${randomUUID().replaceAll('-', '')}`;
      const position = current.position + offset + 1;
      const type = typeof value.type === 'string' ? value.type : 'message';
      const role = typeof value.role === 'string' ? value.role : null;
      const status = typeof value.status === 'string' ? value.status : null;
      insert.run(
        id,
        conversationId,
        position,
        createdAt,
        type,
        role,
        status,
        JSON.stringify(payload),
      );
      const content = value.type === 'message' && 'content' in value && Array.isArray(value.content)
        ? value.content as Array<{ fileId?: unknown }>
        : [];
      const reference = this.db.prepare(`INSERT OR IGNORE INTO file_references(
        file_id,owner_type,owner_id,created_at
      ) VALUES (?, 'conversation_item', ?, ?)`);
      for (const part of content) {
        if (typeof part.fileId === 'string') reference.run(part.fileId, id, createdAt);
      }
      if (value.type === 'image_generation_call' && 'fileId' in value && typeof value.fileId === 'string') {
        reference.run(value.fileId, id, createdAt);
      }
      return {
        id,
        conversationId,
        position,
        createdAt,
        type,
        ...(role ? { role } : {}),
        ...(status ? { status } : {}),
        payload,
      };
    });
  }

  check(): boolean { return this.db.prepare('SELECT 1 AS ok').get() !== undefined; }
  close(): void { this.db.close(); }
}
