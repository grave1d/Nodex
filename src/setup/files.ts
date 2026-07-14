import { createHash, randomBytes } from 'node:crypto';
import { chmod, copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import type { DiscoveredNotionAgent } from '../transport/types.js';

export const DEFAULT_MODEL_ID = 'codex-notion-agent';
export const SECURITY_GITIGNORE_ENTRIES = [
  '.env',
  '.nodex/',
  'nodex.config.local.json',
  '*.sqlite',
  '*.sqlite-shm',
  '*.sqlite-wal',
] as const;

export interface ConfigUpdatePlan {
  path: string;
  exists: boolean;
  changed: boolean;
  summary: string[];
  next: Record<string, unknown>;
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function serialized(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

async function readOptional(path: string): Promise<string | undefined> {
  try { return await readFile(path, 'utf8'); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined;
    throw error;
  }
}

function generatedBinding(
  agent: DiscoveredNotionAgent,
  existing: Record<string, unknown> = {},
): Record<string, unknown> {
  const binding: Record<string, unknown> = {
    ...existing,
    agentInstructionsPageId: agent.agentInstructionsPageId,
    agentName: agent.name,
    notionModel: agent.modelName ?? agent.modelSlug ?? 'Notion Custom Agent',
    ...(agent.modelSlug ? { notionModelSlug: agent.modelSlug } : {}),
    syncNotionModel: true,
    capabilities: Object.keys(record(existing['capabilities'])).length
      ? existing['capabilities']
      : {
      reasoningSummaries: true,
      functionCalling: true,
      imageInput: false,
      fileInput: false,
      imageGeneration: false,
      imageEdit: false,
      },
  };
  if (!agent.modelSlug) delete binding['notionModelSlug'];
  delete binding['agentPageId'];
  return binding;
}

export async function planConfigUpdate(
  agent: DiscoveredNotionAgent,
  path = join(process.cwd(), 'nodex.config.json'),
  modelId = DEFAULT_MODEL_ID,
): Promise<ConfigUpdatePlan> {
  const source = await readOptional(path);
  const exists = source !== undefined;
  let current: Record<string, unknown> = {};
  if (source !== undefined) {
    const parsed = JSON.parse(source) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('nodex.config.json must contain a JSON object');
    }
    current = parsed as Record<string, unknown>;
  }

  const models = { ...record(current['models']) };
  const summary: string[] = [];
  for (const [id, rawModel] of Object.entries(models)) {
    const model = { ...record(rawModel) };
    const legacy = typeof model['agentPageId'] === 'string' ? model['agentPageId'] : undefined;
    const canonical = typeof model['agentInstructionsPageId'] === 'string'
      ? model['agentInstructionsPageId']
      : undefined;
    if (legacy) {
      model['agentInstructionsPageId'] = canonical ?? legacy;
      delete model['agentPageId'];
      models[id] = model;
      summary.push(`${id}: agentPageId → agentInstructionsPageId`);
    }
  }

  const nextBinding = generatedBinding(agent, record(models[modelId]));
  if (serialized(models[modelId]) !== serialized(nextBinding)) {
    models[modelId] = nextBinding;
    summary.push(`${modelId}: ${agent.name}`);
  }
  const next = { ...current, models };
  const changed = serialized(current) !== serialized(next);
  return { path, exists, changed, summary, next };
}

function backupTimestamp(now: Date): string {
  return now.toISOString().replaceAll(/[-:.]/g, '');
}

export async function writeConfigPlan(
  plan: ConfigUpdatePlan,
  now = new Date(),
  backupRoot = join(homedir(), '.nodex', 'backups'),
): Promise<{ backupPath?: string }> {
  if (!plan.changed) return {};
  await mkdir(dirname(plan.path), { recursive: true });
  let backupPath: string | undefined;
  if (plan.exists) {
    const projectHash = createHash('sha256').update(resolve(plan.path)).digest('hex').slice(0, 12);
    const backupDirectory = join(backupRoot, projectHash);
    await mkdir(backupDirectory, { recursive: true, mode: 0o700 });
    backupPath = join(backupDirectory, `${basename(plan.path)}-${backupTimestamp(now)}.backup`);
    await copyFile(plan.path, backupPath);
    await chmod(backupPath, 0o600);
  }
  await writeFile(plan.path, serialized(plan.next), { encoding: 'utf8', mode: 0o600 });
  await chmod(plan.path, 0o600);
  return backupPath ? { backupPath } : {};
}

function unquoteEnv(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length >= 2 && trimmed.startsWith('"') && trimmed.endsWith('"')) {
    try { return JSON.parse(trimmed) as string; }
    catch { return trimmed.slice(1, -1); }
  }
  if (trimmed.length >= 2 && trimmed.startsWith("'") && trimmed.endsWith("'")) {
    return trimmed.slice(1, -1);
  }
  return trimmed.replace(/\s+#.*$/, '');
}

export function parseEnv(source: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const line of source.split(/\r?\n/)) {
    const match = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line);
    if (match?.[1] && match[2] !== undefined) result[match[1]] = unquoteEnv(match[2]);
  }
  return result;
}

