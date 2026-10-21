import assert from 'node:assert/strict';
import test from 'node:test';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { WebSocket } from 'ws';
import http from 'node:http';

function get(url: string, headers: Record<string, string> = {}, method = 'GET'): Promise<{ status: number; json: () => any }> {
  return new Promise((resolve, reject) => {
    http.request(url, { headers, method }, (response) => {
      let body = '';
      response.on('data', (chunk) => { body += chunk; });
      response.on('end', () => resolve({ status: response.statusCode!, json: () => JSON.parse(body) }));
      response.on('error', reject);
    }).on('error', reject).end();
  });
}

test('production web server serves public host while rejecting Windows routes and cross-origin sessions', { timeout: 30000 }, async () => {
  const port = 3098;
  const child = spawn(process.execPath, ['scripts/run-web.mjs', '--production'], { env: { ...process.env, PORT: String(port), GEMINI_API_KEY: '', SAMEERA_ALLOWED_HOSTS: 'sameera.replit.app', REPLIT_DEV_DOMAIN: '', REPLIT_DOMAINS: '' }, stdio: 'ignore' });
  try {
    let started = false;
    for (let attempt = 0; attempt < 80; attempt++) {
      try { if ((await get(`http://127.0.0.1:${port}/api/health`)).status === 200) { started = true; break; } } catch {}
      await new Promise((resolve) => setTimeout(resolve, 150));
    }
    assert.equal(started, true, 'server started');
    const headers = { Host: 'sameera.replit.app', Origin: 'https://sameera.replit.app' };
    const caps = await get(`http://127.0.0.1:${port}/api/capabilities`, headers).then((response) => response.json());
    assert.equal(caps.mode, 'web');
    assert.equal(caps.windowsControls, false);
    assert.equal(caps.gmailBridge, false);
    assert.equal((await get(`http://127.0.0.1:${port}/`, headers)).status, 200);
    for (const route of ['/api/system/session', '/api/mail/state', '/api/mail/pair', '/api/browser/next', '/api/mcp/catalog']) assert.equal((await get(`http://127.0.0.1:${port}${route}`, headers)).status, 403);
    assert.equal((await get(`http://127.0.0.1:${port}/api/capabilities`, { ...headers, Origin: 'https://evil.test' })).status, 403);
    const rejected = new WebSocket(`ws://127.0.0.1:${port}/live`, { headers: { ...headers, Origin: 'https://evil.test' } });
    await once(rejected, 'error');
    const noTicket = new WebSocket(`ws://127.0.0.1:${port}/live`, { headers }); await once(noTicket, 'error');
    const ticketResponse = await get(`http://127.0.0.1:${port}/api/voice/session`, headers, 'POST');
    assert.equal(ticketResponse.status, 200); const { ticket } = await ticketResponse.json();
    const accepted = new WebSocket(`ws://127.0.0.1:${port}/live?ticket=${ticket}`, { headers });
    await once(accepted, 'open');
    accepted.close();
    const replay = new WebSocket(`ws://127.0.0.1:${port}/live?ticket=${ticket}`, { headers }); await once(replay, 'error');
  } finally {
    const exited = once(child, 'exit');
    child.kill();
    await exited;
  }
});
