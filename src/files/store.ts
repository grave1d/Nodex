import { createHash, randomUUID } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { lstat, mkdir, open, realpath, rename, rm } from 'node:fs/promises';
import { basename, join, resolve, sep } from 'node:path';
import type { NodexConfig } from '../config.js';
import { NodexError } from '../errors.js';
import type { SessionStore, StoredFileRecord } from '../session/store.js';
import type { TransportAttachment } from '../transport/types.js';

const SENSITIVE_NAME = /^(?:\.env(?:\..*)?|credentials(?:\.json)?|cookies?(?:\.json)?)$/i;
const SENSITIVE_EXTENSION = /\.(?:sqlite(?:3)?|db|pem|key)$/i;

function hasControlChars(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);

    if (code <= 0x1f || code === 0x7f) {
      return true;
    }
  }

  return false;
}

function safeFilename(value: string): string {
  const filename = value.trim();

  if (!filename || filename.length > 255 || filename !== basename(filename) || hasControlChars(filename)) {
    throw new NodexError('invalid_request', 'Invalid upload filename');
  }

  if (SENSITIVE_NAME.test(filename) || SENSITIVE_EXTENSION.test(filename)) {
    throw new NodexError('invalid_request', 'Sensitive credential or database files are not accepted');
  }

  return filename;
}

function startsWith(bytes: Buffer, signature: number[]): boolean {
  return signature.every((value, index) => bytes[index] === value);
}

