import test from 'node:test';
import assert from 'node:assert/strict';
import { ArticleContext } from '../src/services/ArticleContext.ts';
import { ToolManager } from '../src/services/ToolManager.ts';

test('questions retrieve the visible or selected paragraph beyond the old 60-paragraph limit', () => {
  const context = new ArticleContext();
  assert.equal(context.read().success, false);
  context.open({ isOpen: true, title: 'A journal article', content: '', paragraphs: Array.from({ length: 100 }, (_, i) => `Text from paragraph ${i + 1}`), url: 'https://example.com/paper', isReadingAloud: false, wordCount: 500 });
  context.focus(85, 'Selected source passage');
  const visible = context.read();
  assert.equal(visible.paragraphs[0].number, 85);
  assert.equal(visible.selectedText, 'Selected source passage');
  assert.equal(context.read(3, 1).paragraphs[0].text, 'Text from paragraph 3');
  assert.equal(context.read(95, 12).hasMore, false);
  context.close();
  assert.equal(context.read().success, false);
});

test('search asks for a topic, displays sources, waits for selection and opens one reader without tabs', async () => {
  const previousFetch = globalThis.fetch;
  let requests = 0;
  let readers = 0;
  let listShown = false;
  const tools = new ToolManager();
  tools.setCallbacks({ onArticleSearch: (list) => { listShown = !!list; }, onArticleReader: () => { readers++; } });
  globalThis.fetch = (async (url: string) => {
    requests++;
    if (url === '/api/search-articles') return Response.json({ success: true, topic: 'Space', articles: [{ id: 'article-1', title: 'Space research', url: 'https://example.com/article', website: 'example.com' }] });
    return Response.json({ success: true, title: 'Space research', fullText: 'Actual article text', paragraphs: ['Actual article text'], sourceUrl: 'https://example.com/article', wordCount: 3 });
  }) as typeof fetch;
  const call = async (name: string, args: any) => (await tools.executeToolCalls([{ id: crypto.randomUUID(), name, args }]))[0].response.output;
  try {
    assert.equal((await call('searchArticles', {})).success, false);
    assert.equal(requests, 0);
    assert.equal((await call('searchArticles', { topic: 'Space' })).success, true);
    assert.equal(listShown, true);
    assert.equal(readers, 0);
    assert.equal((await call('searchWeb', { query: 'Space articles' })).success, false);
    assert.equal((await call('openWebsite', { url: 'https://example.com/article' })).success, false);
    assert.equal((await call('chooseArticle', {})).success, false);
    assert.equal((await call('readArticleOrWebpage', { url: 'https://example.com/article' })).success, false);
    assert.equal(readers, 0);
    assert.equal((await call('chooseArticle', { articleId: 'article-1' })).success, true);
    assert.equal(readers, 1);
    assert.equal(listShown, false);
    assert.equal((await call('getCurrentArticle', {})).paragraphs[0].text, 'Actual article text');
  } finally { globalThis.fetch = previousFetch; }
});

test('explicit delegation picks one result, while extraction failure leaves the user a choice', async () => {
  const previousFetch = globalThis.fetch;
  const tools = new ToolManager();
  let mediaOpened = 0;
  tools.setCallbacks({ onMediaOpen: () => mediaOpened++ });
  globalThis.fetch = (async (url: string) => Response.json(url === '/api/search-articles'
    ? { success: true, articles: [{ id: 'first', url: 'https://example.com/blocked', title: 'Blocked source', website: 'example.com' }] }
    : { success: false, error: 'Paywalled' })) as typeof fetch;
  try {
    await tools.executeToolCalls([{ id: 'search', name: 'searchArticles', args: { topic: 'Research' } }]);
    const [selected] = await tools.executeToolCalls([{ id: 'choose', name: 'chooseArticle', args: { chooseForMe: true } }]);
    assert.equal(selected.response.output.success, false);
    assert.match(selected.response.output.message, /choose another source/);
    assert.equal(mediaOpened, 0);
  } finally { globalThis.fetch = previousFetch; }
});
