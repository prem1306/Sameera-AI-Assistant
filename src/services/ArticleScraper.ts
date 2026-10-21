/**
 * ArticleScraper - Fetches articles, news, novels, and webpages server-side,
 * strips ads/scripts/navigation, and extracts clean readable text with semantic structure
 * for Sameera's voice reading and on-screen reader view.
 */

import * as cheerio from 'cheerio';
import { fetchPublicPage } from './PublicWeb.ts';

export interface ScrapedArticle {
  success: boolean;
  title: string;
  sourceUrl: string;
  paragraphs: string[];
  fullText: string;
  excerpt: string;
  wordCount: number;
  error?: string;
}

export async function scrapeArticleOrWebpage(targetUrl: string): Promise<ScrapedArticle> {
  let url = targetUrl.trim();
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    url = `https://${url}`;
  }

  try {
    const res = await fetchPublicPage(url);

    if (!res.ok) {
      throw new Error(`Failed to fetch webpage (Status: ${res.status} ${res.statusText})`);
    }
    if (res.headers.get('content-type')?.includes('application/pdf')) {
      throw new Error('This source is a PDF. Choose its HTML/full-text version or provide the relevant passage.');
    }

    const html = await res.text();
    const $ = cheerio.load(html);

    // Remove scripts, styles, navigations, ads, headers, footers
    $('script, style, nav, footer, header, aside, noscript, iframe, svg, [role="navigation"], .advertisement, .nav, .sidebar, .menu, .cookie-banner').remove();

    // Extract title
    let title = $('h1').first().text().trim() ||
      $('meta[property="og:title"]').attr('content')?.trim() ||
      $('title').text().trim() ||
      'Article';

    // Clean up title if it contains site suffix e.g. "Title - Wikipedia"
    title = title.replace(/\s*[-–|]\s*(Wikipedia|Medium|Substack|The Verge|BBC|CNN).*$/i, '').trim();

    // Extract content paragraphs
    const paragraphs: string[] = [];

    // Target article container or main with support for blogs, wikis, and novel sites
    const container = $('article, main, .mw-parser-output, .entry-content, .post-content, .story-content, .article-body, .reading-content, .chapter-content, .chapter-body, .novel-content, .text-content, #chapter-content, #article-content, body');

    container.find('p, h2, h3, blockquote').each((_, el) => {
      const tag = el.tagName?.toLowerCase();
      const text = $(el).text().replace(/\s+/g, ' ').trim();

      if (tag === 'h2' || tag === 'h3') {
        if (text.length > 3 && text.length < 100) {
          paragraphs.push(`## ${text}`);
        }
      } else if (text.length > 15) {
        // Skip common web boilerplate
        const lower = text.toLowerCase();
        if (
          !lower.includes('subscribe') &&
          !lower.includes('cookie policy') &&
          !lower.includes('all rights reserved') &&
          !lower.includes('terms of service') &&
          !lower.includes('privacy policy')
        ) {
          paragraphs.push(text);
        }
      }
    });

    if (paragraphs.length === 0) {
      // Fallback: extract general text blocks
      const rawText = $('body').text().replace(/\s+/g, ' ').trim();
      const chunks = rawText.match(/.{1,300}(\.|\?|\!|$)/g) || [rawText.slice(0, 1500)];
      paragraphs.push(...chunks.slice(0, 20));
    }

    const fullText = paragraphs.join('\n\n');
    const wordCount = fullText.split(/\s+/).filter(Boolean).length;
    const excerpt = paragraphs.slice(0, 4).join('\n\n').slice(0, 800);

    return {
      success: true,
      title: title || 'Readable Web Content',
      sourceUrl: res.url,
      paragraphs,
      fullText,
      excerpt,
      wordCount,
    };
  } catch (err: any) {
    console.error('[ArticleScraper] Extraction failed');
    return {
      success: false,
      title: 'Could not load article',
      sourceUrl: url,
      paragraphs: [],
      fullText: '',
      excerpt: '',
      wordCount: 0,
      error: err?.name === 'AbortError' ? 'Webpage request timed out' : (err.message || 'Error fetching article'),
    };
  }
}
