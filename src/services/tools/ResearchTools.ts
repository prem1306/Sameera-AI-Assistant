import type { ToolCallPayload } from './types.ts';

/** Public research returns data to the model without opening an article reader or tabs. */
export class ResearchTools {
  async execute(call: ToolCallPayload): Promise<Record<string, any>> {
    const search = call.name === 'searchWebSources';
    try {
      const response = await fetch(`/api/research/${search ? 'search' : 'read'}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(search ? { query: call.args.query } : { url: call.args.url }),
        signal: AbortSignal.timeout(30000),
      });
      const result = await response.json();
      if (!response.ok || !result.success) return this.failure(result.error || 'No verified research result was returned.');
      return result;
    } catch { return this.failure('The public research request failed or timed out.'); }
  }
  private failure(error: string) {
    return { success: false, error, needsClarification: true, question: `${error} Would you like another source or to provide the page text?`, instruction: 'Stop dependent note-writing. Do not invent source details or claim that all webpage reading is unavailable.' };
  }
}
