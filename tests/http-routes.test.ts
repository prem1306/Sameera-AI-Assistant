import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import type { AddressInfo } from 'node:net';
import { systemRoutes } from '../src/routes/system.ts';
import { gmailRoutes, gmailBrowserRoutes } from '../src/routes/gmail.ts';
import { articleRoutes } from '../src/routes/articles.ts';
import { mediaRoutes } from '../src/routes/media.ts';
import type { ArticleSearchState } from '../src/types/assistant.ts';

async function withApp(app: express.Express, run: (base: string) => Promise<void>) {
  const server = app.listen(0, '127.0.0.1');
  try {
    await new Promise<void>((resolve, reject) => { server.once('listening', resolve); server.once('error', reject); });
    await run(`http://127.0.0.1:${(server.address() as AddressInfo).port}`);
  } finally { await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())); }
}

test('system routes require the local token, validate requests, and preserve executor results', async () => {
  const calls: unknown[] = [];
  const result = { success: false, needsClarification: true, question: 'Which application?' };
  const app = express();
  app.use(express.json());
  app.use('/api/system', systemRoutes({ execute: async (...args) => { calls.push(args); return result; } }, 'test-session'));
  await withApp(app, async base => {
    const session = await fetch(base + '/api/system/session');
    assert.equal(session.headers.get('cache-control'), 'no-store');
    assert.equal(session.status, 403);
    assert.ok(!(await session.text()).includes('test-session'));
    const post = (body: unknown, token?: string) => fetch(base + '/api/system/action', { method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { 'X-Sameera-Token': token } : {}) }, body: JSON.stringify(body) });
    for (const token of [undefined, 'expired-session']) {
      const response = await post({ id: 'one', action: 'openApplication', args: {} }, token);
      assert.equal(response.status, 403);
      assert.deepEqual(await response.json(), { success: false, error: 'Local action session expired.' });
    }
    for (const body of [{}, { id: 1, action: 'status', args: {} }, { id: 'x'.repeat(101), action: 'status', args: {} }, { id: 'one', action: 1, args: {} }, { id: 'one', action: 'status', args: null }, { id: 'one', action: 'status', args: 'invalid' }]) {
      assert.equal((await post(body, 'test-session')).status, 400);
    }
    assert.deepEqual(calls, []);
    const response = await post({ id: 'one', action: 'openApplication', args: { application: 'Editor' } }, 'test-session');
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), result);
    assert.deepEqual(calls, [['one', 'openApplication', { application: 'Editor' }]]);
  });
});

test('Gmail routes keep browser pairing separate from human send approval', async () => {
  const calls: unknown[] = [];
  const draft = { id: 'draft-id', to: 'user@example.com', subject: 'Test', body: 'Test body', sender: 'sender@example.com', tabId: 1, state: 'draft' as const, approvalRequested: true, approvalExpires: 0 };
  const bridge = {
    token: 'browser-pair', status: () => ({ connected: true, draft: null }),
    prepare: async (id: string) => { calls.push(['draft', id]); return { success: true }; },
    requestApproval: () => { calls.push(['request']); return { success: true, requiresUserApproval: true, draft, instruction: 'Review the draft.' }; },
    approve: async (id: string) => { calls.push(['approve', id]); return { success: true }; },
    cancelApproval: (id: string) => { calls.push(['cancel', id]); return { success: true, message: 'Cancelled.' }; },
    next: () => { calls.push(['next']); return null; },
    finish: (id: string) => { calls.push(['finish', id]); return true; },
  };
  const app = express();
  app.use(express.json());
  app.use('/api/mail', gmailRoutes(bridge, 'local-session', { extensionPath: 'extension', serverUrl: 'http://127.0.0.1:3000' }));
  app.use('/api/browser', gmailBrowserRoutes(bridge));
  await withApp(app, async base => {
    const post = (route: string, headers: Record<string, string>, body: unknown = {}) => fetch(base + route, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) });
    const local = { 'X-Sameera-Token': 'local-session' };
    const browser = { 'X-Sameera-Browser-Token': 'browser-pair' };
    for (const route of ['/state', '/pair']) assert.equal((await fetch(base + '/api/mail' + route, { headers: browser })).status, 403);
    for (const route of ['/draft', '/request-send', '/approve', '/cancel']) {
      assert.equal((await post('/api/mail' + route, browser, { id: 'draft-id' })).status, 403);
    }
    for (const route of ['/next', '/result']) assert.equal((await post('/api/browser' + route, local)).status, 403);
    assert.deepEqual(calls, []);
    const pair = await fetch(base + '/api/mail/pair', { headers: local });
    assert.equal(pair.headers.get('cache-control'), 'no-store');
    assert.deepEqual(await pair.json(), { token: 'browser-pair', extensionPath: 'extension', serverUrl: 'http://127.0.0.1:3000' });
    assert.equal((await post('/api/mail/draft', local)).status, 400);
    const approval = await post('/api/mail/request-send', local);
    assert.deepEqual(await approval.json(), { success: true, requiresUserApproval: true, draft, instruction: 'Review the draft.' });
    assert.deepEqual(calls, [['request']], 'requesting review must not call approve');
    await post('/api/mail/approve', local, { id: 'draft-id' });
    await post('/api/mail/cancel', local, { id: 'draft-id' });
    await post('/api/mail/draft', local, { id: 'new-draft', mail: { to: 'user@example.com' } });
    await post('/api/browser/next', browser);
    await post('/api/browser/result', browser, { id: 'job-id', result: { success: true } });
    assert.deepEqual(calls, [['request'], ['approve', 'draft-id'], ['cancel', 'draft-id'], ['draft', 'new-draft'], ['next'], ['finish', 'job-id']]);
  });
});

