import type { ToolExecutionEvent } from '../../types/assistant';
import type { ToolCallPayload, ToolEffects } from './types.ts';

export class BrowserTools {
  constructor(private readonly effects: ToolEffects) {}

  async execute(call: ToolCallPayload): Promise<Record<string, any>> {
    switch (call.name) {
      case 'findYouTubeVideos': {
        const response = await fetch('/api/find-youtube-videos', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query: call.args.query }), signal: AbortSignal.timeout(15000) });
        return response.json();
      }
      case 'openWebsite': {
        let url = String(call.args.url || '').trim();
        const label = String(call.args.label || url);
        if (!url.startsWith('http://') && !url.startsWith('https://')) {
          url = `https://${url}`;
        }

        const isYouTube = url.includes('youtube.com') || url.includes('youtu.be');
        let embedUrl = url;
        if (isYouTube) {
          const videoIdMatch = url.match(/(?:v=|\/embed\/|youtu\.be\/|\/v\/|\/shorts\/)([a-zA-Z0-9_-]{11})/);
          if (videoIdMatch && videoIdMatch[1]) {
            embedUrl = `https://www.youtube-nocookie.com/embed/${videoIdMatch[1]}?autoplay=1`;
          }
        }

        // Try opening in new window/tab
        let opened = false;
        try {
          const win = window.open(url, '_blank', 'noopener,noreferrer');
          opened = Boolean(win);
        } catch (e) {
          opened = false;
        }

        // Always pop up the in-app interactive stage so the user is never left with dead links!
        this.effects.callbacks().onMediaOpen?.({
          isOpen: true,
          type: isYouTube ? 'youtube' : 'website',
          title: label || (isYouTube ? 'YouTube' : 'Web Page'),
          url,
          embedUrl,
        });

        const event: ToolExecutionEvent = {
          id: Math.random().toString(36).slice(2, 9),
          name: 'openWebsite',
          title: `Open ${label}`,
          description: opened ? `Opened ${url}` : `Active on screen: ${url}`,
          url,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          status: 'success',
        };

        this.effects.recordEvent(event);

        return {
          success: true,
          opened,
          url,
          label,
          message: `Opened ${label} (${url}) on the user's screen in their browser stage.`,
        };
      }

      case 'openYouTube': {
        const rawQuery = String(call.args.query || call.args.url || '').trim();
        const rawVideoId = String(call.args.videoId || '').trim();
        const label = String(call.args.title || rawQuery || 'YouTube Video');

        let targetUrl = '';
        let embedUrl = '';
        let detectedVideoId = rawVideoId;

        // Check if query is already a full YouTube link
        if (rawQuery.includes('youtube.com') || rawQuery.includes('youtu.be')) {
          targetUrl = rawQuery.startsWith('http') ? rawQuery : `https://${rawQuery}`;
          const idMatch = targetUrl.match(/(?:v=|\/embed\/|youtu\.be\/|\/v\/|\/shorts\/)([a-zA-Z0-9_-]{11})/);
          if (idMatch && idMatch[1]) {
            detectedVideoId = idMatch[1];
          }
        }

        if (detectedVideoId) {
          targetUrl = `https://www.youtube.com/watch?v=${detectedVideoId}`;
          embedUrl = `https://www.youtube-nocookie.com/embed/${detectedVideoId}?autoplay=1`;
        } else if (!targetUrl) {
          targetUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(rawQuery)}`;
          embedUrl = `https://www.youtube.com/embed?listType=search&list=${encodeURIComponent(rawQuery)}`;
        }

        // Attempt direct open in tab
        let opened = false;
        try {
          const win = window.open(targetUrl, '_blank', 'noopener,noreferrer');
          opened = Boolean(win);
        } catch (e) {
          opened = false;
        }

        // Pop up in-app YouTube player / stage
        this.effects.callbacks().onMediaOpen?.({
          isOpen: true,
          type: 'youtube',
          title: label,
          url: targetUrl,
          embedUrl,
        });

        const event: ToolExecutionEvent = {
          id: Math.random().toString(36).slice(2, 9),
          name: 'openYouTube',
          title: `YouTube: "${label}"`,
          description: opened ? `Opened YouTube: ${label}` : `YouTube player active: ${label}`,
          url: targetUrl,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          status: 'success',
        };
        this.effects.recordEvent(event);

        return {
          success: true,
          opened,
          url: targetUrl,
          query: rawQuery,
          message: `Opened "${label}" on YouTube for the user with an interactive player on screen.`,
        };
      }

      case 'searchWeb': {
        const query = String(call.args.query || '').trim();
        const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
        let opened = false;
        try {
          const win = window.open(searchUrl, '_blank', 'noopener,noreferrer');
          opened = Boolean(win);
        } catch (e) {
          opened = false;
        }

        const event: ToolExecutionEvent = {
          id: Math.random().toString(36).slice(2, 9),
          name: 'searchWeb',
          title: `Search: "${query}"`,
          description: `Searched Google for ${query}`,
          url: searchUrl,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          status: 'success',
        };
        this.effects.recordEvent(event);

        return {
          success: true,
          query,
          url: searchUrl,
          opened,
          message: `Initiated Google search for "${query}"`,
        };
      }

      default: return { error: `Unknown function ${call.name}` };
    }
  }
}
