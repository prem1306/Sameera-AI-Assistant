import { useState } from 'react';
import type { Step } from '../../services/agent/TaskRunner';
import type { AudioPlayer } from '../../services/AudioPlayer';
import { LocalActionClient } from '../../services/tools/LocalActionClient';
import type { Language } from '../../services/session/Preferences';

export function BrowserResult({ result, taskId, index, language, player, propose }: { result: Record<string, any>; taskId: string; index: number; language: Language; player: AudioPlayer; propose: (steps: Step[]) => Promise<void> }) {
  const [offset, setOffset] = useState<number | null>(0), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const perform = async (operation: () => Promise<void>) => { setError(''); setBusy(true); try { await operation(); } catch (error) { setError((error as Error).message); } finally { setBusy(false); } };
  return <div className="space-y-2">
    <p>{result.title} · {result.url}</p>
    {result.error && <p>{result.error}</p>}
    {result.text && <details><summary>Read locally ({result.text.length} characters)</summary><p className="whitespace-pre-wrap">{result.text}</p></details>}
    {result.text && <button disabled={busy || offset === null} className="agent-button" onClick={() => void perform(async () => {
      await player.unlock();
      const response = await new LocalActionClient().request('/api/local-ai/read-result', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ taskId, index, offset, language }) });
      const speech = await response.json(); if (!response.ok) throw new Error(speech.error || 'Local speech unavailable.'); player.queueAudioChunk(speech.audio); setOffset(speech.nextOffset);
    })}>{offset === 0 ? 'Read aloud with local speech' : offset === null ? 'Reading finished' : 'Read next speech chunk'}</button>}
    {result.nextOffset != null && <button className="agent-button ml-2" disabled={busy} onClick={() => void perform(() => propose([{ capability: 'browser', action: result.reader === 'public' ? 'readPublic' : 'read', args: { url: result.url, tabId: result.tabId, documentId: result.documentId, offset: result.nextOffset } }]))}>Continue page reading</button>}
    {result.text && !result.summary && <button className="agent-button ml-2" disabled={busy} onClick={() => void perform(() => propose([{ capability: 'browser', action: 'summarize', args: { reader: result.reader, url: result.url, tabId: result.tabId, documentId: result.documentId, offset: result.offset || 0 } }]))}>Review local summary</button>}
    {result.truncated && <p>Extraction reached its page limit; some content is not included.</p>}
    {result.candidates?.length > 0 && <details><summary>Choose a result</summary><ul className="space-y-2">{result.candidates.map((candidate: any) => <li key={candidate.candidateId}><button className="agent-button" disabled={busy} onClick={() => void perform(() => propose([{ capability: 'browser', action: 'select', args: { tabId: result.tabId, documentId: result.documentId, candidateId: candidate.candidateId, url: candidate.url, title: candidate.title } }]))}>{candidate.title}</button><p className="break-all text-xs">{candidate.url}</p></li>)}</ul></details>}
    {result.playerTitle && result.reader !== 'public' && <div><button className="agent-button" disabled={busy} onClick={() => void perform(() => propose([{ capability: 'browser', action: 'play', args: { tabId: result.tabId, documentId: result.documentId, expectedTitle: result.playerTitle } }]))}>Review Play</button><button className="agent-button ml-2" disabled={busy} onClick={() => void perform(() => propose([{ capability: 'browser', action: 'pause', args: { tabId: result.tabId, documentId: result.documentId, expectedTitle: result.playerTitle } }]))}>Review Pause</button></div>}
    {error && <p role="alert">{error}</p>}
  </div>;
}
