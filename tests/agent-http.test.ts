import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { WebSocket } from 'ws';

test('desktop HTTP and WS cannot bypass local reviews, pairing or Local-only AI', { timeout: 60000 }, async () => {
  const root = await fs.mkdtemp(path.join(process.cwd(), '.agent-http-'));
  const token = 'a'.repeat(64);
  const port = 3097, origin = `http://127.0.0.1:${port}`;
  const child = spawn(process.execPath, ['--import', 'tsx', 'server.ts'], { windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'], env: { ...process.env, SAMEERA_MODE: 'desktop', SAMEERA_DESKTOP_TOKEN: token, SAMEERA_LOCAL_START: '1', NODE_ENV: 'production', PORT: String(port), GEMINI_API_KEY: '', SAMEERA_DATABASE_PATH: path.join(root, 'sameera.sqlite') } });
  let startupErrors = '';
  child.stderr.on('data', data => { startupErrors = (startupErrors + data.toString()).slice(-2000); });
  try {
    let ready = false;
    // Match the desktop launcher's 30-second startup budget under parallel tests.
    for (let attempt = 0; attempt < 200; attempt++) { if (await fetch(origin + '/api/health').then(r => r.ok).catch(() => false)) { ready = true; break; } await new Promise(resolve => setTimeout(resolve, 150)); }
    assert.ok(ready, 'Isolated desktop startup failed: ' + startupErrors);
    for (const headers of [new Headers(), new Headers({ Origin: origin })]) {
      const session = await fetch(origin + '/api/system/session', { headers });
      assert.equal(session.status, 403);
      assert.ok(!(await session.text()).includes(token));
    }
    assert.equal((await fetch(origin + '/api/agent/state')).status, 403);
    assert.equal((await fetch(origin + '/api/voice/session', { method: 'POST' })).status, 403);
    const call = (route: string, body?: unknown, headers: Record<string, string> = {}) => fetch(origin + route, { method: body === undefined ? 'GET' : 'POST', headers: { Origin: origin, 'x-sameera-token': token, 'Content-Type': 'application/json', ...headers }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    assert.equal((await call('/api/agent/state', undefined, { 'x-sameera-token': 'wrong' })).status, 403);
    const file = path.join(root, 'private.txt'); await fs.writeFile(file, 'LOCAL-PRIVATE-FIXTURE');
    const task = await call('/api/agent/tasks', { steps: [{ capability: 'system', action: 'readText', args: { path: file } }] }).then(r => r.json());
    assert.equal(task.state, 'waiting-approval'); assert.deepEqual(task.results, []);
    await call(`/api/agent/tasks/${task.id}/approve`, {});
    let state: any;
    for (let attempt = 0; attempt < 30; attempt++) { state = await call('/api/agent/state').then(r => r.json()); if (state.tasks[0].state === 'completed') break; await new Promise(resolve => setTimeout(resolve, 30)); }
    assert.equal(state.tasks[0].results[0].text, 'LOCAL-PRIVATE-FIXTURE'); assert.equal(state.mode, 'local-only');
    assert.equal((await call('/api/research/search', { query: 'LOCAL-PRIVATE-FIXTURE' })).status, 403);
    assert.equal((await call('/api/search-articles', { topic: 'LOCAL-PRIVATE-FIXTURE' })).status, 403);
    assert.equal((await call('/api/mcp/action', { operation: 'connect', args: { id: 'unreviewed-plugin' } })).status, 403);
    assert.equal((await call('/api/voice/sample', {})).status, 503); // No installed local model; no provider fallback.
    const secret = await call('/api/agent/tasks', { steps: [{ capability: 'browser', action: 'search', args: { service: 'google', query: 'api_key=secret-value' } }] }); assert.equal(secret.status, 400);
    const pair = await call('/api/mail/pair').then(r => r.json());
    const extension = 'chrome-extension://' + 'a'.repeat(32), other = 'chrome-extension://' + 'b'.repeat(32);
    assert.equal((await call('/api/browser/agent-next', {}, { Origin: extension, 'x-sameera-browser-token': 'wrong' })).status, 403);
    assert.equal((await call('/api/browser/agent-next', {}, { Origin: extension, 'x-sameera-browser-token': pair.token })).status, 200);
    assert.equal((await call('/api/browser/agent-next', {}, { Origin: other, 'x-sameera-browser-token': pair.token })).status, 403);
    assert.equal((await call('/api/browser/agent-result', { id: 'replay', result: { success: true } }, { Origin: extension, 'x-sameera-browser-token': pair.token })).status, 400);
    const { ticket } = await call('/api/voice/session', {}).then(r => r.json());
    const socket = new WebSocket(`ws://127.0.0.1:${port}/live?ticket=${ticket}`, { origin });
    const messages: string[] = []; socket.on('message', data => messages.push(String(data))); await once(socket, 'close'); assert.match(messages.join(''), /offline package/);
    const replay = new WebSocket(`ws://127.0.0.1:${port}/live?ticket=${ticket}`, { origin }); await once(replay, 'error');
  } finally { const exited = once(child, 'exit'); child.kill(); await exited; assert.equal(path.dirname(root), process.cwd()); await fs.rm(root, { recursive: true, force: true }); }
});
