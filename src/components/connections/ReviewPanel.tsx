import type { ToolRequest } from '../../services/mcp/types';
import { buttonStyle, type ConnectionAction, type ServerRow } from './useConnections';

export function ReviewPanel({ requests, connections, run, busy, onResult }: { requests: ToolRequest[]; connections: ServerRow[]; run: ConnectionAction; busy: boolean; onResult: (id: string) => void }) {
  if (!requests.length) return null;
  return <section aria-label="Tool requests awaiting review" className="space-y-3 mb-5">
    <h3 className="font-semibold text-cyan-200">Review tool requests</h3>
    {requests.map(request => <article key={request.id} className="rounded-xl border border-cyan-300/40 p-4 space-y-3">
      <p className="text-sm break-words"><strong>{request.toolName}</strong> · {connections.find(row => row.id === request.connectionId)?.name || 'Removed connection'}</p>
      <pre className="text-xs whitespace-pre-wrap break-words bg-black/20 p-3 max-h-48 overflow-auto">{JSON.stringify(request.arguments, null, 2)}</pre>
      <p className="text-xs text-white/70">{request.state === 'running' ? 'Executing. Wait for the confirmed result.' : request.expires < Date.now() ? 'Approval expired. Cancel this request.' : 'Review these exact arguments. Approval permits this one call and discloses these exact arguments to this server. Local servers may also transmit data.'}</p>
      {request.state === 'pending' && <div className="flex flex-wrap gap-2">
        <button className={`${buttonStyle} bg-cyan-300 text-slate-950 font-semibold`} type="button" disabled={busy || request.expires < Date.now()} onClick={async () => { if (await run('approve', { id: request.id })) onResult(request.id); }}>Approve and run</button>
        <button className={buttonStyle} type="button" disabled={busy} onClick={async () => { if (await run('cancel', { id: request.id })) onResult(request.id); }}>Cancel request</button>
      </div>}
    </article>)}
  </section>;
}
