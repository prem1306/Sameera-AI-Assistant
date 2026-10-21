import { useState } from 'react';
import { inputStyle, buttonStyle, type ConnectionAction } from './useConnections';

export function ConnectionForm({ run, busy }: { run: ConnectionAction; busy: boolean }) {
  const [transport, setTransport] = useState('http');
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [command, setCommand] = useState('');
  const [args, setArgs] = useState('[]');
  const [local, setLocal] = useState(false);
  const [error, setError] = useState('');
  return <form className="space-y-3 border-t border-white/15 pt-5" onSubmit={async event => {
    event.preventDefault(); setError('');
    try {
      const config = transport === 'http' ? { transport, url, allowLocalhost: local } : { transport, command, args: JSON.parse(args) };
      const result = await run('add', { name, config });
      if (result) { setName(''); setUrl(''); setCommand(''); setArgs('[]'); }
    } catch { setError('Arguments must be a JSON array of strings.'); }
  }}>
    <h3 className="font-semibold">Add MCP server</h3>
    <label className="block text-sm">Name<input className={inputStyle} required maxLength={100} value={name} onChange={event => setName(event.target.value)} /></label>
    <label className="block text-sm">Connection type<select className={inputStyle} value={transport} onChange={event => setTransport(event.target.value)}><option className="bg-slate-900" value="http">Remote URL</option><option className="bg-slate-900" value="stdio">Local process</option></select></label>
    {transport === 'http' ? <>
      <label className="block text-sm">MCP URL<input className={inputStyle} type="url" required value={url} onChange={event => setUrl(event.target.value)} placeholder="https://your-server.example/mcp" /></label>
      <label className="flex gap-2 items-center text-sm"><input type="checkbox" checked={local} onChange={event => setLocal(event.target.checked)} />Allow a server on localhost</label>
      <p className="text-xs text-white/65">Supports Streamable HTTP. Add a bearer token after saving if required. OAuth sign-in is not available yet.</p>
    </> : <>
      <label className="block text-sm">Executable path<input className={inputStyle} required value={command} onChange={event => setCommand(event.target.value)} placeholder="C:\Program Files\nodejs\node.exe" /></label>
      <label className="block text-sm">Arguments as a JSON array<textarea className={inputStyle} rows={2} value={args} onChange={event => setArgs(event.target.value)} placeholder={'["C:\\mcp\\server.js"]'} /></label>
      <p className="text-xs text-white/65">Connecting starts this executable on your PC. Install any required runtime first. Sameera does not pass its Gemini key to the process.</p>
    </>}
    {error && <p role="alert" className="text-sm text-rose-200">{error}</p>}
    <button className={buttonStyle} disabled={busy} type="submit">Save server</button>
  </form>;
}
