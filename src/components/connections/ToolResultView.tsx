import type { ToolResult } from '../../services/mcp/types';

export function ToolResultView({ result }: { result: ToolResult }) {
  const output = result.output as { content?: { type: string; text?: string }[]; structuredContent?: unknown; truncated?: boolean; excerpt?: string } | undefined;
  const text = output?.structuredContent ? JSON.stringify(output.structuredContent, null, 2) : output?.content?.filter(item => item.type === 'text').map(item => item.text || '').join('\n') || output?.excerpt || (output ? JSON.stringify(output, null, 2) : String(result.message || 'No output returned.'));
  return <section className="mb-5 rounded-lg border border-white/15 p-3" aria-label="Last tool result">
    <h3 className="text-sm font-semibold">{result.success ? 'Tool completed' : result.cancelled ? 'Request cancelled' : result.uncertain ? 'Result unconfirmed' : 'Tool returned an error'}</h3>
    {output?.truncated && <p className="text-xs text-white/70 mt-2">The result was too large to display completely.</p>}
    <pre className="mt-3 text-sm whitespace-pre-wrap break-words max-h-56 overflow-auto">{text}</pre>
  </section>;
}
