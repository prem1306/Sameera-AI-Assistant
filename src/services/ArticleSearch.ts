import { GoogleGenAI } from '@google/genai';
import type { ArticleSearchState } from '../types/assistant';
import * as cheerio from 'cheerio';

export async function searchPublicLinks(topic: string, distinctWebsites = true): Promise<ArticleSearchState> {
  const response = await fetch(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(topic)}`, {
    signal: AbortSignal.timeout(12000), headers: { 'User-Agent': 'SameeraArticleReader/1.0', Accept: 'text/html' },
  });
  if (!response.ok) throw new Error('Article search is temporarily unavailable. Provide an article URL or try again later.');
  const $ = cheerio.load(await response.text());
  const sources: ArticleSearchState['articles'] = [];
  const seen = new Set<string>();
  $('.result__a').each((_, item) => {
    try {
      const link = new URL($(item).attr('href') || '', 'https://duckduckgo.com');
      const url = link.searchParams.get('uddg') || link.href;
      const parsed = new URL(url);
      const key = distinctWebsites ? parsed.hostname : url;
      if (!['https:', 'http:'].includes(parsed.protocol) || seen.has(key)) return;
      seen.add(key);
      if (parsed.hostname.endsWith('duckduckgo.com') || parsed.pathname === '/') return;
      sources.push({ id: `article-${sources.length + 1}`, url, website: parsed.hostname.replace(/^www\./, ''), title: $(item).text().trim() || parsed.hostname });
    } catch { /* Ignore malformed search entries. */ }
  });
  if (!sources.length) throw new Error('No article sources found. Try a more specific topic or provide a URL.');
  return { topic, articles: sources.slice(0, 5), provider: 'DuckDuckGo' };
}

export async function searchPublicArticles(topic: string): Promise<ArticleSearchState> {
  return { ...await searchPublicLinks(topic + ' articles'), topic };
}

export async function searchArticles(topic: string, apiKey: string): Promise<ArticleSearchState> {
  const ai = new GoogleGenAI({ apiKey });
  let response;
  try { response = await ai.models.generateContent({
    model: 'gemini-3.8-flash',
    contents: `Find 5 readable, publicly accessible articles or journal papers about this topic: ${JSON.stringify(topic)}. Use Google Search. Prefer distinct reputable publishers, universities, research institutions and original sources. Find specific article pages, not homepages, search pages, or videos. Do not invent URLs. Do not choose for the user.`,
    config: { tools: [{ googleSearch: {} }], httpOptions: { timeout: 25000 } },
  }); } catch { return searchPublicArticles(topic); }
  const metadata = response.candidates?.[0]?.groundingMetadata;
  const sources = metadata?.groundingChunks?.flatMap((chunk) => chunk.web?.uri ? [chunk.web] : []) || [];
  const unique = [...new Map(sources.map((source) => [source.uri!, source])).values()].slice(0, 8);
  const resolved = await Promise.all(unique.map(async (source, index) => {
    let url = source.uri!;
    // Grounded results may be Google redirect URLs. Resolve their publisher address.
    if (new URL(url).hostname.endsWith('cloud.google.com')) {
      try {
        const result = await fetch(url, { method: 'HEAD', signal: AbortSignal.timeout(6000) });
        url = result.url;
      } catch { /* Preserve the grounded source when resolution is unavailable. */ }
    }
    const parsed = new URL(url);
    if (!['http:', 'https:'].includes(parsed.protocol)) return null;
    return { id: `article-${index + 1}`, title: source.title || parsed.hostname, url, website: parsed.hostname.replace(/^www\./, '') };
  }));
  const articles = resolved.filter((article): article is NonNullable<typeof article> => article !== null).slice(0, 5);
  if (!articles.length) return searchPublicArticles(topic);
  return { topic, articles, provider: 'Google Search', searchSuggestionsHtml: metadata?.searchEntryPoint?.renderedContent };
}
