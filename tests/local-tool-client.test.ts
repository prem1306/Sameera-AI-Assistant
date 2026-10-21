import test from 'node:test';
import assert from 'node:assert/strict';
import { LocalActionClient } from '../src/services/tools/LocalActionClient.ts';
import { GmailTools } from '../src/services/tools/GmailTools.ts';
import { SystemTools } from '../src/services/tools/SystemTools.ts';
import type { ToolEffects } from '../src/services/tools/types.ts';

const effects: ToolEffects = { callbacks: () => ({}), recordEvent: () => {}, notify: () => {} };

test('local transport shares a session, renews after rejection, and never retries an action automatically', async () => {
  const calls: { url: string; token: string | null }[] = [];
  let sessions = 0;
  const client = new LocalActionClient(async (input, init) => {
    const url = String(input);
    calls.push({ url, token: new Headers(init?.headers).get('X-Sameera-Token') });
    return Response.json({ success: url !== '/api/system/action' }, { status: url === '/api/system/action' ? 403 : 200 });
  }, async () => `session-${++sessions}`);
  await client.request('/api/mail/state', { method: 'GET' });
  await client.request('/api/system/action', { method: 'POST' });
  assert.equal(calls.length, 2, 'a rejected action is not repeated');
  await client.request('/api/mcp/catalog', { method: 'GET' });
  assert.deepEqual(calls, [
    { url: '/api/mail/state', token: 'session-1' },
    { url: '/api/system/action', token: 'session-1' },
    { url: '/api/mcp/catalog', token: 'session-2' },
  ]);
});

test('privileged tool families stop for clarification after token rejection', async () => {
  let actions = 0;
  const client = new LocalActionClient(async input => {
    actions++;
    return Response.json({ success: false }, { status: 403 });
  }, async () => 'test-session');
  const system = await new SystemTools(client, effects).execute({ id: 'one', name: 'performSystemAction', args: { action: 'status' } });
  const gmail = await new GmailTools(client, effects).execute({ id: 'two', name: 'draftGmailMail', args: {} });
  assert.equal(system.needsClarification, true);
  assert.equal(gmail.needsClarification, true);
  assert.equal(actions, 2);
});

test('missing trusted bootstrap fails closed without any HTTP request', async () => {
  let requests = 0;
  const client = new LocalActionClient(async () => { requests++; return Response.json({}); });
  await assert.rejects(client.request('/api/agent/state', {}), /desktop app/);
  assert.equal(requests, 0);
});
