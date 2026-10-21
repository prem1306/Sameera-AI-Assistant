import { Router } from 'express';
import type { searchPublicLinks } from '../services/ArticleSearch.ts';

export function mediaRoutes(search: typeof searchPublicLinks) {
  const router = Router();
  router.post('/find-youtube-videos', async (req, res) => {
    const query = String(req.body?.query || '').trim();
    if (!query || query.length > 500) return res.status(400).json({ success: false, error: 'Provide the requested video title or topic.' });
    try {
      const result = await search(`site:youtube.com/watch ${query}`, false);
      const videos = result.articles.filter(source => {
        const url = new URL(source.url);
        return ['youtube.com', 'www.youtube.com', 'm.youtube.com'].includes(url.hostname) && url.pathname === '/watch' && /^[\w-]{11}$/.test(url.searchParams.get('v') || '');
      });
      res.json({ success: videos.length > 0, videos, message: videos.length ? 'Verified video candidates. Ask which one if ambiguous; do not open all results.' : 'No verified video link found. Ask for the video URL or a more specific title.' });
    } catch { res.status(502).json({ success: false, error: 'Video search is unavailable. Please provide the exact video URL.' }); }
  });
  return router;
}
