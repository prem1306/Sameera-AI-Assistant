import { desktopSessionToken } from '../services/tools/DesktopSession';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { MailDraft } from '../services/GmailBridge';

export function GmailPanel() {
  const dialog = useRef<HTMLDialogElement>(null);
  const token = useRef('');
  const lastPreview = useRef('');
  const [connected, setConnected] = useState(false);
  const [draft, setDraft] = useState<MailDraft | null>(null);
  const [pair, setPair] = useState<{ token: string; extensionPath: string } | null>(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [showSetup, setShowSetup] = useState(false);

  const api = useCallback(async (url: string, body?: unknown) => {
    if (!token.current) token.current = await desktopSessionToken();
    const response = await fetch(url, { method: body === undefined ? 'GET' : 'POST', headers: { 'Content-Type': 'application/json', 'X-Sameera-Token': token.current }, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(30000) });
    if (response.status === 403) { token.current = ''; throw new Error('The server restarted. Please refresh Sameera.'); }
    if (!response.ok) throw new Error('Gmail setup is unavailable. Check the local server.');
    return response.json();
  }, []);

  const refresh = useCallback(async () => {
    try {
      const state = await api('/api/mail/state');
      setConnected(state.connected);
      setDraft(state.draft);
      const key = state.draft ? `${state.draft.id}:${state.draft.approvalRequested}:${state.draft.state}` : '';
      if (key && key !== lastPreview.current) {
        lastPreview.current = key;
        setShowSetup(false);
        dialog.current?.showModal();
      }
    } catch { setConnected(false); }
  }, [api]);

  useEffect(() => {
    void refresh();
    const timer = setInterval(refresh, 3000);
    window.addEventListener('sameera-mail-update', refresh);
    return () => { clearInterval(timer); window.removeEventListener('sameera-mail-update', refresh); };
  }, [refresh]);

  const open = async () => {
    setMessage('');
    setShowSetup(!draft || !connected);
    dialog.current?.showModal();
    try { setPair(await api('/api/mail/pair')); }
    catch (error) { setMessage((error as Error).message); }
  };
  const approve = async () => {
    if (!draft || busy) return;
    setBusy(true);
    setMessage('Checking the exact Gmail draft before sending…');
    try {
      const result = await api('/api/mail/approve', { id: draft.id });
      setMessage(result.message || result.question || 'Please inspect Gmail.');
      await refresh();
      window.dispatchEvent(new Event('sameera-mail-result'));
    } catch { setMessage('Sending could not be confirmed. Check Gmail Sent; do not retry automatically.'); }
    finally { setBusy(false); }
  };
  const cancel = async () => {
    if (!draft || busy) return;
    try { await api('/api/mail/cancel', { id: draft.id }); setMessage('Sending permission withdrawn. The draft stays in Gmail.'); await refresh(); }
    catch (error) { setMessage((error as Error).message); }
  };
  const copy = async (value: string, label: string) => {
    try { await navigator.clipboard.writeText(value); setMessage(`${label} copied.`); }
    catch { setMessage(`Select and copy the ${label.toLowerCase()} shown below.`); }
  };

  return <>
    <button type="button" onClick={open} className="px-3 py-2 text-xs rounded-xl border border-white/15 bg-white/5 hover:bg-white/10 text-white" aria-label="Browser and Gmail setup">
      Gmail <span className={connected ? 'text-emerald-300' : 'text-white/45'}>{connected ? '●' : '○'}</span>
    </button>
    <dialog ref={dialog} aria-labelledby="gmail-title" className="w-[calc(100%-2rem)] max-w-xl max-h-[85vh] overflow-y-auto rounded-2xl border border-white/20 bg-slate-950 p-6 text-white shadow-2xl backdrop:bg-black/75">
      <div className="flex items-center justify-between gap-4 mb-4">
        <h2 id="gmail-title" className="text-lg font-semibold">{showSetup ? 'Connect Gmail in Chrome' : 'Gmail draft'}</h2>
        <button type="button" onClick={() => dialog.current?.close()} className="px-3 py-2 rounded-lg hover:bg-white/10" aria-label="Close Gmail preview">✕</button>
      </div>
      <p className="text-sm text-white/65 mb-4">{connected ? 'Chrome bridge connected' : 'Chrome bridge disconnected'}</p>
      {showSetup ? <div className="text-sm space-y-4 leading-relaxed">
        <ol className="list-decimal pl-5 space-y-3">
          <li>In Chrome, open <code>chrome://extensions</code>, enable Developer mode, and choose <strong>Load unpacked</strong>.</li>
          <li>Select the <strong>chrome-extension</strong> folder shown below.</li>
          <li>Open the Sameera Gmail Bridge extension, select <strong>{window.location.port === '3001' ? 'Windows desktop app' : 'Web app'}</strong>, paste the pairing code, and choose <strong>Connect</strong>.</li>
          <li>Leave one signed-in Gmail inbox tab open and reload it after installation. Then ask Sameera to draft your email.</li>
        </ol>
        {pair && <>
          <label className="block">Extension folder<input readOnly value={pair.extensionPath} className="mt-1 w-full rounded-lg p-2 bg-white/5 border border-white/15 text-xs" /></label>
          <button type="button" onClick={() => copy(pair.extensionPath, 'Folder path')} className="px-3 py-2 rounded-lg bg-white/10">Copy folder path</button>
          <label className="block">Pairing code<input readOnly type="password" value={pair.token} autoComplete="off" className="mt-1 w-full rounded-lg p-2 bg-white/5 border border-white/15" /></label>
          <button type="button" onClick={() => copy(pair.token, 'Pairing code')} className="px-3 py-2 rounded-lg bg-white/10">Copy pairing code</button>
        </>}
        <p className="text-white/60">Reconnect after restarting the local server. This bridge supports one recipient, plain text, and Gmail’s English interface. It stops if it cannot verify the page.</p>
      </div> : draft ? <div className="space-y-4 text-sm">
        <dl className="space-y-2 break-words"><div><dt className="text-white/50">From</dt><dd>{draft.sender}</dd></div><div><dt className="text-white/50">To</dt><dd>{draft.to}</dd></div><div><dt className="text-white/50">Subject</dt><dd>{draft.subject}</dd></div></dl>
        <div className="whitespace-pre-wrap break-words bg-white/5 border border-white/10 rounded-xl p-4 leading-relaxed">{draft.body}</div>
        <p className="text-white/65">{draft.state === 'draft' ? 'Nothing sent. Review the recipient and wording in Gmail. Ask Sameera to send when ready.' : draft.state === 'sending' ? 'Sending is in progress…' : draft.state === 'sent' ? 'Gmail confirmed this message was sent.' : 'Send result uncertain. Check Gmail Sent before further action.'}</p>
        {draft.approvalRequested && draft.state === 'draft' && <div className="flex flex-wrap gap-3">
          <button type="button" disabled={busy || draft.approvalExpires < Date.now()} onClick={approve} className="px-4 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 font-semibold">{busy ? 'Checking…' : 'Approve and send'}</button>
          <button type="button" disabled={busy} onClick={cancel} className="px-4 py-3 rounded-xl border border-white/20 hover:bg-white/10">Keep as draft</button>
        </div>}
        <button type="button" onClick={async () => { setShowSetup(true); try { setPair(await api('/api/mail/pair')); } catch {} }} className="underline text-white/60">Browser &amp; Gmail setup</button>
      </div> : <p>No email draft yet. Ask Sameera to draft an email with the recipient and what you want to say.</p>}
      <p role="status" aria-live="polite" className="text-sm text-cyan-200 mt-4">{message}</p>
    </dialog>
  </>;
}
