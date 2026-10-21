import { randomUUID } from 'node:crypto';
import type { Adapter, Step } from './TaskRunner.ts';
import type { SystemActions } from '../SystemActions.ts';
import { containsSecrets } from '../privacy/PrivacyService.ts';
import { researchNotes, type ResearchDependencies } from '../research/ResearchNotes.ts';

/** Bridges a reviewed research scope to the existing, separate Notepad owner. */
export class ResearchAdapter implements Adapter {
  constructor(private actions: Pick<SystemActions, 'resumeFromUser' | 'execute'>, private dependencies?: ResearchDependencies) {}
  validate(step: Step) {
    if (step.action !== 'searchToNotepad' || typeof step.args.query !== 'string' || !step.args.query.trim() || step.args.query.length > 500 || containsSecrets(step.args)) throw new Error('Provide a public research query of 1–500 characters without secrets.');
    if (Object.keys(step.args).some(key => key !== 'query')) throw new Error('Research notes accept only the reviewed search query.');
  }
  consequential() { return false; } // Scope review authorizes search and a new draft; existing files are never overwritten.
  async fingerprint(step: Step) { return JSON.stringify(step); }
  async execute(step: Step, signal: AbortSignal) {
    this.validate(step);
    const notes = await researchNotes(String(step.args.query).trim(), signal, this.dependencies);
    if (!notes.success) return notes;
    signal.throwIfAborted();
    this.actions.resumeFromUser();
    const draft = await this.actions.execute(randomUUID(), 'notepadDraft', { text: notes.text });
    return { ...draft, sourceCount: notes.sourceCount, failedSources: notes.failedSources, researchNotes: true };
  }
}