export async function loadLocalEnv(
  path = join(process.cwd(), '.env'),
  env: NodeJS.ProcessEnv = process.env,
): Promise<string[]> {
  const source = await readOptional(path);
  if (source === undefined) return [];
  const loaded: string[] = [];
  for (const [name, value] of Object.entries(parseEnv(source))) {
    if (env[name] !== undefined) continue;
    env[name] = value;
    loaded.push(name);
  }
  return loaded;
}

export function maskApiKey(value: string): string {
  const prefix = value.startsWith('nodex_') ? 'nodex_' : '';
  const suffix = value.length >= prefix.length + 8 ? value.slice(-4) : '';
  return `${prefix}••••${suffix}`;
}

export async function ensureLocalApiKey(
  path = join(process.cwd(), '.env'),
): Promise<{ path: string; created: boolean; masked: string }> {
  const source = await readOptional(path) ?? '';
  const existing = parseEnv(source)['NODEX_API_KEY'];
  if (existing) return { path, created: false, masked: maskApiKey(existing) };

  const key = `nodex_${randomBytes(32).toString('base64url')}`;
  const separator = source && !source.endsWith('\n') ? '\n' : '';
  const next = `${source}${separator}NODEX_API_KEY=${key}\n`;
  await mkdir(dirname(path), { recursive: true, mode: 0o700 });
  await writeFile(path, next, { encoding: 'utf8', mode: 0o600 });
  await chmod(path, 0o600);
  return { path, created: true, masked: maskApiKey(key) };
}

export async function missingGitignoreEntries(
  path = join(process.cwd(), '.gitignore'),
): Promise<string[]> {
  const source = await readOptional(path) ?? '';
  const entries = new Set(source.split(/\r?\n/).map((line) => line.trim()).filter(Boolean));
  return SECURITY_GITIGNORE_ENTRIES.filter((entry) => !entries.has(entry));
}

export async function appendGitignoreEntries(
  entries: readonly string[],
  path = join(process.cwd(), '.gitignore'),
): Promise<void> {
  if (!entries.length) return;
  const source = await readOptional(path) ?? '';
  const separator = source && !source.endsWith('\n') ? '\n' : '';
  const header = source.trim() ? '# Nodex local data\n' : '';
  await writeFile(path, `${source}${separator}${header}${entries.join('\n')}\n`, 'utf8');
}

export function codexConfigSnippet(modelId = DEFAULT_MODEL_ID): string {
  return `model = "${modelId}"
model_provider = "nodex"

[model_providers.nodex]
name = "Nodex"
base_url = "http://127.0.0.1:8787/v1"
env_key = "NODEX_API_KEY"
wire_api = "responses"
requires_openai_auth = false`;
}
