import { OfflineSettings } from './OfflineSettings';
import { BrowserResult } from './BrowserResult';
import { useEffect, useRef, useState } from 'react';
import { useAgentState } from './useAgentState';
import { DuplicateReview } from './DuplicateReview';
import type { LiveSession } from '../../services/LiveSession';
import type { StateManager } from '../../services/StateManager';
import type { AudioPlayer } from '../../services/AudioPlayer';
import { LocalActionClient } from '../../services/tools/LocalActionClient';
import type { PrivacyMode, Persona } from '../../services/session/Preferences';
import type { Step } from '../../services/agent/TaskRunner';

export function AgentPanel({ liveSession, stateManager, player }: { liveSession: LiveSession; stateManager: StateManager; player: AudioPlayer }) {
  const { state, error, request, run } = useAgentState();
  const dialog = useRef<HTMLDialogElement>(null);
  const taskSection = useRef<HTMLElement>(null);
  const sharingSection = useRef<HTMLElement>(null);
  const openedReviews = useRef(new Set<string>());
  const [publicUrl, setPublicUrl] = useState('');
  const [folder, setFolder] = useState('');
  const [legacy, setLegacy] = useState(() => localStorage.getItem('myraa_conversation_memories') !== null);
  const [query, setQuery] = useState('');
  const [service, setService] = useState('youtube');
  const [pair, setPair] = useState('');
  const [season, setSeason] = useState(1), [episode, setEpisode] = useState(1);
  const pendingTasks = state?.tasks.filter(task => task.state === 'waiting-approval' && task.expires > Date.now()) || [];
  const pendingSharing = state?.disclosures.filter(row => row.state === 'pending' && row.expires > Date.now()) || [];
  const pendingCount = pendingTasks.length + pendingSharing.length;
  useEffect(() => {
    const tasks = state?.tasks.filter(task => task.state === 'waiting-approval' && task.expires > Date.now()) || [];
    const sharing = state?.disclosures.filter(row => row.state === 'pending' && row.expires > Date.now()) || [];
    const taskKeys = tasks.map(task => `task:${task.id}:${task.index}:${task.approval}:${task.expires}`);
    const newTask = taskKeys.some(key => !openedReviews.current.has(key));
    const keys = [...taskKeys, ...sharing.map(row => `sharing:${row.id}`)];
    if (!keys.some(key => !openedReviews.current.has(key))) return;
    keys.forEach(key => openedReviews.current.add(key));
    if (dialog.current && !dialog.current.open) dialog.current.showModal();
    (newTask ? taskSection : sharingSection).current?.scrollIntoView({ block: 'start' });
  }, [state]);
  useEffect(() => {
    if (!state) return;
    stateManager.memoryEnabled = state.memoryEnabled;
    window.dispatchEvent(new CustomEvent('sameera-privacy-mode', { detail: state.mode }));
    window.dispatchEvent(new CustomEvent('sameera-persona', { detail: state.persona }));
  }, [state?.mode, state?.persona, state?.memoryEnabled, stateManager]);
  const configure = async (change: { mode?: PrivacyMode; persona?: Persona; providerPaid?: boolean; memoryEnabled?: boolean }) => {
    if (!state) return;
    liveSession.stop(); // Immediately stop capture and queued cloud audio before a mode request.
    await request('/preferences', { ...state, ...change });
    window.dispatchEvent(new Event('sameera-preferences-changed'));
  };
  const propose = async (steps: Step[]) => { await request('/tasks', { steps }); };
  const title = state?.mode === 'local-only' ? 'Local-only AI' : 'Google cloud voice';
  return <>
    <button className="agent-button text-sm" onClick={() => { if (!dialog.current?.open) dialog.current?.showModal(); }} aria-label="Open agent review panel" aria-haspopup="dialog">Review tasks{pendingCount > 0 ? ` · ${pendingCount} pending` : ''} <span className="text-white/60">· {title}</span></button>
    {pendingCount > 0 && <div role="status" className="agent-review-notice"><span>{pendingCount} review{pendingCount === 1 ? '' : 's'} waiting. Sameera needs your decision before continuing. For supported tasks, say "go for it" after she explains the scope. Sensitive actions and sharing require the panel.</span><button className="agent-button" onClick={() => { if (!dialog.current?.open) dialog.current?.showModal(); (pendingTasks.length ? taskSection : sharingSection).current?.scrollIntoView({ block: 'start' }); }}>Open pending review</button></div>}
    <dialog ref={dialog} aria-label="Agent review panel" className="agent-dialog" onClick={event => { if (event.target === dialog.current) dialog.current.close(); }}>
      <div className="flex justify-between items-center gap-3 mb-4"><h2 className="text-lg font-semibold">Agent activity &amp; privacy</h2><button className="agent-button" onClick={() => dialog.current?.close()}>Close</button></div>
      {error && <p role="alert" className="text-amber-200 mb-3">{error}</p>}
      {!state ? <p role="status">Loading local settings…</p> : <div className="space-y-6">
        <details className="space-y-4"><summary className="cursor-pointer font-semibold">Privacy, voice settings and manual workflows</summary>
        <section className="space-y-3" aria-label="Privacy and voice settings">
          <label className="block">Processing mode<select className="agent-input" value={state.mode} onChange={event => void run(() => configure({ mode: event.target.value as PrivacyMode }))}>
            <option value="controlled-cloud">Controlled cloud</option><option value="task-cloud">Task-approved cloud</option><option value="local-only">Local-only AI</option>
          </select></label>
          <p>{state.mode === 'local-only' ? 'Speech and reasoning run on this device. Requested websites still contact their services. Cloud fallback is disabled.' : 'Microphone audio goes to Google while a call is active. Local files and private page results need a separate sharing review.'}</p>
          <label className="block">Voice persona<select className="agent-input" value={state.persona} onChange={event => void run(() => configure({ persona: event.target.value as Persona }))}><option value="companion">Companion · Aoede</option><option value="butler">Butler · Charon</option></select></label>
          <button className="agent-button" onClick={() => void run(async () => {
            await player.unlock();
            const response = await new LocalActionClient().request('/api/voice/sample', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ language: stateManager.getLanguage() }) });
            const result = await response.json(); if (!response.ok) throw new Error(result.error || 'Voice preview unavailable.'); player.queueAudioChunk(result.audio);
          })}>Preview selected voice</button>
          <label className="flex gap-2 items-start"><input type="checkbox" checked={state.providerPaid} onChange={event => void run(() => configure({ providerPaid: event.target.checked }))} /><span>I have confirmed paid-service data handling for this Google API project. This does not mean zero retention. Private sharing stays blocked until confirmed.</span></label>
          <label className="flex gap-2"><input type="checkbox" checked={state.memoryEnabled} onChange={event => void run(() => configure({ memoryEnabled: event.target.checked }))} />Save encrypted local session summaries</label>
          {legacy && <div className="border border-amber-200/30 rounded-lg p-3 space-y-2"><p>Older unencrypted browser memories are preserved. Import them into encrypted local storage, or delete them.</p>
            <button className="agent-button" disabled={!state.memoryEnabled} onClick={() => void run(async () => {
              const previous = JSON.parse(localStorage.getItem('myraa_conversation_memories') || '[]');
              await request('/memories', { memories: previous.slice(0, 25) }, 'PUT'); localStorage.removeItem('myraa_conversation_memories'); setLegacy(false); window.dispatchEvent(new Event('sameera-preferences-changed'));
            })}>Import into encrypted storage</button>
            <button className="agent-button" onClick={() => { localStorage.removeItem('myraa_conversation_memories'); setLegacy(false); }}>Delete old browser memories</button>
          </div>}
          <button className="agent-button" disabled={state.mode === 'local-only'} onClick={() => void run(() => request('/memory-disclosure', {}))}>Review sharing recent memories with Google</button>
        </section>
        <OfflineSettings mode={state.mode} stateManager={stateManager} onTask={() => window.dispatchEvent(new Event('sameera-agent-update'))} />
        <section className="space-y-3" aria-label="Local workflows">
          <h3 className="font-semibold">Chrome</h3><p>{state.browser.connected ? 'Chrome bridge connected' : 'Chrome bridge disconnected. Install chrome-extension from the app package and pair it here.'}</p>
          <button className="agent-button" onClick={() => void run(async () => { const response = await new LocalActionClient().request('/api/mail/pair', { method: 'GET' }); const result = await response.json(); if (!response.ok) throw new Error('Pairing unavailable.'); setPair(result.token); })}>Show extension pairing code</button>
          {pair && <label className="block">Paste this code into the extension<input className="agent-input" readOnly value={pair} onFocus={event => event.target.select()} /></label>}
          <button className="agent-button" onClick={() => void run(() => propose([{ capability: 'browser', action: 'read', args: {} }]))}>Read current Chrome tab locally</button>
          <form className="space-y-2" onSubmit={event => { event.preventDefault(); void run(() => propose([{ capability: 'browser', action: 'search', args: { service, query } }])); }}>
            <label>Service<select className="agent-input" value={service} onChange={event => setService(event.target.value)}><option value="youtube">YouTube</option><option value="netflix">Netflix</option><option value="google">Google</option></select></label>
            {service === 'netflix' && <div className="flex gap-3"><label>Season<input type="number" min={1} max={999} className="agent-input" value={season} onChange={event => setSeason(Number(event.target.value))} /></label><label>Episode<input type="number" min={1} max={999} className="agent-input" value={episode} onChange={event => setEpisode(Number(event.target.value))} /></label></div>}
            <label>Search title or query<input className="agent-input" value={query} maxLength={500} onChange={event => setQuery(event.target.value)} required /></label><button className="agent-button">Review search</button><button type="button" className="agent-button ml-2" disabled={service === 'google' || !query.trim()} onClick={() => void run(() => propose([{ capability: 'browser', action: 'watch', args: { service, query, season, episode } }]))}>Review watching this title</button>
          </form>
            {service === 'google' && <p><button type="button" className="agent-button" disabled={!query.trim()} onClick={() => void run(() => propose([{ capability: 'research', action: 'searchToNotepad', args: { query } }]))}>Review public search and Notepad notes</button><span className="block text-white/60 mt-1">Reads public source excerpts without Chrome permission. Sends this query to public search and creates a separate Notepad draft after scope approval.</span></p>}
          <form onSubmit={event => { event.preventDefault(); void run(() => propose([{ capability: 'browser', action: 'readPublic', args: { url: publicUrl } }])); }}><label>Public page fallback (no signed-in access)<input type="url" className="agent-input" value={publicUrl} onChange={event => setPublicUrl(event.target.value)} required /></label><button className="agent-button mt-2">Review public-page reading</button></form>
          <h3 className="font-semibold">Compare Word documents</h3>
          <form onSubmit={event => { event.preventDefault(); void run(() => propose([{ capability: 'duplicates', action: 'scan', args: { folder } }])); }}>
            <label>Personal folder to scan<input className="agent-input" value={folder} onChange={event => setFolder(event.target.value)} placeholder="C:\Users\YourName\Documents" required /></label><button className="agent-button mt-2">Review scan scope</button>
          </form>
        </section>
        </details>
        <section ref={taskSection} className="space-y-3" aria-label="Task activity"><h3 className="font-semibold">Tasks</h3>
          {!state.tasks.length && <p>No tasks yet. Speak a request or choose a workflow above.</p>}
          {[...state.tasks].reverse().map(task => <article key={task.id} className="border border-white/20 p-3 rounded-lg space-y-2">
            <p role="status">{task.state} · {task.results.length}/{task.steps.length} steps complete</p>
            <details open={task.state === 'waiting-approval'}><summary>Requested steps and destinations</summary><p>Browser queries and URLs are sent to that website. Gmail drafts are stored by Google. Approve only the exact sources and content you intend to disclose.</p><pre className="agent-json">{JSON.stringify(task.steps, null, 2)}</pre></details>
            {task.progress && <p role="status">Scanned {task.progress.completed} of {task.progress.total} files</p>}
            {task.error && <p className="text-amber-200">{task.error}</p>}
            {task.state === 'waiting-approval' && <button className="agent-button" disabled={task.expires <= Date.now()} onClick={() => void run(() => request(`/tasks/${task.id}/approve`, {}))}>{task.expires <= Date.now() ? 'Review expired — create a new request' : task.approval === 'scope' ? 'Approve this scope' : 'Approve this exact action'}</button>}
            {['running', 'waiting-approval', 'planning'].includes(task.state) && <button className="agent-button" onClick={() => void run(() => request(`/tasks/${task.id}/cancel`, {}))}>Stop task</button>}
            <p className="text-white/60">Stop prevents further steps; an action already delivered to an app may finish.</p>
            {task.results.map((result, index) => result.report ? <DuplicateReview key={result.report.id} report={result.report} onRecycle={paths => run(() => propose([{ capability: 'duplicates', action: 'recycle', args: { reportId: result.report.id, paths } }]))} /> : result.documentId ? <BrowserResult key={index} result={result} taskId={task.id} index={index} language={stateManager.getLanguage()} player={player} propose={steps => run(() => propose(steps))} /> : <details key={index}><summary>Local result {index + 1}</summary><pre className="agent-json">{JSON.stringify(result, null, 2)}</pre></details>)}
            {task.results.length > 0 && <div className="flex flex-wrap gap-2"><button className="agent-button" onClick={() => liveSession.notifyAgent(task.id)}>Tell assistant task status</button><button className="agent-button" disabled={state.mode === 'local-only'} onClick={() => void run(() => request('/disclosures', { taskId: task.id }))}>Review sharing results with Google</button></div>}
          </article>)}
          {state.previousTasks.some(previous => previous.state === 'uncertain' && !state.tasks.some(task => task.id === previous.id)) && <p className="text-amber-200">Earlier tasks were interrupted by a restart. Inspect the affected apps and create a new reviewed task; they will not resume automatically.</p>}
        </section>
        <section ref={sharingSection} className="space-y-3" aria-label="Private sharing reviews"><h3 className="font-semibold">Sharing reviews</h3><p>Approval is for the exact payload below, sent to Google Gemini. Secrets cannot be approved. Start a cloud voice session before sharing.</p>
          {state.disclosures.filter(row => row.state === 'pending').map(row => <article key={row.id} className="border border-white/20 p-3 rounded-lg space-y-2"><p>{row.source} → {row.destination}</p><pre className="agent-json">{row.preview}</pre><button className="agent-button" disabled={!state.providerPaid || state.mode === 'local-only' || stateManager.getState().assistantState === 'disconnected'} onClick={() => void run(async () => { await request(`/disclosures/${row.id}/approve`, {}); liveSession.notifyAgent(row.id, true); })}>Approve and share this payload</button><button className="agent-button" onClick={() => void run(() => request(`/disclosures/${row.id}/cancel`, {}))}>Keep private</button></article>)}
        </section>
      </div>}
    </dialog>
  </>;
}
