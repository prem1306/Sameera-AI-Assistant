import type { ToolCallPayload, ToolEffects } from './types.ts';
import { LocalActionClient } from './LocalActionClient.ts';

export class GmailTools {
  constructor(private readonly client: LocalActionClient, private readonly effects: ToolEffects) {}
  async execute(call: ToolCallPayload): Promise<Record<string, any>> {
    switch (call.name) {
      case 'getGmailDraft':
      case 'draftGmailMail':
      case 'requestGmailSend': {
        const response = await this.client.request(call.name === 'getGmailDraft' ? '/api/mail/state' : call.name === 'draftGmailMail' ? '/api/mail/draft' : '/api/mail/request-send', {
          method: call.name === 'getGmailDraft' ? 'GET' : 'POST', headers: { 'Content-Type': 'application/json' },
          body: call.name === 'getGmailDraft' ? undefined : JSON.stringify({ id: call.id, mail: call.args }), signal: AbortSignal.timeout(30000),
        });
        if (response.status === 403) { return { success: false, needsClarification: true, question: 'The server restarted. Please refresh Sameera and repeat the email request.' }; }
        const result = await response.json();
        if (call.name === 'getGmailDraft') return { success: true, ...result, instruction: 'Use only this verified server state. unknown is not confirmation of sending. Never retry an uncertain send.' };
        this.effects.recordEvent({ id: call.id, name: call.name, title: 'Gmail', description: result.question || (result.requiresUserApproval ? 'Review the email preview before approving send.' : 'Draft opened in Gmail. Nothing sent.'), timestamp: new Date().toLocaleTimeString(), status: result.success ? 'success' : 'failed' });
        this.effects.notify('sameera-mail-update');
        return result;
      }
      default: return { error: `Unknown function ${call.name}` };
    }
  }
}
