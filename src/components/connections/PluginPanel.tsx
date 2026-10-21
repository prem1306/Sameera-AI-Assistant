import { useState } from 'react';
import { inputStyle, buttonStyle, type ConnectionAction, type ConnectionsState } from './useConnections';

export function PluginPanel({ plugins, run, busy }: { plugins: ConnectionsState['plugins']; run: ConnectionAction; busy: boolean }) {
  const [json, setJson] = useState('');
  const [error, setError] = useState('');
  return <section className="space-y-4">
    <p className="text-sm text-white/70">Plugins are reusable MCP connection presets. Import one, review its server details, then add it as a connection. Tools stay disabled until you enable them.</p>
    {!plugins.length && <p className="text-sm text-white/65 py-3">No plugin presets imported yet.</p>}
    {plugins.map(plugin => <article key={plugin.id} className="rounded-xl border border-white/15 p-4 space-y-2">
      <h3 className="font-semibold">{plugin.name}</h3><p className="text-sm text-white/70">{plugin.manifest.description}</p>
      <pre className="text-xs break-words whitespace-pre-wrap bg-black/20 p-3">{JSON.stringify(plugin.manifest.connection, null, 2)}</pre>
      <div className="flex flex-wrap gap-2"><button type="button" disabled={busy} className={buttonStyle} onClick={() => void run('addPluginConnection', { id: plugin.id })}>Add as MCP server</button><button type="button" disabled={busy} className={buttonStyle} onClick={() => void run('removePlugin', { id: plugin.id })}>Remove preset</button></div>
    </article>)}
    <form className="space-y-3 border-t border-white/15 pt-4" onSubmit={async event => {
      event.preventDefault(); setError('');
      try { if (await run('importPlugin', { manifest: JSON.parse(json) })) setJson(''); }
      catch { setError('Enter valid plugin preset JSON.'); }
    }}>
      <h3 className="font-semibold">Import plugin preset</h3>
      <label className="block text-sm">JSON file<input className={inputStyle} type="file" accept=".json,application/json" disabled={busy} onChange={async event => {
        const file = event.target.files?.[0];
        if (!file) return;
        if (file.size > 32000) { setError('Preset files must be under 32 KB.'); return; }
        try { setJson(await file.text()); setError(''); } catch { setError('Could not read this file.'); }
      }} /></label>
      <label className="block text-sm">Or paste preset JSON<textarea rows={7} className={inputStyle} maxLength={32000} value={json} onChange={event => setJson(event.target.value)} /></label>
      <details className="text-sm"><summary className="cursor-pointer">See preset format</summary><pre className="mt-2 text-xs whitespace-pre-wrap break-words">{JSON.stringify({ version: 1, name: 'My MCP server', description: 'Tools from my server', connection: { transport: 'http', url: 'https://your-server.example/mcp', allowLocalhost: false } }, null, 2)}</pre></details>
      {error && <p role="alert" className="text-sm text-rose-200">{error}</p>}
      <button className={buttonStyle} type="submit" disabled={busy || !json.trim()}>Import preset</button>
    </form>
  </section>;
}