test('article routes validate input, retain key availability checks and support GET/POST scraping', async () => {
  let key: string | undefined;
  const calls: unknown[] = [];
  const search: ArticleSearchState = { topic: 'space', articles: [], provider: 'test' };
  const scraped = { success: true, title: 'Space', sourceUrl: 'https://example.com/article', paragraphs: ['Space'], fullText: 'Space', excerpt: 'Space', wordCount: 1 };
  const app = express();
  app.use(express.json());
  app.use('/api', articleRoutes({ apiKey: () => key, search: async (topic, apiKey) => { calls.push([topic, apiKey]); if (topic === 'offline') throw new Error('Search unavailable'); return search; }, scrape: async url => { calls.push(url); return scraped; } }));
  await withApp(app, async base => {
    const post = (route: string, body: unknown) => fetch(base + route, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    for (const topic of ['', 'x'.repeat(501)]) assert.equal((await post('/api/search-articles', { topic })).status, 400);
    assert.equal((await post('/api/search-articles', { topic: 'space' })).status, 503);
    assert.deepEqual(calls, []);
    key = 'test-key';
    assert.deepEqual(await (await post('/api/search-articles', { topic: ' space ' })).json(), { success: true, ...search });
    assert.equal((await post('/api/search-articles', { topic: 'offline' })).status, 502);
    assert.equal((await fetch(base + '/api/scrape-article')).status, 400);
    assert.deepEqual(await (await fetch(base + '/api/scrape-article?url=https%3A%2F%2Fexample.com%2Farticle')).json(), scraped);
    assert.deepEqual(await (await post('/api/scrape-article', { url: ' https://example.com/article ' })).json(), scraped);
    assert.deepEqual(calls, [['space', 'test-key'], ['offline', 'test-key'], 'https://example.com/article', 'https://example.com/article']);
  });
});

test('media routes filter YouTube candidates and return search failure without opening content', async () => {
  const calls: unknown[] = [];
  const video = { id: 'one', url: 'https://www.youtube.com/watch?v=abcdefghijk', title: 'Video', website: 'youtube.com' };
  const app = express();
  app.use(express.json());
  app.use('/api', mediaRoutes(async (query, distinct) => {
    calls.push([query, distinct]);
    if (query.includes('offline')) throw new Error('Offline');
    return { topic: query, provider: 'test', articles: [video, { ...video, url: 'https://youtube.com.evil.test/watch?v=abcdefghijk' }, { ...video, url: 'https://youtube.com/watch?v=short' }] };
  }));
  await withApp(app, async base => {
    const post = (query: string) => fetch(base + '/api/find-youtube-videos', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query }) });
    assert.equal((await post('')).status, 400);
    assert.deepEqual(calls, []);
    const result = await (await post(' space ')).json();
    assert.equal(result.success, true);
    assert.deepEqual(result.videos, [video]);
    assert.equal((await post('offline')).status, 502);
    assert.deepEqual(calls, [['site:youtube.com/watch space', false], ['site:youtube.com/watch offline', false]]);
  });
});
