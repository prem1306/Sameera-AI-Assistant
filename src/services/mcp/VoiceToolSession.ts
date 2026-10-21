import { randomUUID } from 'node:crypto';
import type { McpService } from './McpService.ts';

/** Voice requests are proposals in every language. Human review authorizes execution. */
export class VoiceToolSession {
  private calls = new Map<string, Promise<Record<string, unknown>>>();
  constructor(private service: McpService, private now = Date.now) {}
  input(_chunk: string, _finished = false) {}
  seal() {}
  clear() {}
  execute(call: { id: string; name: string; args?: Record<string, unknown> }): Promise<Record<string, unknown>> {
    const existing = this.calls.get(call.id);
    if (existing) return existing;
    if (this.calls.size >= 500) return Promise.resolve({ success: false, error: 'Restart the voice session before requesting more tools.' });
    this.seal();
    const args = call.args || {};
    const execution = (async () => {
      try {
        if (call.name === 'listConnectedTools') return { success: true, connections: this.service.catalog() };
        if (call.name !== 'callConnectedTool') throw new Error('Unsupported connection tool.');
        const argumentsObject = JSON.parse(String(args.argumentsJson));
        // Namespace model IDs per session; HTTP requests cannot inherit voice consent.
        const requestId = randomUUID();
        const result = this.service.executor.request(requestId, String(args.connectionId), String(args.toolName), argumentsObject);
        // Spoken intent creates a proposal; approval is only accepted from the local review.
        return result;
      } catch (error) { return { success: false, error: (error as Error).message }; }
    })();
    this.calls.set(call.id, execution);
    return execution;
  }
}
