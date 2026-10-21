import { GmailAdapter } from './GmailAdapter.ts';
import { ResearchAdapter } from './ResearchAdapter.ts';
import type { GmailBridge } from '../GmailBridge.ts';
import { TaskRunner, type Step } from './TaskRunner.ts';
import { SystemAdapter } from './SystemAdapter.ts';
import { DuplicateService } from '../system/DuplicateService.ts';
import { BrowserBridge } from '../browser/BrowserBridge.ts';
import { PrivacyService } from '../privacy/PrivacyService.ts';
import type { SystemActions } from '../SystemActions.ts';
import type { LocalDatabase } from '../database/LocalDatabase.ts';

export class AgentService {
  readonly browser = new BrowserBridge();
  readonly tasks: TaskRunner;
  readonly privacy = new PrivacyService();
  private proposals = new Map<string, Promise<Record<string, unknown>>>();
  constructor(actions: SystemActions, database: () => LocalDatabase | null, gmail?: GmailBridge) {
    this.tasks = new TaskRunner({ system: new SystemAdapter(actions), research: new ResearchAdapter(actions), browser: this.browser, duplicates: new DuplicateService(), ...(gmail ? { gmail: new GmailAdapter(gmail) } : {}) }, task => database()?.tasks.record(task));
    this.privacy.onChange(() => this.tasks.cancelAll());
  }
  state() { return { ...this.privacy.state(), tasks: this.tasks.list(), browser: this.browser.status() }; }
  async modelCall(call: { id: string; name: string; args?: Record<string, any> }) {
    const previous = this.proposals.get(call.id); if (previous) return previous;
    if (this.proposals.size >= 500) return { success: false, error: 'Restart session after reviewing existing tasks.' };
    const execution = (async () => {
      try {
        if (call.name === 'startAgentTask') {
          const task = await this.tasks.create(JSON.parse(String(call.args?.stepsJson)) as Step[]);
          return { success: true, taskId: task.id, state: task.state, requiresUserApproval: true, instruction: 'Tell the user to review the exact proposed scope in Agent activity. No action has executed.' };
        }
        if (call.name === 'getAgentTask') {
          const task = this.tasks.get(String(call.args?.taskId));
          const summary: Record<string, unknown> = { success: task.state === 'completed', taskId: task.id, state: task.state, completedSteps: task.results.length, requiresUserApproval: task.state === 'waiting-approval' };
          // Counts are computed locally and are the only result fields automatically disclosed.
          const last = task.results.at(-1);
          if (last) for (const key of ['groupCount', 'duplicateFiles', 'extraCopies', 'sourceCount', 'failedSources']) if (Number.isSafeInteger(last[key])) summary[key] = last[key];
          const limitations: Record<string, string> = { PUBLIC_SEARCH_FAILED: 'The public search service failed. Chrome access is not needed for public search.', PUBLIC_PAGES_UNREADABLE: 'Search found links but their public text could not be read. No note was created. Another source or permitted Chrome reading may work.' };
          if (last?.code && Object.hasOwn(limitations, last.code)) summary.limitation = limitations[last.code];
          return summary;
        }
      } catch { return { success: false, error: 'Invalid task request or expired task. Ask the user to inspect Agent activity.' }; }
      return { success: false, error: 'Unsupported agent tool.' };
    })();
    this.proposals.set(call.id, execution); return execution;
  }
}
