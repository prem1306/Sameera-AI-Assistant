import { useCallback, useEffect, useRef, useState } from 'react';
import { LocalActionClient } from '../../services/tools/LocalActionClient';
import type { PrivacyMode, Persona } from '../../services/session/Preferences';
import type { Task } from '../../services/agent/TaskRunner';
import type { Disclosure } from '../../services/privacy/PrivacyService';
export type AgentState = { mode: PrivacyMode; persona: Persona; providerPaid: boolean; memoryEnabled: boolean; tasks: Task[]; disclosures: Disclosure[]; browser: { connected: boolean }; previousTasks: { id: string; state: string }[] };
export function useAgentState() {
  const client = useRef(new LocalActionClient());
  const [state, setState] = useState<AgentState | null>(null);
  const [error, setError] = useState('');
  const mounted = useRef(true);
  const request = useCallback(async (path: string, body?: unknown, method = 'POST') => {
    const response = await client.current.request('/api/agent' + path, { method, headers: { 'Content-Type': 'application/json' }, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
    const result = await response.json();
    if (!response.ok || result.success === false && result.error) throw new Error(result.error || 'Local request failed.');
    return result;
  }, []);
  const refresh = useCallback(async () => {
    try { const next = await request('/state', undefined, 'GET'); if (mounted.current) { setState(next); setError(''); } }
    catch (error) { if (mounted.current) setError(error instanceof Error ? error.message : 'Local service unavailable.'); }
  }, [request]);
  const run = useCallback(async (callback: () => Promise<unknown>) => {
    try { await callback(); await refresh(); }
    catch (error) { setError(error instanceof Error ? error.message : 'Local request failed.'); }
  }, [refresh]);
  useEffect(() => {
    mounted.current = true; void refresh();
    let busy = false;
    const poll = () => { if (!busy) { busy = true; void refresh().finally(() => { busy = false; }); } };
    const timer = setInterval(poll, 2000);
    window.addEventListener('sameera-agent-update', poll);
    return () => { mounted.current = false; clearInterval(timer); window.removeEventListener('sameera-agent-update', poll); };
  }, [refresh]);
  return { state, error, request, run, refresh };
}