function sniffMime(prefix: Buffer, declared: string): string {
  let detected: string | undefined;

  if (startsWith(prefix, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    detected = 'image/png';
  } else if (startsWith(prefix, [0xff, 0xd8, 0xff])) {
    detected = 'image/jpeg';
  } else if (prefix.subarray(0, 4).toString('ascii') === 'GIF8') {
    detected = 'image/gif';
  } else if (
    prefix.subarray(0, 4).toString('ascii') === 'RIFF' &&
    prefix.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    detected = 'image/webp';
  } else if (prefix.subarray(0, 5).toString('ascii') === '%PDF-') {
    detected = 'application/pdf';
  }

  const normalized = declared.split(';', 1)[0]?.trim().toLowerCase() || 'application/octet-stream';

  if (detected) {
    if (normalized !== 'application/octet-stream' && normalized !== detected) {
      throw new NodexError('invalid_request', `Declared MIME ${normalized} does not match ${detected}`);
    }

    return detected;
  }

  if (normalized.startsWith('image/') || normalized === 'application/pdf') {
    throw new NodexError('invalid_request', `File signature does not match declared MIME ${normalized}`);
  }

  if (normalized.startsWith('text/') || normalized === 'application/json') {
    if (prefix.includes(0)) {
      throw new NodexError('invalid_request', 'Text upload contains binary data');
    }

    return normalized;
  }

  return normalized;
}

export class FileStore {
  private readonly root: string;
  private readonly maxBytes: number;
  private readonly purposes: Set<string>;
  private readonly retentionDays: number;

  constructor(config: NodexConfig['files'], private readonly metadata: SessionStore) {
    this.root = resolve(config.root);
    this.maxBytes = config.maxBytes;
    this.purposes = new Set(config.allowedPurposes);
    this.retentionDays = config.retentionDays;
  }

  async initialize(): Promise<void> {
    await mkdir(this.root, { recursive: true, mode: 0o700 });
  }

  async upload(
    stream: AsyncIterable<Buffer | Uint8Array>,
    options: { filename: string; purpose: string; mimeType: string },
  ): Promise<StoredFileRecord> {
    await this.initialize();

    const filename = safeFilename(options.filename);

    if (!this.purposes.has(options.purpose)) {
      throw new NodexError('invalid_request', `Unsupported file purpose: ${options.purpose}`);
    }

    const storageKey = createHash('sha256').update(`${randomUUID()}:${Date.now()}`).digest('hex');
    const temporary = join(this.root, `.tmp-${randomUUID()}`);
    const destination = this.pathForKey(storageKey);
    const handle = await open(temporary, 'wx', 0o600);
    const checksum = createHash('sha256');
    const prefixChunks: Buffer[] = [];

    let prefixBytes = 0;
    let bytes = 0;

    try {
      for await (const value of stream) {
        const chunk = Buffer.isBuffer(value) ? value : Buffer.from(value);

        bytes += chunk.length;

        if (bytes > this.maxBytes) {
          throw new NodexError('invalid_request', `File exceeds ${this.maxBytes} byte limit`);
        }

        checksum.update(chunk);

        if (prefixBytes < 512) {
          const part = chunk.subarray(0, 512 - prefixBytes);
          prefixChunks.push(part);
          prefixBytes += part.length;
        }

        await handle.write(chunk);
      }

      if (!bytes) {
        throw new NodexError('invalid_request', 'Empty files are not accepted');
      }

      await handle.sync();
    } catch (error) {
      await handle.close().catch(() => undefined);
      await rm(temporary, { force: true }).catch(() => undefined);
      throw error;
    }

    await handle.close();

    let mimeType: string;

    try {
      mimeType = sniffMime(Buffer.concat(prefixChunks), options.mimeType);
      await rename(temporary, destination);
    } catch (error) {
      await rm(temporary, { force: true }).catch(() => undefined);
      throw error;
    }

    const createdAt = Math.floor(Date.now() / 1000);
    const record: StoredFileRecord = {
      id: `file_${randomUUID().replaceAll('-', '')}`,
      filename,
      purpose: options.purpose,
      mimeType,
      bytes,
      checksum: checksum.digest('hex'),
      createdAt,
      ...(this.retentionDays ? { expiresAt: createdAt + this.retentionDays * 24 * 60 * 60 } : {}),
      storageKey,
    };

    try {
      this.metadata.createFileRecord(record);
      return record;
    } catch (error) {
      await rm(destination, { force: true }).catch(() => undefined);
      throw error;
    }
  }

  get(id: string): StoredFileRecord | undefined {
    return this.metadata.getFile(id);
  }

  list(limit?: number, after?: string): StoredFileRecord[] {
    return this.metadata.listFiles(limit, after);
  }

  async contentPath(id: string): Promise<{ file: StoredFileRecord; path: string }> {
    const file = this.metadata.getFile(id);

    if (!file) {
      throw new NodexError('invalid_request', `Unknown or deleted file: ${id}`);
    }

    const path = this.pathForKey(file.storageKey);
    const stat = await lstat(path).catch(() => undefined);

    if (!stat?.isFile() || stat.isSymbolicLink()) {
      throw new NodexError('invalid_request', `Stored content is unavailable: ${id}`);
    }

    const [rootPath, filePath] = await Promise.all([realpath(this.root), realpath(path)]);

    if (!filePath.startsWith(`${rootPath}${sep}`)) {
      throw new NodexError('invalid_request', 'Stored file escaped the configured root');
    }

    return { file, path: filePath };
  }

  async openContent(id: string): Promise<{ file: StoredFileRecord; stream: ReturnType<typeof createReadStream> }> {
    const content = await this.contentPath(id);
    return { file: content.file, stream: createReadStream(content.path) };
  }

  async importDataUrl(value: string, options: { filename: string; purpose: string }): Promise<StoredFileRecord> {
    const match = /^data:([^;,]+);base64,([a-zA-Z0-9+/=\s]+)$/.exec(value);

    if (!match?.[1] || !match[2]) {
      throw new NodexError('invalid_request', 'Only base64 data URLs are supported inline');
    }

    const encoded = match[2].replace(/\s/g, '');

    if (Math.ceil((encoded.length * 3) / 4) > this.maxBytes) {
      throw new NodexError('invalid_request', `Inline file exceeds ${this.maxBytes} byte limit`);
    }

    const buffer = Buffer.from(encoded, 'base64');

    return this.upload(
      (async function* () {
        yield buffer;
      })(),
      { filename: options.filename, purpose: options.purpose, mimeType: match[1] },
    );
  }

  async attachment(
    id: string,
    kind: 'image' | 'file',
    order: number,
    detail?: 'auto' | 'low' | 'high',
  ): Promise<TransportAttachment> {
    const content = await this.contentPath(id);

    if (kind === 'image' && !content.file.mimeType.startsWith('image/')) {
      throw new NodexError('invalid_request', `File ${id} is not an image`);
    }

    return {
      kind,
      order,
      fileId: content.file.id,
      filename: content.file.filename,
      mimeType: content.file.mimeType,
      bytes: content.file.bytes,
      ...(detail ? { detail } : {}),
      open: () => createReadStream(content.path),
    };
  }

  async delete(id: string): Promise<boolean> {
    const file = this.metadata.getFile(id);

    if (file && this.metadata.isFileReferenced(id)) {
      throw new NodexError('invalid_request', `File is referenced by active history: ${id}`);
    }

    if (!file || !this.metadata.markFileDeleted(id)) {
      return false;
    }

    await rm(this.pathForKey(file.storageKey), { force: true });
    return true;
  }

  private pathForKey(storageKey: string): string {
    if (!/^[a-f0-9]{64}$/.test(storageKey)) {
      throw new NodexError('invalid_request', 'Invalid storage key');
    }

    const path = resolve(this.root, storageKey);

    if (!path.startsWith(`${this.root}${sep}`)) {
      throw new NodexError('invalid_request', 'Storage path escaped configured root');
    }

    return path;
  }
}