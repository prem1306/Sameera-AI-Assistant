// Requires the local server. Never creates a compose window or sends email.
import assert from 'node:assert/strict';
const base = 'http://127.0.0.1:3000';
const session = await fetch(base + '/api/system/session').then((response) => response.json());
const headers = { 'Content-Type': 'application/json', 'X-Sameera-Token': session.token };
assert.equal((await fetch(base + '/api/mail/state')).status, 403);
assert.equal((await fetch(base + '/api/mail/pair', { headers: { ...headers, Origin: 'https://example.com' } })).status, 403);
const pair = await fetch(base + '/api/mail/pair', { headers }).then((response) => response.json());
assert.match(pair.token, /^[a-f0-9]{64}$/);
assert.notEqual(pair.token, session.token);
const extension = 'chrome-extension://' + 'a'.repeat(32);
assert.equal((await fetch(base + '/api/browser/next', { method: 'POST', headers: { Origin: extension, 'X-Sameera-Browser-Token': session.token } })).status, 403);
assert.equal((await fetch(base + '/api/system/action', { method: 'POST', headers: { Origin: extension, 'X-Sameera-Token': pair.token } })).status, 403);
const post = (url, body) => fetch(base + url, { method: 'POST', headers, body: JSON.stringify(body) }).then((response) => response.json());
assert.equal((await post('/api/mail/approve', { id: 'forged-model-approval' })).needsClarification, true);
assert.equal((await post('/api/mail/draft', { id: 'smoke-missing-address', mail: { to: 'Alex', subject: 'Hello', body: 'Hi' } })).needsClarification, true);
const state = await fetch(base + '/api/mail/state', { headers }).then((response) => response.json());
assert.equal(state.draft, null);
console.log('PASS: Gmail authorization, separate bridge token, and missing-detail gates; no email created or sent.');
