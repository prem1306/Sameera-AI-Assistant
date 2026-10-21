import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID, createHash } from 'node:crypto';
import { checkedPath, hash, windowsAction, type NativeAction } from './ActionSupport.ts';
import { docxText } from './DocumentText.ts';
import type { Adapter, Step } from '../agent/TaskRunner.ts';
type Entry = { path: string; hash: string; textHash: string; warnings: string[]; size: number; modified: number; identity: number };
type Group = { basis: 'identical-file' | 'matching-text'; files: Entry[] };
export type DuplicateReport = { id: string; groups: Group[]; skipped: { path: string; reason: string }[]; scanned: number; expires: number };
export class DuplicateService implements Adapter {
  private reports = new Map<string, DuplicateReport>();
  constructor(private native: NativeAction = windowsAction) {}
  validate(step: Step) {
    if (!['scan', 'recycle'].includes(step.action)) throw new Error('Unsupported duplicate action.');
    if (step.action === 'scan' && !(typeof step.args.folder === 'string' || Array.isArray(step.args.paths))) throw new Error('Choose a folder or explicit file list.');
    if (step.action === 'recycle' && (!Array.isArray(step.args.paths) || !step.args.paths.length || typeof step.args.reportId !== 'string')) throw new Error('Select copies from a duplicate report.');
  }
  consequential(step: Step) { return step.action === 'recycle'; }
  private selection(step: Step) {
    const report = this.reports.get(String(step.args.reportId));
    if (!report || report.expires < Date.now()) throw new Error('Scan expired. Scan again.');
    const selected = new Set(step.args.paths as string[]);
    const all = report.groups.flatMap(group => group.files);
    if ([...selected].some(file => !all.some(entry => entry.path === file))) throw new Error('Selection is outside this report.');
    for (const group of report.groups) if (group.files.every(file => selected.has(file.path))) throw new Error('Keep at least one copy in each group.');
    return { report, selected, all };
  }
  async fingerprint(step: Step) {
    const { all } = this.selection(step); const digest = createHash('sha256').update(JSON.stringify(step));
    for (const entry of all) {
      const target = await checkedPath(entry.path), stat = await fs.stat(target);
      if (stat.size !== entry.size || stat.mtimeMs !== entry.modified || stat.ino !== entry.identity || hash(await fs.readFile(target)) !== entry.hash) throw new Error('A scanned document changed. Scan again.');
      digest.update(entry.hash).update(target);
    }
    return digest.digest('hex');
  }
  async execute(step: Step, signal: AbortSignal, progress?: (completed: number, total: number) => void) {
    this.validate(step);
    if (step.action === 'scan') return this.scan(step.args, signal, progress);
    await this.fingerprint(step);
    const { report, selected } = this.selection(step);
    const results: Record<string, any>[] = [];
    for (const target of selected) {
      if (signal.aborted) break;
      // Revalidate remaining files and the keeper immediately before each removal.
      try { await this.fingerprint(step); } catch { results.push({ path: target, success: false, error: 'Document or keeper changed. Scan again.' }); break; }
      const entry = report.groups.flatMap(group => group.files).find(entry => entry.path === target)!;
      const keepers = report.groups.flatMap(group => group.files.filter(entry => !selected.has(entry.path))).map(entry => ({ path: entry.path, hash: entry.hash }));
      let result;
      try { result = await this.native('recycle', { path: target, expectedHash: entry.hash, keepers }); } catch { result = { success: false, uncertain: true, error: 'Recycling could not be confirmed. Inspect Recycle Bin.' }; }
      results.push({ path: target, ...result });
      if (!result.success) break;
      for (const group of report.groups) group.files = group.files.filter(entry => entry.path !== target);
      (step.args.paths as string[]) = (step.args.paths as string[]).filter(file => file !== target);
    }
    this.reports.delete(report.id);
    return { success: !signal.aborted && results.length === selected.size && results.every(row => row.success), cancelled: signal.aborted, results, receipt: { createdAt: new Date().toISOString(), approvedCount: selected.size, recycledCount: results.filter(row => row.success).length }, message: 'Approved copies were sent to Recycle Bin where successful. Restore them from Windows Recycle Bin if needed. Scan again before another cleanup.' };
  }
  private async scan(args: Record<string, unknown>, signal: AbortSignal, progress?: (completed: number, total: number) => void) {
    const candidates: string[] = [];
    const skipped: DuplicateReport['skipped'] = [];
    let visited = 0;
    const visit = async (folder: string, depth: number) => {
      if (depth > 20) { skipped.push({ path: folder, reason: 'Folder depth limit.' }); return; }
      for (const item of await fs.readdir(folder, { withFileTypes: true })) {
        signal.throwIfAborted(); if (++visited > 10000) throw new Error('Scan exceeds 10,000 entries; choose a smaller folder.');
        const target = path.join(folder, item.name);
        if (item.isSymbolicLink()) { skipped.push({ path: target, reason: 'Links are excluded.' }); continue; }
        try { await checkedPath(target); } catch { skipped.push({ path: target, reason: 'Protected path.' }); continue; }
        if (item.isDirectory()) await visit(target, depth + 1);
        else if (/\.docx?$/i.test(item.name) && !item.name.startsWith('~$')) candidates.push(target);
      }
    };
    if (args.folder) { const folder = await checkedPath(args.folder); if (folder === path.parse(folder).root) throw new Error('Choose a specific personal folder, not a drive.'); await visit(folder, 0); }
    else {
      if (!Array.isArray(args.paths) || args.paths.length > 2000) throw new Error('Choose at most 2,000 files.');
      for (const file of args.paths) candidates.push(await checkedPath(file));
    }
    const entries: Entry[] = [];
    const total = new Set(candidates).size; let completed = 0; progress?.(0, total);
    for (const target of new Set(candidates)) {
      signal.throwIfAborted();
      try {
        if (!/\.docx?$/i.test(target)) throw new Error('Only .doc and .docx are supported.');
        const before = await fs.stat(target);
        if (!before.isFile() || before.size > 32000000) throw new Error('File exceeds 32 MB or is not a regular file.');
        const bytes = await fs.readFile(target);
        let extracted;
        if (/\.docx$/i.test(target)) extracted = docxText(bytes);
        else { const result = await this.native('wordInspectDuplicate', { path: target }); if (!result.success || typeof result.text !== 'string') throw new Error('Legacy Word inspection failed or is locked.'); extracted = { text: result.text.normalize('NFC').replace(/\s+/gu, ' ').trim(), warnings: ['Legacy document: visually compare formatting, images, comments and revisions.'] }; }
        const after = await fs.stat(target);
        if (before.mtimeMs !== after.mtimeMs || hash(bytes) !== hash(await fs.readFile(target))) throw new Error('File changed during scan.');
        entries.push({ path: target, hash: hash(bytes), textHash: hash(Buffer.from(extracted.text)), warnings: extracted.warnings, size: before.size, modified: before.mtimeMs, identity: before.ino });
      } catch (error) { skipped.push({ path: target, reason: error instanceof Error ? error.message : 'Unable to inspect file.' }); }
      progress?.(++completed, total);
    }
    const buckets = new Map<string, Entry[]>();
    for (const entry of entries) { const key = entry.textHash; buckets.set(key, [...(buckets.get(key) || []), entry]); }
    const groups: Group[] = [...buckets.values()].filter(files => files.length > 1).map(files => ({ basis: files.every(file => file.hash === files[0].hash) ? 'identical-file' : 'matching-text', files }));
    const report = { id: randomUUID(), groups, skipped, scanned: entries.length, expires: Date.now() + 15 * 60000 };
    for (const [id, row] of this.reports) if (row.expires < Date.now()) this.reports.delete(id);
    if (this.reports.size >= 10) throw new Error('Too many active scans. Wait for previous reports to expire.');
    this.reports.set(report.id, report);
    return { success: true, report: structuredClone(report), groupCount: groups.length, duplicateFiles: groups.reduce((n, group) => n + group.files.length, 0), extraCopies: groups.reduce((n, group) => n + group.files.length - 1, 0) };
  }
}
