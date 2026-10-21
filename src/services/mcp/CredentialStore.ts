import { windowsPowerShell } from '../system/WindowsPowerShell.ts';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

export type SecretCodec = (operation: 'protect' | 'unprotect', value: string) => Promise<string>;
export const encryptionCodec: SecretCodec = async (operation, value) => {
  if (process.platform !== 'win32') throw new Error('Persistent tokens currently require Windows.');
  const script = process.env.SAMEERA_NATIVE_ROOT ? path.join(process.env.SAMEERA_NATIVE_ROOT, 'scripts/windows-credentials.ps1') : fileURLToPath(new URL('../../../scripts/windows-credentials.ps1', import.meta.url));
  return new Promise((resolve, reject) => {
    const child = spawn(windowsPowerShell(), ['-NoProfile', '-NonInteractive', '-File', script], { windowsHide: true });
    let output = '';
    const timer = setTimeout(() => { child.kill(); reject(new Error('Windows credential encryption timed out.')); }, 10000);
    child.stdout.on('data', data => { output += data; if (output.length > 1024 * 1024) child.kill(); });
    child.stderr.resume();
    child.on('error', () => { clearTimeout(timer); reject(new Error('Windows credential service unavailable.')); });
    child.on('close', code => {
      clearTimeout(timer);
      try { if (code !== 0) throw new Error(); resolve(JSON.parse(output.trim()).value); }
      catch { reject(new Error('Could not encrypt or read this connection token for your Windows account.')); }
    });
    child.stdin.on('error', () => {});
    child.stdin.end(JSON.stringify({ operation, value }));
  });
};

export class CredentialStore {
  constructor(private folder: string, private transform: SecretCodec = encryptionCodec) {}
  private file(id: string) {
    if (!/^[a-f0-9-]{36}$/i.test(id)) throw new Error('Invalid credential reference.');
    return path.join(this.folder, `${id}.bin`);
  }
  async set(id: string, value: string): Promise<void> {
    if (!value || value.length > 4096 || /[\s\x00-\x1f]/.test(value)) throw new Error('Enter a bearer token without spaces, up to 4096 characters.');
    const file = this.file(id);
    const encrypted = await this.transform('protect', value);
    await fs.mkdir(this.folder, { recursive: true });
    await fs.writeFile(file + '.tmp', encrypted, { mode: 0o600 });
    await fs.rename(file + '.tmp', file);
  }
  async get(id: string): Promise<string | undefined> {
    const encrypted = await fs.readFile(this.file(id), 'utf8').catch((error: NodeJS.ErrnoException) => { if (error.code === 'ENOENT') return undefined; throw error; });
    return encrypted ? this.transform('unprotect', encrypted) : undefined;
  }
  async remove(id: string): Promise<void> { await fs.rm(this.file(id), { force: true }); }
}
