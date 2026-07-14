import { execFile } from 'node:child_process';
import { readFile, readdir, stat } from 'node:fs/promises';
import { basename, join, relative } from 'node:path';
import { promisify } from 'node:util';
import { watch, type FSWatcher } from 'chokidar';

const exec = promisify(execFile);

const EXCLUDED = new Set([
  '.git',
  'node_modules',
  'dist',
  'coverage',
  '.env',
  '.nodex',
  '.idea',
  '.vscode',
]);

const AGENTS_PREVIEW_CHARS = 6_000;

function excluded(name: string): boolean {
  return EXCLUDED.has(name) || name.startsWith('.env.') || name === 'credentials.json' || name === '.ssh';
}

function watcherDisabled(): boolean {
  return (
    process.env['NODEX_DISABLE_WATCHER'] === '1' ||
    process.env['CI'] === 'true' ||
    process.env['NODE_ENV'] === 'test' ||
    process.env['VITEST'] === 'true'
  );
}

export interface EnvelopeOptions {
  maxDepth: number;
  maxEntries: number;
  maxBytes: number;
}

async function git(root: string, args: string[]): Promise<string> {
  try {
    return (await exec('git', ['-C', root, ...args], { encoding: 'utf8' })).stdout.trim();
  } catch {
    return '';
  }
}

async function tree(root: string, options: EnvelopeOptions): Promise<string[]> {
  const result: string[] = [];

  async function walk(dir: string, depth: number): Promise<void> {
    if (depth > options.maxDepth || result.length >= options.maxEntries) return;

    let entries;

    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }

    entries.sort((a, b) => a.name.localeCompare(b.name));

    for (const entry of entries) {
      if (excluded(entry.name) || result.length >= options.maxEntries) continue;

      const path = join(dir, entry.name);

      result.push(`${relative(root, path).replaceAll('\\', '/')}${entry.isDirectory() ? '/' : ''}`);

      if (entry.isDirectory()) {
        await walk(path, depth + 1);
      }
    }
  }

  await walk(root, 1);

  return result;
}

async function textPreview(path: string, maxChars: number): Promise<string | undefined> {
  try {
    const value = await readFile(path, 'utf8');

    return value.length > maxChars
      ? `${value.slice(0, maxChars)}\n[NODEX: preview truncated]`
      : value;
  } catch {
    return undefined;
  }
}

function utf8Size(value: unknown): number {
  return Buffer.byteLength(JSON.stringify(value), 'utf8');
}

export function buildRuntimeWorkspaceEnvelope(): Record<string, unknown> {
  return {
    project: null,
    source: 'runtime_tool_workspace',
    agents: 'unknown',
    tree: [],
    note:
      'Nodex did not receive x-nodex-workspace-cwd. The real project is the default cwd used by shell_command tools. Do not infer the project from the Nodex bridge repository.',
  };
}

export async function buildEnvelope(
  root: string,
  options: EnvelopeOptions,
): Promise<Record<string, unknown>> {
  const [branchRaw, statusRaw, entries, agentsPreview] = await Promise.all([
    git(root, ['branch', '--show-current']),
    git(root, ['status', '--porcelain=v1']),
    tree(root, options),
    textPreview(join(root, 'AGENTS.md'), AGENTS_PREVIEW_CHARS),
  ]);

  const branch = branchRaw || (await git(root, ['rev-parse', '--short', 'HEAD'])) || null;
  const statusLines = statusRaw ? statusRaw.split(/\r?\n/) : [];

  let hasAgents = false;

  try {
    hasAgents = (await stat(join(root, 'AGENTS.md'))).isFile();
  } catch {
    hasAgents = false;
  }

  const envelope: Record<string, unknown> = {
    project: basename(root),
    root,
    source: 'explicit_workspace_root',
    branch,
    git: {
      dirty: statusLines.length,
      files: statusLines.slice(0, 20),
    },
    agents: hasAgents,
    agentsPreview,
    tree: entries,
  };

  while (utf8Size(envelope) > options.maxBytes && (envelope.tree as string[]).length) {
    (envelope.tree as string[]).pop();
  }

  if (utf8Size(envelope) > options.maxBytes) delete envelope.agentsPreview;
  if (utf8Size(envelope) > options.maxBytes) envelope.git = { dirty: statusLines.length };
  if (utf8Size(envelope) > options.maxBytes) delete envelope.tree;
  if (utf8Size(envelope) > options.maxBytes) delete envelope.agents;
  if (utf8Size(envelope) > options.maxBytes) delete envelope.branch;
  if (utf8Size(envelope) > options.maxBytes) delete envelope.root;
  if (utf8Size(envelope) > options.maxBytes) delete envelope.project;
  if (utf8Size(envelope) > options.maxBytes) return {};

  return envelope;
}

export class EnvelopeCache {
  private value?: Record<string, unknown>;
  private expires = 0;
  private readonly watcher?: FSWatcher;

  constructor(
    private readonly root: string,
    private readonly options: EnvelopeOptions,
    private readonly ttlMs = 5_000,
  ) {
    if (!watcherDisabled()) {
      this.watcher = watch(root, {
        ignored: [
          ...[...EXCLUDED].map((name) => `**/${name}/**`),
          '**/.env*',
          '**/credentials.json',
          '**/.ssh/**',
        ],
        ignoreInitial: true,
        persistent: false,
      }).on('all', () => this.invalidate());
    }
  }

  invalidate(): void {
    this.expires = 0;
  }

  async get(): Promise<Record<string, unknown>> {
    if (!this.value || Date.now() >= this.expires) {
      this.value = await buildEnvelope(this.root, this.options);
      this.expires = Date.now() + this.ttlMs;
    }

    return this.value;
  }

  async close(): Promise<void> {
    await this.watcher?.close();
  }
}