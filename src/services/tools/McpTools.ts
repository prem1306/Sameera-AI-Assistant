import type { ToolCallPayload, ToolEffects } from './types.ts';
import { LocalActionClient } from './LocalActionClient.ts';

export class McpTools {
  constructor(private readonly client: LocalActionClient, private readonly effects: ToolEffects) {}
  async execute(call: ToolCallPayload): Promise<Record<string, any>> {
    switch (call.name) {
      case 'listConnectedTools':
      case 'callConnectedTool': {
        let body: unknown;
        try { if (call.name === 'callConnectedTool') body = { operation: 'request', args: { callId: call.id, connectionId: call.args.connectionId, toolName: call.args.toolName, arguments: JSON.parse(call.args.argumentsJson) } }; }
        catch { return { success: false, error: 'Provide a valid JSON argument object matching the discovered tool schema.' }; }
        const response = await this.client.request(call.name === 'listConnectedTools' ? '/api/mcp/catalog' : '/api/mcp/action', { method: body ? 'POST' : 'GET', headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(10000) });
        const result = await response.json();
        if (result.requiresUserApproval) this.effects.notify('sameera-mcp-review');
        return result;
      }
      default: return { error: `Unknown function ${call.name}` };
    }
  }
}
