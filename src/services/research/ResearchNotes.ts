import { searchPublicLinks } from '../ArticleSearch.ts';
import { scrapeArticleOrWebpage } from '../ArticleScraper.ts';
import { containsSecrets } from '../privacy/PrivacyService.ts';

export type ResearchDependencies = { search: typeof searchPublicLinks; read: typeof scrapeArticleOrWebpage };
/** Public source excerpts, kept locally. No model call or browser permission required. */
export async function researchNotes(query: string, signal: AbortSignal, dependencies: ResearchDependencies = { search: searchPublicLinks, read: scrapeArticleOrWebpage }) {
  signal.throwIfAborted();
  let search;
  try { search = await dependencies.search(query, false); }
  catch { return { success: false as const, code: 'PUBLIC_SEARCH_FAILED', error: 'Public search failed. Try again or provide a public source URL; Chrome page access is not required for this search.' }; }
  signal.throwIfAborted();
  const sources: { title: string; url: string; excerpt: string }[] = [];
  let failedSources = 0;
  for (const candidate of search.articles.slice(0, 5)) {
    signal.throwIfAborted();
    if (sources.length >= 3) break;
    try {
      const url = new URL(candidate.url);
      if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || containsSecrets(url.href)) { failedSources++; continue; }
      const page = await dependencies.read(url.href);
      signal.throwIfAborted();
      const content = page.fullText.trim();
      if (!page.success || content.length < 100 || /(?:verify (?:that )?you are human|access denied|just a moment|enable javascript|captcha)/i.test(content.slice(0, 1500)) || containsSecrets(content) || containsSecrets(page.sourceUrl)) { failedSources++; continue; }
      sources.push({ title: page.title.slice(0, 300), url: page.sourceUrl, excerpt: page.fullText.slice(0, 8000) });
    } catch { signal.throwIfAborted(); failedSources++; }
  }
  if (!sources.length) return { success: false as const, code: 'PUBLIC_PAGES_UNREADABLE', error: 'Search returned links, but no source page provided readable public text. No Notepad note was created. Pages may require JavaScript, login or permission; try a different public source or connect Chrome for rendered reading.' };
  const text = [`Research: ${query}`, `Retrieved: ${new Date().toISOString()}`, 'Public source excerpts, not a ranked recommendation or a verified booking quote. Prices and availability require dates and a current check.', ...sources.map((source, index) => `\n${index + 1}. ${source.title}\nSource: ${source.url}\nPage excerpt (up to 8,000 characters):\n${source.excerpt}`), ...(failedSources ? [`\n${failedSources} source(s) could not be read and were omitted.`] : [])].join('\n\n');
  return { success: true as const, text, sourceCount: sources.length, failedSources };
}
