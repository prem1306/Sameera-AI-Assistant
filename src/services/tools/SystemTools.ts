import type { ToolCallPayload, ToolEffects } from './types.ts';
import { LocalActionClient } from './LocalActionClient.ts';

export class SystemTools {
  constructor(private readonly client: LocalActionClient, private readonly effects: ToolEffects) {}
  async execute(call: ToolCallPayload): Promise<Record<string, any>> {
    switch (call.name) {
      case 'performSystemAction': {
        const { action, ...args } = call.args;
        const response = await this.client.request('/api/system/action', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: call.id, action, args }), signal: AbortSignal.timeout(30000),
        });
        if (response.status === 403) { return { success: false, needsClarification: true, question: 'The local server restarted. Please repeat the command so I can establish a new action session.' }; }
        const result = await response.json();
        if (!result.success && !result.requiresInspection && !result.requiresMoreText && !result.needsClarification) {
          result.needsClarification = true;
          result.question = result.error || 'The Windows action could not be verified. Please check its current state before retrying.';
        }
        this.effects.recordEvent({ id: call.id, name: 'performSystemAction', title: `Windows: ${action}`, description: result.question || result.message || (result.success ? 'Requested action completed.' : 'Action paused.'), timestamp: new Date().toLocaleTimeString(), status: result.success ? 'success' : 'failed' });
        return result;
      }
      default: return { error: `Unknown function ${call.name}` };
    }
  }
}
