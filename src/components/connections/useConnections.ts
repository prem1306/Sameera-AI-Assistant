import { desktopSessionToken } from '../../services/tools/DesktopSession';
import { useCallback, useRef, useState } from 'react';
import type { Connection, ConnectedTool, ToolRequest, ToolResult } from '../../services/mcp/types';
import type { PluginManifest } from '../../services/plugins/PluginManifest';

export type ServerRow = Connection & { status: string; error?: string; tools: ConnectedTool[] };
export type ConnectionsState = { connections: ServerRow[]; plugins: { id: string; name: string; manifest: PluginManifest }[]; pending: ToolRequest[]; history: { id: number; tool_name: string; status: string; created_at: string }[] };
export function useConnections() {
  const token = useRef('');
  const [state, setState] = useState<ConnectionsState>({ connections: [], plugins: [], pending: [], history: [] });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [executionResult, setExecutionResult] = useState<ToolResult | null>(null);
  const request = useCallback(async (operation?: string, args?: unknown) => {
    if (!token.current) token.current = await desktopSessionToken();
    const response = await fetch(operation ? '/api/mcp/action' : '/api/mcp/state', { method: operation ? 'POST' : 'GET', headers: { 'Content-Type': 'application/json', 'X-Sameera-Token': token.current }, body: operation ? JSON.stringify({ operation, args }) : undefined, signal: AbortSignal.timeout(35000) });
    const result = await response.json();
    if (response.status === 403) token.current = '';
    if (!response.ok) throw new Error(result.error || 'Connection request failed.');
    return result;
  }, []);
  const refresh = useCallback(async () => {
    setLoading(true);
    try { setState(await request()); }
    catch (error) { setMessage((error as Error).message); }
    finally { setLoading(false); }
  }, [request]);
  const run = useCallback(async (operation: string, args: unknown) => {
    setBusy(true); setMessage('');
    try {
      const result = await request(operation, args);
      if (operation === 'approve' || operation === 'cancel') setExecutionResult(result);
      setMessage(result.message || (result.requiresUserApproval ? 'Review the request below before running it.' : operation === 'approve' && result.success ? 'Tool completed.' : result.success === false ? 'Request completed with an error. Inspect the result before retrying.' : 'Saved.'));
      await refresh();
      return result;
    } catch (error) { setMessage((error as Error).message); return null; }
    finally { setBusy(false); }
  }, [refresh, request]);
  return { state, busy, loading, message, executionResult, refresh, run };
}

export type ConnectionAction = (operation: string, args: unknown) => Promise<any>;
export const inputStyle = 'w-full mt-1 rounded-lg bg-white/5 border border-white/20 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-300';
export const buttonStyle = 'rounded-lg border border-white/20 px-3 py-2 text-sm hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-cyan-300 disabled:opacity-40';
