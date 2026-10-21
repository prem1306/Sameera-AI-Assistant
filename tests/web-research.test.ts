import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import type { AddressInfo } from 'node:net';
import { researchRoutes } from '../src/routes/research.ts';
import { ResearchTools } from '../src/services/tools/ResearchTools.ts';
import { TOOL_DECLARATIONS } from '../src/services/session/ModelTools.ts';
import { toolsForMode } from '../src/services/RuntimePolicy.ts';
import { ToolManager } from '../src/services/ToolManager.ts';

test('research returns source metadata and bounded actual text, and propagates blocked pages', async () => {
  const queries: unknown[] = [];
  const app = express(); app.use(express.json());
  app.use('/api', researchRoutes({
    search: async (query, distinct) => { queries.push([query, distinct]); return { topic: query, articles: [{ id: 'hotel', title: 'Example Hotel', website: 'example.com', url: 'https://example.com/hotel' }], provider: 'test' }; },
    read: async url => ({ success: !url.includes('blocked'), title: 'Example Hotel', sourceUrl: url, fullText: url.includes('empty') ? '' : 'Verified hotel details. '.repeat(1500), paragraphs: [], excerpt: '', wordCount: 3000, error: 'Page blocked' }),
  }));
  const server = app.listen(0, '127.0.0.1');
  try {
    await new Promise<void>((resolve, reject) => { server.once('listening', resolve); server.once('error', reject); });
    const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    const post = (route: string, body: unknown) => fetch(base + '/api/research/' + route, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    assert.equal((await post('search', { query: '' })).status, 400);
    const search = await (await post('search', { query: 'hotels in Hyderabad' })).json();
    assert.equal(search.sources[0].title, 'Example Hotel');
    assert.deepEqual(queries, [['hotels in Hyderabad', false]]);
    const page = await (await post('read', { url: search.sources[0].url })).json();
    assert.equal(page.sourceUrl, search.sources[0].url);
    assert.equal(page.text.length, 20000); assert.equal(page.truncated, true);
    assert.match(page.instruction, /untrusted/);
    assert.equal((await post('read', {})).status, 400);
    assert.equal((await post('read', { url: 'https://example.com/blocked' })).status, 502);
    assert.equal((await post('read', { url: 'https://example.com/empty' })).status, 502);
  } finally { await new Promise<void>(resolve => server.close(() => resolve())); }
});

test('research tools return page text and stop dependent writing when research fails', async () => {
  const originalFetch = globalThis.fetch;
  const requests: { url: string; body: any }[] = [];
  globalThis.fetch = async (input, init) => {
    requests.push({ url: String(input), body: JSON.parse(String(init?.body)) });
    return requests.length === 1 ? Response.json({ success: true, text: 'Verified hotel details', sourceUrl: 'https://example.com/hotel' }) : Response.json({ success: false, error: 'Page blocked' }, { status: 502 });
  };
  try {
    const tools = new ResearchTools();
    assert.equal((await tools.execute({ id: 'read', name: 'readWebpage', args: { url: 'https://example.com/hotel' } })).text, 'Verified hotel details');
    const failed = await tools.execute({ id: 'search', name: 'searchWebSources', args: { query: 'hotels' } });
    assert.equal(failed.needsClarification, true);
    assert.match(failed.instruction, /Stop dependent note-writing/);
    assert.deepEqual(requests.map(request => request.url), ['/api/research/read', '/api/research/search']);
    for (const desktop of [true, false]) {
      const names = toolsForMode(TOOL_DECLARATIONS, desktop).map(tool => tool.name);
      assert.ok(names.includes('readWebpage')); assert.ok(names.includes('searchWebSources'));
    }
  } finally { globalThis.fetch = originalFetch; }
});

test('failed research prevents an already queued Notepad action from executing', async () => {
  const originalFetch = globalThis.fetch;
  const urls: string[] = [];
  globalThis.fetch = async input => {
    urls.push(String(input));
    return Response.json({ success: false, error: 'Page blocked' }, { status: 502 });
  };
  try {
    const responses = await new ToolManager().executeToolCalls([
      { id: 'read-source', name: 'readWebpage', args: { url: 'https://example.com/hotel' } },
      { id: 'write-note', name: 'performSystemAction', args: { action: 'notepadDraft', text: 'Unverified hotel facts' } },
    ]);
    assert.equal(responses[0].response.output.needsClarification, true);
    assert.equal(responses[1].response.output.notExecuted, true);
    assert.deepEqual(urls, ['/api/research/read']);
  } finally { globalThis.fetch = originalFetch; }
});
