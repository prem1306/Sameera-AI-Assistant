import { Router } from 'express';
import type { searchArticles } from '../services/ArticleSearch.ts';
import type { scrapeArticleOrWebpage } from '../services/ArticleScraper.ts';

export function articleRoutes(dependencies: {
  search: typeof searchArticles;
  scrape: typeof scrapeArticleOrWebpage;
  apiKey: () => string | undefined;
}) {
  const router = Router();
  router.post('/search-articles', async (req, res) => {
    const topic = String(req.body?.topic || '').trim();
    if (!topic || topic.length > 500) return res.status(400).json({ success: false, error: 'Provide an article topic under 500 characters.' });
    const key = dependencies.apiKey();
    if (!key) return res.status(503).json({ success: false, error: 'Article search needs the server API key.' });
    try { res.json({ success: true, ...await dependencies.search(topic, key) }); }
    catch (error: any) { res.status(502).json({ success: false, error: error.message || 'Article search unavailable' }); }
  });
  router.all('/scrape-article', async (req, res) => {
    const targetUrl = String(req.query.url || req.body?.url || '').trim();
    if (!targetUrl) return res.status(400).json({ success: false, error: 'URL query parameter is required' });
    try { res.json(await dependencies.scrape(targetUrl)); }
    catch (error: any) {
      console.error('[API /api/scrape-article] Extraction failed');
      res.status(500).json({ success: false, error: error?.message || 'Failed to extract article content' });
    }
  });
  return router;
}
