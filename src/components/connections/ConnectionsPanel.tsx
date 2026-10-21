import { useEffect, useRef, useState } from 'react';
import { Plug } from 'lucide-react';
import { useConnections, buttonStyle } from './useConnections';
import { ConnectionForm } from './ConnectionForm';
import { ServerCard } from './ServerCard';
import { PluginPanel } from './PluginPanel';
import { ReviewPanel } from './ReviewPanel';
import { ToolResultView } from './ToolResultView';

export function ConnectionsPanel({ onResult }: { onResult: (id: string) => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<'mcp' | 'plugins' | 'history'>('mcp');
  const { state, busy, loading, message, executionResult, refresh, run } = useConnections();
  useEffect(() => {
    const show = () => { setTab('mcp'); setOpen(true); if (!dialog.current?.open) dialog.current?.showModal(); void refresh(); };
    window.addEventListener('sameera-mcp-review', show);
    return () => window.removeEventListener('sameera-mcp-review', show);
  }, [refresh]);
  useEffect(() => {
    if (!open) return;
    const timer = setInterval(() => void refresh(), 4000);
    return () => clearInterval(timer);
  }, [open, refresh]);
  return <>
    <button type="button" title="Plugins & MCP connections" aria-label="Plugins and MCP connections" className="p-2.5 rounded-2xl bg-white/[0.07] hover:bg-white/[0.12] border border-white/15 text-white/80 focus-visible:outline-2 focus-visible:outline-cyan-300" onClick={() => { setOpen(true); dialog.current?.showModal(); void refresh(); }}><Plug className="w-4 h-4" /></button>
    <dialog ref={dialog} onClose={() => setOpen(false)} aria-labelledby="connections-title" className="m-auto bg-slate-950 text-white border border-white/20 rounded-2xl p-5 sm:p-6 w-full max-w-2xl max-h-[85vh] overflow-y-auto backdrop:bg-black/75">
      <div className="flex justify-between gap-4 items-center mb-3"><h2 id="connections-title" className="text-lg font-semibold">Plugins &amp; MCP connections</h2><button type="button" className={buttonStyle} onClick={() => dialog.current?.close()} aria-label="Close connections">Close</button></div>
      <p className="text-sm text-white/70 mb-4">Connect tools to Sameera. Connections and permissions are saved for your Windows account.</p>
      <div className="flex flex-wrap gap-2 mb-4" aria-label="Connection sections">{(['mcp', 'plugins', 'history'] as const).map(value => <button key={value} type="button" aria-pressed={tab === value} className={`${buttonStyle} ${tab === value ? 'bg-white/15' : ''}`} onClick={() => setTab(value)}>{value === 'mcp' ? 'MCP servers' : value === 'plugins' ? 'Plugins' : 'Activity'}</button>)}</div>
      <p role="status" aria-live="polite" className="text-sm text-cyan-200 mb-4">{busy ? 'Working…' : message || (loading && !state.connections.length ? 'Loading connections…' : '')}</p>
      <ReviewPanel requests={state.pending} connections={state.connections} run={run} busy={busy} onResult={onResult} />
      {executionResult && <ToolResultView result={executionResult} />}
      {tab === 'mcp' && <div className="space-y-4">
        {!state.connections.length && !loading && <div className="py-4 text-sm text-white/70">No MCP servers yet. Add a remote URL or a local server below. After connecting, enable the tools you want Sameera to use.</div>}
        {state.connections.map(row => <ServerCard key={row.id} row={row} run={run} busy={busy} />)}
        <ConnectionForm run={run} busy={busy} />
      </div>}
      {tab === 'plugins' && <PluginPanel plugins={state.plugins} run={run} busy={busy} />}
      {tab === 'history' && <section><h3 className="font-semibold mb-3">Recent tool activity</h3>{!state.history.length ? <p className="text-sm text-white/65">No connected tools have run yet.</p> : <ul className="space-y-3">{state.history.map(event => <li key={event.id} className="text-sm border-b border-white/10 pb-3 break-words"><strong>{event.tool_name}</strong> · {event.status}<p className="text-xs text-white/65 mt-1">{new Date(event.created_at).toLocaleString()}</p></li>)}</ul>}</section>}
    </dialog>
  </>;
}
