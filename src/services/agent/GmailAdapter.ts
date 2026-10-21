import { randomUUID } from 'node:crypto';
import type { Adapter, Step } from './TaskRunner.ts';
import type { GmailBridge } from '../GmailBridge.ts';
export class GmailAdapter implements Adapter {
  constructor(private bridge: GmailBridge) {}
  validate(step: Step) {
    if (step.action !== 'draft' || !step.args.mail || typeof step.args.mail !== 'object') throw new Error('Only reviewed plain-text drafts are supported here.');
  }
  consequential() { return true; }
  async fingerprint(step: Step) { return JSON.stringify(step); }
  async execute(step: Step, signal: AbortSignal) { signal.throwIfAborted(); return this.bridge.prepare(randomUUID(), step.args.mail as any); }
}
