import { randomUUID } from 'node:crypto';
import type { Adapter, Step } from '../agent/TaskRunner.ts';
import { scrapeArticleOrWebpage } from '../ArticleScraper.ts';
type Job = { id: string; action: string; data: Record<string, unknown>; expires: number };
export class BrowserBridge implements Adapter {
  private jobs = new Map<string, { job: Job; delivered: boolean; resolve: (result: Record<string, any>) => void }>();
  private lastSeen = 0;
  private publicSnapshots = new Map<string, { url: string; title: string; text: string; expires: number }>();
  summarize?: (text: string, signal: AbortSignal) => Promise<string>;
  validate(step: Step) {
    if (!['observe', 'read', 'readPublic', 'summarize', 'navigate', 'search', 'play', 'pause', 'select', 'watch'].includes(step.action)) throw new Error('Unsupported browser action.');
    if (step.action === 'select' && typeof step.args.url !== 'string') throw new Error('Selection review must include the exact destination URL.');
    if (step.action === 'readPublic' && typeof step.args.url !== 'string') throw new Error('Provide an exact public page URL.');
    if (step.args.url) {
      const url = new URL(String(step.args.url));
      if (url.protocol !== 'https:' || url.username || url.password) throw new Error('Use an HTTPS URL without credentials.');
    }
    if (step.args.query !== undefined && (typeof step.args.query !== 'string' || step.args.query.length > 500)) throw new Error('Search query too long.');
    if (step.args.service !== undefined && !['google', 'youtube', 'netflix'].includes(String(step.args.service))) throw new Error('Unsupported website adapter.');
    for (const key of ['season', 'episode']) if (step.args[key] !== undefined && (!Number.isSafeInteger(step.args[key]) || Number(step.args[key]) < 1 || Number(step.args[key]) > 999)) throw new Error('Choose a positive season and episode number.');
    if (step.action === 'watch' && (!['youtube', 'netflix'].includes(String(step.args.service)) || typeof step.args.query !== 'string' || !step.args.query.trim())) throw new Error('Watch requires an exact title and supported service.');
  }
  consequential() { return false; } // Scoped navigation/playback only: no arbitrary clicks or form submissions.
  async fingerprint(step: Step) { return JSON.stringify(step); }
  status() { return { connected: Date.now() - this.lastSeen < 10000 }; }
  next() { this.lastSeen = Date.now(); const entry = [...this.jobs.values()].find(row => !row.delivered && row.job.expires > Date.now()); if (!entry) return null; entry.delivered = true; return entry.job; }
  result(id: string, result: Record<string, any>) {
    const row = this.jobs.get(id);
    if (!row || !row.delivered || row.job.expires < Date.now() || !result || JSON.stringify(result).length > 64000) throw new Error('Browser result expired or invalid.');
    this.jobs.delete(id); row.resolve(result);
  }
  async execute(step: Step, signal: AbortSignal): Promise<Record<string, any>> {
    this.validate(step); signal.throwIfAborted();
    if (step.action === 'summarize') {
      if (!this.summarize) return { success: false, error: 'Install local planning for private page summaries.' };
      const read = await this.execute({ ...step, action: step.args.reader === 'public' ? 'readPublic' : 'read' }, signal);
      if (!read.success || !read.text) return read;
      const summary = await this.summarize(read.text, signal);
      return { ...read, text: summary, nextOffset: null, summary: true, message: 'Generated locally from this page excerpt. Verify factual details against the source.' };
    }
    if (step.action === 'readPublic') {
      for (const [id, snapshot] of this.publicSnapshots) if (snapshot.expires < Date.now()) this.publicSnapshots.delete(id);
      let id = String(step.args.documentId || ''), snapshot = this.publicSnapshots.get(id);
      if (id && (!snapshot || snapshot.url !== step.args.url)) return { success: false, stale: true, error: 'Public page snapshot expired. Read it again from the start.' };
      if (!snapshot) {
        if (this.publicSnapshots.size >= 10) return { success: false, error: 'Too many active page snapshots; wait for them to expire.' };
        const page = await scrapeArticleOrWebpage(String(step.args.url)); signal.throwIfAborted();
        if (!page.success) return { success: false, error: 'Public extraction failed. This may require login, Chrome permission or manual reading.' };
        id = randomUUID(); snapshot = { url: String(step.args.url), title: page.title, text: page.fullText.slice(0, 48000), expires: Date.now() + 120000 }; this.publicSnapshots.set(id, snapshot);
      }
      const offset = Number(step.args.offset || 0); if (!Number.isSafeInteger(offset) || offset < 0 || offset > snapshot.text.length) throw new Error('Invalid reading position.');
      return { success: true, reader: 'public', url: snapshot.url, title: snapshot.title, documentId: id, text: snapshot.text.slice(offset, offset + 12000), nextOffset: offset + 12000 < snapshot.text.length ? offset + 12000 : null, truncated: snapshot.text.length === 48000 };
    }
    if (!this.status().connected) return { success: false, error: 'Connect the Chrome extension and grant this site access first.' };
    return new Promise(resolve => {
      const id = randomUUID();
      const finish = (result: Record<string, any>) => { clearTimeout(timer); signal.removeEventListener('abort', cancel); this.jobs.delete(id); resolve(result); };
      const cancel = () => finish({ success: false, uncertain: true, error: 'Browser request cancelled; inspect the tab before repeating.' });
      const timer = setTimeout(() => finish({ success: false, uncertain: true, error: 'Browser response timed out; inspect the tab before repeating.' }), 30000);
      signal.addEventListener('abort', cancel, { once: true });
      this.jobs.set(id, { job: { id, action: step.action, data: structuredClone(step.args), expires: Date.now() + 25000 }, delivered: false, resolve: finish });
    });
  }
}
