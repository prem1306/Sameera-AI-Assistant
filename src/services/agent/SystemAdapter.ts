import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import type { Adapter, Step } from './TaskRunner.ts';
import { checkedPath, windowsAction } from '../system/ActionSupport.ts';
import type { SystemActions } from '../SystemActions.ts';
const allowed = new Set(['status', 'listFolder', 'findFile', 'readText', 'openFile', 'openApplication', 'closeApplication', 'listApplications', 'listRunningApplications', 'openChrome', 'wordDraft', 'wordOpen', 'wordRead', 'wordReplace', 'wordAppend', 'wordSave', 'notepadDraft', 'createFolder', 'writeText', 'replaceText', 'copy', 'move', 'rename', 'recycle', 'volume', 'brightness']);
const writes = new Set(['closeApplication', 'wordReplace', 'wordAppend', 'wordSave', 'writeText', 'replaceText', 'copy', 'move', 'rename', 'recycle']);
export class SystemAdapter implements Adapter {
  private versions = new Map<string, { file?: string; document?: string }>();
  constructor(private actions: SystemActions) {}
  validate(step: Step) { if (!allowed.has(step.action)) throw new Error('Unsupported Windows action.'); }
  consequential(step: Step) { return writes.has(step.action); }
  async fingerprint(step: Step) {
    const hash = createHash('sha256').update(JSON.stringify(step));
    const versions: { file?: string; document?: string } = {};
    const targets = { path: step.args.path, destination: step.action === 'rename' && typeof step.args.path === 'string' && typeof step.args.newName === 'string' ? path.join(path.dirname(step.args.path), step.args.newName) : step.args.destination };
    for (const key of ['path', 'destination'] as const) {
      if (!targets[key]) continue;
      const target = await checkedPath(targets[key]);
      const stat = await fs.stat(target).catch(() => null);
      if (stat?.isDirectory() && this.consequential(step)) throw new Error('Review individual files; recursive directory changes are not supported by agent tasks.');
      if (stat && stat.size > 128 * 1024 * 1024) throw new Error('File too large for verified changes.');
      hash.update(JSON.stringify(stat ? { ino: stat.ino, size: stat.size, mtime: stat.mtimeMs } : null));
      if (stat?.isFile()) { const bytes = await fs.readFile(target); hash.update(bytes); if (key === 'path') versions.file = createHash('sha256').update(bytes).digest('hex'); }
    }
    if (['wordReplace', 'wordAppend', 'wordSave'].includes(step.action)) {
      const result = await windowsAction('wordFingerprint', { path: await checkedPath(step.args.path) });
      if (!result.success || typeof result.version !== 'string') throw new Error('Cannot verify the open Word document.');
      versions.document = result.version; hash.update(result.version);
    }
    this.versions.set(JSON.stringify(step), versions);
    return hash.digest('hex');
  }
  async execute(step: Step, signal: AbortSignal) {
    signal.throwIfAborted();
    this.actions.resumeFromUser();
    const args = { ...step.args };
    const versions = this.versions.get(JSON.stringify(step)); this.versions.delete(JSON.stringify(step));
    // The exact-action review already inspected the complete local file version.
    if (['writeText', 'replaceText'].includes(step.action) && args.path) {
      if (versions?.file && !args.expectedVersion) args.expectedVersion = versions.file;
    }
    if (versions?.file) args.expectedHash = versions.file;
    if (versions?.document) args.expectedDocumentVersion = versions.document;
    return this.actions.execute(randomUUID(), step.action, args, signal);
  }
}
