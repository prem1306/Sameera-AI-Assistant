import { randomBytes, randomUUID } from 'node:crypto';

export type MailText = { to: string; subject: string; body: string };
export type MailDraft = MailText & { id: string; sender: string; tabId: number; state: 'draft' | 'sending' | 'sent' | 'unknown'; approvalRequested: boolean; approvalExpires: number; message?: string };
type Job = { id: string; action: 'draft' | 'send'; data: Record<string, unknown>; expires: number };
const pause = (question: string) => ({ success: false, needsClarification: true, question });

/** Browser bridge has only Gmail privileges, never access to the Windows action token. */
export class GmailBridge {
  readonly token = randomBytes(32).toString('hex');
  private lastSeen = 0;
  private pending = new Map<string, { job: Job; delivered: boolean; resolve: (result: any) => void }>();
  private calls = new Map<string, Promise<any>>();
  private draft: MailDraft | null = null;
  private preparing = false;

  status() { return { connected: Date.now() - this.lastSeen < 45000, draft: this.draft }; }
  next(): Job | null {
    this.lastSeen = Date.now();
    for (const item of this.pending.values()) {
      if (!item.delivered && item.job.expires > Date.now()) { item.delivered = true; return item.job; }
    }
    return null;
  }
  finish(id: string, result: any): boolean {
    const item = this.pending.get(id);
    if (!item?.delivered || !result || typeof result.success !== 'boolean') return false;
    this.pending.delete(id);
    item.resolve(result);
    return true;
  }
  private dispatch(action: Job['action'], data: Job['data']): Promise<any> {
    if (!this.status().connected) return Promise.resolve(pause('Please connect the Sameera Gmail bridge in Chrome first. Open Browser & Gmail setup in Sameera.'));
    return new Promise((resolve) => {
      const job = { id: randomUUID(), action, data, expires: Date.now() + 25000 };
      const timer = setTimeout(() => {
        this.pending.delete(job.id);
        resolve(pause(action === 'send' ? 'Sending could not be confirmed. Check Gmail Sent before taking any further action; I will not retry automatically.' : 'Gmail did not confirm the draft. Please check the browser before retrying.'));
      }, 25000);
      this.pending.set(job.id, { job, delivered: false, resolve: (result) => { clearTimeout(timer); resolve(result); } });
    });
  }
  prepare(id: string, input: MailText): Promise<any> {
    if (this.calls.has(id)) return this.calls.get(id)!;
    const call = this.prepareOnce(input);
    this.calls.set(id, call);
    if (this.calls.size > 100) this.calls.delete(this.calls.keys().next().value!);
    return call;
  }
  private async prepareOnce(input: MailText) {
    if (!input || typeof input.to !== 'string' || !/^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/.test(input.to)) return pause('What is the exact recipient email address? I cannot infer it from a name.');
    if (typeof input.subject !== 'string' || !input.subject.trim() || /[\r\n]/.test(input.subject) || input.subject.length > 500) return pause('What subject should this email have?');
    if (typeof input.body !== 'string' || !input.body.trim() || input.body.length > 20000) return pause('What should the email say? Please keep it under 20,000 characters.');
    if (this.preparing || this.draft?.state === 'sending') return pause('A Gmail action is already in progress. Please wait for its result.');
    this.preparing = true;
    // Any change/new draft invalidates approval for the prior wording.
    this.draft = null;
    try {
      const mail = { to: input.to.trim(), subject: input.subject, body: input.body.replace(/\r\n?/g, '\n') };
      const result = await this.dispatch('draft', mail);
      if (!result.success) return result;
      if (!Number.isInteger(result.tabId) || typeof result.sender !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(result.sender) || result.to !== mail.to || result.subject !== mail.subject || result.body !== mail.body) return pause('Gmail did not return the exact drafted text and sender. Please inspect the compose window. Nothing has been sent.');
      this.draft = { ...mail, id: randomUUID(), sender: result.sender, tabId: result.tabId, state: 'draft', approvalRequested: false, approvalExpires: 0 };
      return { success: true, draft: this.draft, instruction: 'Draft created in the user\'s Gmail browser. Nothing sent. Do not request sending until the user explicitly asks. Use requestGmailSend then direct them to the exact-message approval button.' };
    } finally { this.preparing = false; }
  }
  requestApproval() {
    if (!this.draft || this.draft.state !== 'draft' || this.preparing) return pause('Please create a verified Gmail draft first.');
    this.draft.approvalRequested = true;
    this.draft.approvalExpires = Date.now() + 5 * 60000;
    return { success: true, requiresUserApproval: true, draft: this.draft, instruction: 'The exact email preview is displayed. Ask the user to review it and click Approve and send. A spoken yes or a model tool call cannot send it.' };
  }
  cancelApproval(id: string) {
    if (this.draft?.id === id) this.draft.approvalRequested = false;
    return { success: true, message: 'Sending permission withdrawn. Gmail draft retained.' };
  }
  // This method is exposed only on the dedicated human approval route, never as a model tool.
  async approve(id: string) {
    const draft = this.draft;
    if (!draft || draft.id !== id || draft.state !== 'draft' || !draft.approvalRequested || draft.approvalExpires < Date.now() || this.preparing) return pause('This approval expired or the draft changed. Please request a new preview before sending.');
    draft.approvalRequested = false; // Consume permission before any network/browser side effect.
    draft.state = 'sending';
    const result = await this.dispatch('send', { ...draft });
    draft.state = result.success ? 'sent' : 'unknown';
    draft.message = result.message || result.question;
    return result;
  }
}
