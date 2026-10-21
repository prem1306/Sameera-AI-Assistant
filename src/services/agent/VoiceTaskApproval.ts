import type { TaskRunner, Task } from './TaskRunner.ts';

const safe: Record<string, Set<string>> = {
  research: new Set(['searchToNotepad']),
  system: new Set(['status', 'listFolder', 'findFile', 'readText', 'listApplications', 'listRunningApplications', 'wordRead', 'notepadDraft', 'wordDraft']),
  browser: new Set(['observe', 'read', 'readPublic', 'summarize', 'navigate', 'search', 'select', 'play', 'pause', 'watch']),
  duplicates: new Set(['scan']),
};
const normalize = (text: string) => text.normalize('NFKC').toLowerCase().replace(/[.,!?।]+/gu, ' ').replace(/\s+/gu, ' ').trim();
// Explicit task confirmation only: generic conversational affirmatives never authorize.
const yes = new Set(['go for it', 'just go for it', 'confirm this task', 'ఈ పనిని చేయండి', 'இந்த பணியை செய்யுங்கள்', 'ಈ ಕೆಲಸವನ್ನು ಮಾಡಿ', 'ഈ ജോലി ചെയ്യൂ', 'यह काम कर दो']);
const no = new Set(['no', 'no thanks', 'cancel', 'stop', 'do not do it', "don't do it", 'వద్దు', 'வேண்டாம்', 'ಬೇಡ', 'വേണ്ട', 'नहीं']);
const snapshot = (task: Task) => JSON.stringify([task.steps, task.index, task.approval, task.expires]);

/** Session-owned consent from speech recognition only; never expose this as a model/client tool. */
export class VoiceTaskApproval {
  private offer?: { id: string; snapshot: string; deadline: number; armed: boolean };
  private buffer = '';
  constructor(private tasks: TaskRunner, private otherReviews: () => boolean = () => false, private now = Date.now) {}
  clear() { this.offer = undefined; this.buffer = ''; }
  private eligible(task: Task) {
    return task.state === 'waiting-approval' && task.approval === 'scope' && task.expires > this.now()
      && task.steps.every(step => Object.hasOwn(safe, step.capability) && safe[step.capability].has(step.action))
      && this.tasks.list().filter(row => row.state === 'waiting-approval' && row.expires > this.now()).length === 1
      && !this.otherReviews();
  }
  propose(id: string) {
    this.clear();
    const task = this.tasks.get(id);
    if (!this.eligible(task)) return false;
    this.offer = { id, snapshot: snapshot(task), deadline: Math.min(task.expires, this.now() + 60000), armed: false };
    return true;
  }
  announced(text: string) {
    // The confirmation phrase must actually have been spoken in a completed assistant turn.
    if (this.offer && /go for it/i.test(text)) this.offer.armed = true;
  }
  async input(text: string, finished: boolean): Promise<Task | null> {
    if (!this.offer?.armed) return null;
    if (text.startsWith(this.buffer)) this.buffer = text;
    else if (!this.buffer.endsWith(text)) this.buffer += ` ${text}`;
    if (this.buffer.length > 160) { this.clear(); return null; }
    if (!finished) return null;
    const consent = normalize(this.buffer).replace(/^(?:hey )?sameera\s+/u, '');
    const offer = this.offer;
    this.clear(); // Consume before any asynchronous work; replayed speech cannot approve twice.
    const task = this.tasks.get(offer.id);
    if (offer.deadline <= this.now() || snapshot(task) !== offer.snapshot || !this.eligible(task)) return null;
    if (no.has(consent)) { this.tasks.cancel(task.id); return this.tasks.get(task.id); }
    if (!yes.has(consent)) return null;
    await this.tasks.approve(task.id);
    return this.tasks.get(task.id);
  }
}
