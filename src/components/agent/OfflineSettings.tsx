import { useEffect, useRef, useState } from 'react';
import { LocalActionClient } from '../../services/tools/LocalActionClient';
import type { StateManager } from '../../services/StateManager';
import type { PrivacyMode } from '../../services/session/Preferences';

export function OfflineSettings({ mode, stateManager, onTask }: { mode: PrivacyMode; stateManager: StateManager; onTask: () => void }) {
  const [status, setStatus] = useState<any>(null), [token, setToken] = useState(''), [text, setText] = useState(''), [reply, setReply] = useState(''), [error, setError] = useState(''), [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState('');
  useEffect(() => { const listener = (event: Event) => setProgress((event as CustomEvent<string>).detail); window.addEventListener('sameera-local-progress', listener); return () => window.removeEventListener('sameera-local-progress', listener); }, []);
  const client = useRef(new LocalActionClient());
  const request = async (operation: string, body?: unknown) => {
    const response = await client.current.request(`/api/local-ai/${operation}`, { method: body === undefined ? 'GET' : 'POST', headers: { 'Content-Type': 'application/json' }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    const result = await response.json(); if (!response.ok) throw new Error(result.error || 'Local operation failed.'); return result;
  };
  useEffect(() => {
    let mounted = true, running = false;
    const poll = async () => { if (running) return; running = true; try { const value = await request('status'); if (mounted) setStatus(value); } catch { if (mounted) setError('Offline runtime status is unavailable.'); } finally { running = false; } };
    void poll(); const timer = setInterval(poll, 3000); return () => { mounted = false; clearInterval(timer); };
  }, []);
  const run = async (callback: () => Promise<void>) => { setBusy(true); setError(''); try { await callback(); } catch (error) { setError((error as Error).message); } finally { setBusy(false); } };
  return <section className="space-y-3" aria-label="Offline setup">
    <h3 className="font-semibold">Offline speech and planning</h3>
    <p>Optional Windows CPU package: multilingual Whisper, Qwen3 4B, and Indic Parler speech. Download about 11 GB; keep 24 GB free. Setup contacts the listed model hosts. Installed sessions use local files and loopback only.</p>
    {progress && <p role="status">{progress}</p>}
    <p role="status">{status?.ready ? 'Installed' : status?.state || 'Checking'} · {status?.stage} {status?.bytes > 0 ? `· ${(status.bytes / 1024 ** 3).toFixed(2)} GB downloaded this attempt` : ''}</p>
    {status?.error && <p role="alert">{status.error}</p>}
    <p>Indic Parler may require <a className="underline" href="https://huggingface.co/ai4bharat/indic-parler-tts" target="_blank" rel="noreferrer">model access approval on Hugging Face</a>. Enter a read token for setup only. It is never saved.</p>
    <label className="block">Temporary Hugging Face read token<input type="password" autoComplete="off" className="agent-input" value={token} maxLength={220} onChange={event => setToken(event.target.value)} /></label>
    <button className="agent-button" disabled={busy || status?.state === 'installing'} onClick={() => void run(async () => { await request('install', { token }); setToken(''); })}>{status?.ready ? 'Verify / reinstall offline package' : 'Download and install offline package'}</button>
    <button className="agent-button ml-2" onClick={() => void run(async () => { await request('cancel', {}); })}>Stop offline work</button>
    {status?.timings && Object.keys(status.timings).length > 0 && <p>Last run: recognition {status.timings.recognitionMs ?? '—'} ms; planning {status.timings.reasoningMs ?? '—'} ms; speech {status.timings.synthesisMs ?? '—'} ms. Language quality needs listening checks on this device.</p>}
    {mode === 'local-only' && <form className="space-y-2" onSubmit={event => { event.preventDefault(); void run(async () => { const result = await request('text', { text, language: stateManager.getLanguage() }); setReply(result.reply); onTask(); }); }}>
      <label>Local text request<textarea className="agent-input" value={text} onChange={event => setText(event.target.value)} maxLength={8000} required /></label><button disabled={busy || !status?.ready} className="agent-button">Plan locally</button>{reply && <p role="status">{reply}</p>}
    </form>}
    {error && <p role="alert" className="text-amber-200">{error}</p>}
  </section>;
}
