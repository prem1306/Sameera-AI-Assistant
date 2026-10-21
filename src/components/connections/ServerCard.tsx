import { useState } from 'react';
import { ToolList } from './ToolList';
import { inputStyle, buttonStyle, type ConnectionAction, type ServerRow } from './useConnections';

export function ServerCard({ row, run, busy }: { row: ServerRow; run: ConnectionAction; busy: boolean }) {
  const [token, setToken] = useState('');
  const [showToken, setShowToken] = useState(false);
  const [remove, setRemove] = useState(false);
  return <article className="border border-white/15 rounded-xl p-4 space-y-3">
    <div className="flex justify-between gap-3"><h3 className="font-semibold break-words">{row.name}</h3><span className="text-sm text-cyan-200 capitalize">{row.status}</span></div>
    <p className="text-xs text-white/65 break-all">{row.config.transport === 'http' ? row.config.url : `${row.config.command} ${row.config.args.join(' ')}`}</p>
    {row.error && <p role="alert" className="text-sm text-rose-200">{row.error}</p>}
    <div className="flex flex-wrap gap-2">
      <button type="button" disabled={busy} className={buttonStyle} onClick={() => void run(row.status === 'connected' ? 'disconnect' : 'connect', { id: row.id })}>{row.status === 'connected' ? 'Disconnect' : 'Connect'}</button>
      {row.enabled && <button type="button" disabled={busy} className={buttonStyle} onClick={() => void run('disable', { id: row.id })}>Disable</button>}
      {row.config.transport === 'http' && <button type="button" disabled={busy} className={buttonStyle} onClick={() => setShowToken(!showToken)}>{row.hasCredential ? 'Change token' : 'Add token'}</button>}
      <button type="button" disabled={busy} className={buttonStyle} onClick={() => setRemove(!remove)}>Remove</button>
    </div>
    {remove && <div className="text-sm space-y-2"><p>Remove this connection, its saved token, and tool permissions?</p><button type="button" disabled={busy} className={buttonStyle} onClick={() => void run('remove', { id: row.id })}>Confirm removal</button></div>}
    {showToken && <form onSubmit={async event => { event.preventDefault(); if (await run('token', { id: row.id, token })) { setToken(''); setShowToken(false); } }}>
      <label className="block text-sm">Bearer token<input type="password" autoComplete="off" className={inputStyle} maxLength={4096} value={token} onChange={event => setToken(event.target.value)} /></label>
      <p className="text-xs text-white/65 mt-1">Encrypted for your Windows account. Leave empty to remove the saved token. Reconnect after changing it.</p>
      <button className={`${buttonStyle} mt-2`} disabled={busy} type="submit">Save token</button>
    </form>}
    {row.status === 'connected' && <ToolList id={row.id} tools={row.tools} run={run} busy={busy} />}
  </article>;
}
