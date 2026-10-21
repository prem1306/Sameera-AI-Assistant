import fs from 'node:fs/promises';
import path from 'node:path';
import type { ConversationMemory } from '../../types/assistant.ts';
import { encryptionCodec, type SecretCodec } from '../mcp/CredentialStore.ts';

/** Opt-in summaries live in a DPAPI-encrypted file, never browser storage or SQL. */
export class MemoryStore {
  private queue: Promise<unknown> = Promise.resolve();
  constructor(private file: string, private codec: SecretCodec = encryptionCodec) {}
  async list(): Promise<ConversationMemory[]> {
    const encrypted = await fs.readFile(this.file, 'utf8').catch((error: NodeJS.ErrnoException) => { if (error.code === 'ENOENT') return ''; throw error; });
    return encrypted ? JSON.parse(await this.codec('unprotect', encrypted)) : [];
  }
  replace(memories: unknown): Promise<void> {
    if (!Array.isArray(memories) || memories.length > 25 || JSON.stringify(memories).length > 64000 || memories.some(row => !row || typeof row.id !== 'string' || typeof row.summary !== 'string' || !Array.isArray(row.topics) || !Array.isArray(row.keyDetails))) throw new Error('Invalid summaries; limit 25 and 64 KB.');
    const copy = JSON.stringify(memories.map(row => ({ id: row.id, summary: row.summary.slice(0, 4000), topics: row.topics.filter((v: unknown) => typeof v === 'string').slice(0, 20), keyDetails: row.keyDetails.filter((v: unknown) => typeof v === 'string').slice(0, 20), timestamp: String(row.timestamp || ''), dateStr: String(row.dateStr || ''), durationSeconds: Number(row.durationSeconds) || 0 })));
    const save = this.queue.catch(() => {}).then(async () => {
      const encrypted = await this.codec('protect', copy);
      await fs.mkdir(path.dirname(this.file), { recursive: true });
      await fs.writeFile(this.file + '.tmp', encrypted, { mode: 0o600 });
      await fs.rename(this.file + '.tmp', this.file);
    });
    this.queue = save; return save;
  }
}
