import { randomUUID } from 'node:crypto';
import { containsSecrets } from '../privacy/PrivacyService.ts';
export type TaskState = 'planning' | 'running' | 'waiting-approval' | 'completed' | 'failed' | 'cancelled' | 'uncertain';
export type Step = { capability: string; action: string; args: Record<string, unknown> };
export interface Adapter {
  validate(step: Step): void;
  consequential(step: Step): boolean;
  fingerprint(step: Step): Promise<string>;
  execute(step: Step, signal: AbortSignal, progress?: (completed: number, total: number) => void): Promise<Record<string, any>>;
}
export type Task = { id: string; state: TaskState; steps: Step[]; index: number; results: Record<string, any>[]; expires: number; approval: 'scope' | 'action' | null; error?: string; progress?: { completed: number; total: number } };
/** Model requests create proposals only. Only authenticated panel review or session-bound VoiceTaskApproval approves. */
export class TaskRunner {
  private tasks = new Map<string, Task>();
  private controllers = new Map<string, AbortController>();
  private fingerprints = new Map<string, string>();
  private busy = new Set<string>();
  private executing = new Set<string>();
  constructor(private adapters: Record<string, Adapter>, private record: (task: Task) => void = () => {}) {}
  list() { return [...this.tasks.values()].map(task => structuredClone(task)); }
  get(id: string) { const task = this.tasks.get(id); if (!task) throw new Error('Task not found.'); return structuredClone(task); }
  async create(steps: Step[]) {
    if (!Array.isArray(steps) || !steps.length || steps.length > 20 || JSON.stringify(steps).length > 64000) throw new Error('A task needs 1–20 bounded steps.');
    if (this.tasks.size >= 100) throw new Error('Task limit reached. Restart after reviewing completed tasks.');
    for (const step of steps) {
      if (!step || typeof step.action !== 'string' || !step.args || typeof step.args !== 'object' || Array.isArray(step.args) || !Object.hasOwn(this.adapters, step.capability)) throw new Error('Unsupported task step.');
      this.adapters[step.capability].validate(step);
      if ((['browser', 'gmail', 'research'].includes(step.capability) || step.action === 'openChrome') && containsSecrets(step.args)) throw new Error('Secret-like outbound content is blocked.');
    }
    const task: Task = { id: randomUUID(), state: 'waiting-approval', steps: structuredClone(steps), index: 0, results: [], expires: Date.now() + 120000, approval: 'scope' };
    if (task.steps.length === 1 && this.adapters[task.steps[0].capability].consequential(task.steps[0])) {
      this.fingerprints.set(task.id, await this.adapters[task.steps[0].capability].fingerprint(task.steps[0]));
      task.approval = 'action';
    }
    this.tasks.set(task.id, task); this.controllers.set(task.id, new AbortController()); this.record(task);
    return this.get(task.id);
  }
  cancel(id: string) {
    const task = this.tasks.get(id); if (!task) throw new Error('Task not found.');
    if (['completed', 'failed', 'cancelled', 'uncertain'].includes(task.state)) return;
    this.controllers.get(id)?.abort();
    task.state = this.executing.has(id) ? 'uncertain' : 'cancelled';
    if (task.state === 'uncertain') task.error = 'Stop requested while an action was in progress. It may still finish. Inspect the result before retrying; no further steps will run.';
    task.approval = null; this.fingerprints.delete(id); this.record(task);
  }
  cancelAll() { for (const id of this.tasks.keys()) this.cancel(id); }
  async approve(id: string) {
    const task = this.tasks.get(id);
    if (!task || task.state !== 'waiting-approval' || this.busy.has(id)) throw new Error('Task is not awaiting approval.');
    if (task.expires < Date.now()) { this.cancel(id); throw new Error('Approval expired. Create a new task.'); }
    this.busy.add(id);
    try {
      const actionApproved = task.approval === 'action';
      if (actionApproved && await this.adapters[task.steps[task.index].capability].fingerprint(task.steps[task.index]) !== this.fingerprints.get(id)) throw new Error('Target changed. Create and review a new task.');
      if (this.controllers.get(id)!.signal.aborted) return;
      task.state = 'running'; task.approval = null;
      for (; task.index < task.steps.length; task.index++) {
        const signal = this.controllers.get(id)!.signal;
        if (signal.aborted) return;
        const step = task.steps[task.index], adapter = this.adapters[step.capability];
        adapter.validate(step);
        if (adapter.consequential(step) && !(actionApproved && this.fingerprints.has(id))) {
          this.fingerprints.set(id, await adapter.fingerprint(step));
          if (signal.aborted) return;
          task.state = 'waiting-approval'; task.approval = 'action'; task.expires = Date.now() + 120000; return;
        }
        this.fingerprints.delete(id);
        this.executing.add(id);
        const result = await adapter.execute(step, signal, (completed, total) => { task.progress = { completed, total }; });
        this.executing.delete(id);
        task.results.push(result);
        if (signal.aborted) {
          if (result.notExecuted === true) { task.state = 'cancelled'; task.error = 'Stopped before the current action executed. No further steps will run.'; }
          return;
        }
        if (!result.success) { task.state = result.uncertain ? 'uncertain' : 'failed'; return; }
      }
      task.state = 'completed';
    } catch { if (!this.controllers.get(id)?.signal.aborted) { task.state = this.executing.has(id) ? 'uncertain' : 'failed'; task.error = this.executing.has(id) ? 'The action did not return a verifiable outcome. Inspect the application and local results before retrying.' : 'Task stopped: target changed, input invalid, or execution failed. Inspect local results before retrying.'; } }
    finally { this.executing.delete(id); this.busy.delete(id); this.record(task); }
  }
}
