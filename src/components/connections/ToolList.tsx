import { useState } from 'react';
import type { ConnectedTool } from '../../services/mcp/types';
import { inputStyle, buttonStyle, type ConnectionAction } from './useConnections';

export function ToolList({ id, tools, run, busy }: { id: string; tools: ConnectedTool[]; run: ConnectionAction; busy: boolean }) {
  const [selected, setSelected] = useState('');
  const [args, setArgs] = useState('{}');
  const [error, setError] = useState('');
  return <div className="mt-4 space-y-3">
    {!tools.length && <p className="text-sm text-white/65">No tools discovered.</p>}
    {tools.map(tool => <details key={tool.name} className="border border-white/10 rounded-lg p-3">
      <summary className="cursor-pointer text-sm font-medium break-words">{tool.name} · {tool.enabled ? 'Enabled' : 'Disabled'}</summary>
      <p className="text-sm text-white/70 mt-2 break-words">{tool.description || 'No description supplied.'}</p>
      <label className="flex gap-2 items-center text-sm mt-3"><input type="checkbox" disabled={busy} checked={tool.enabled} onChange={event => void run('permission', { id, tool: tool.name, enabled: event.target.checked })} />Allow Sameera to request this tool</label>
      <pre className="mt-3 text-xs whitespace-pre-wrap break-words max-h-48 overflow-auto bg-black/20 p-2">{JSON.stringify(tool.inputSchema, null, 2)}</pre>
      {tool.enabled && <button type="button" disabled={busy} className={`${buttonStyle} mt-2`} onClick={() => { setSelected(tool.name); setArgs('{}'); setError(''); }}>Prepare a test</button>}
    </details>)}
    {selected && tools.some(tool => tool.name === selected && tool.enabled) && <form onSubmit={async event => {
      event.preventDefault(); setError('');
      try { await run('request', { callId: crypto.randomUUID(), connectionId: id, toolName: selected, arguments: JSON.parse(args) }); }
      catch { setError('Enter a JSON object matching this tool’s schema.'); }
    }}>
      <label className="block text-sm">Arguments for {selected}<textarea className={inputStyle} rows={4} value={args} onChange={event => setArgs(event.target.value)} /></label>
      <button type="submit" className={`${buttonStyle} mt-2`} disabled={busy}>Review test request</button>
      {error && <p role="alert" className="text-rose-200 text-sm mt-2">{error}</p>}
    </form>}
  </div>;
}
