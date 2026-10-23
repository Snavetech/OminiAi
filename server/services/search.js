// ============================================================================
// Snave AI — Web Search Service
// ============================================================================
// Free web search via DuckDuckGo HTML scraping (no API key required).
// Extracts search results and scrapes page content for deep research.
// ============================================================================

import fetch from 'node-fetch';

const DDG_URL = 'https://html.duckduckgo.com/html/';
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

/**
 * Search DuckDuckGo and return parsed results.
 * @param {string} query - Search query
 * @param {number} maxResults - Maximum results to return
 * @returns {Array<{title, url, snippet}>}
 */
export async function searchWeb(query, maxResults = 8) {
  try {
    const params = new URLSearchParams({ q: query, kl: 'us-en' });

    const response = await fetch(DDG_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': USER_AGENT
      },
      body: params.toString()
    });

    if (!response.ok) {
      throw new Error(`DuckDuckGo search failed: ${response.status}`);
    }

    const html = await response.text();
    return parseSearchResults(html, maxResults);
  } catch (error) {
    console.error('Search error:', error.message);
    return [];
  }
}

/**
 * Parse DuckDuckGo HTML search results page.
 */
function parseSearchResults(html, maxResults) {
  const results = [];

  // Match result blocks — DuckDuckGo HTML results use specific class patterns
  const resultRegex = /<a rel="nofollow" class="result__a" href="([^"]*)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<a class="result__snippet"[^>]*>([\s\S]*?)<\/a>/g;

  let match;
  while ((match = resultRegex.exec(html)) !== null && results.length < maxResults) {
    const url = decodeURIComponent(
      match[1].replace(/\/\/duckduckgo\.com\/l\/\?uddg=/, '').split('&')[0]
    );
    const title = match[2].replace(/<[^>]*>/g, '').trim();
    const snippet = match[3].replace(/<[^>]*>/g, '').trim();

    if (url && title && !url.includes('duckduckgo.com')) {
      results.push({ title, url, snippet });
    }
  }

  // Fallback: try simpler pattern if the above didn't match
  if (results.length === 0) {
    const simpleRegex = /<a[^>]*class="result__url"[^>]*href="([^"]*)"[^>]*>[\s\S]*?<\/a>[\s\S]*?<a[^>]*class="result__snippet"[^>]*>([\s\S]*?)<\/a>/g;
    while ((match = simpleRegex.exec(html)) !== null && results.length < maxResults) {
      const url = match[1].trim();
      const snippet = match[2].replace(/<[^>]*>/g, '').trim();
      if (url && snippet) {
        results.push({ title: url, url: url.startsWith('http') ? url : `https://${url}`, snippet });
      }
    }
  }

  return results;
}

/**
 * Scrape the text content of a webpage.
 * Returns cleaned text suitable for AI analysis.
 */
export async function scrapePageContent(url, maxLength = 5000) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000); // 10s timeout

    const response = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT },
      signal: controller.signal,
      redirect: 'follow'
    });

    clearTimeout(timeout);

    if (!response.ok) return '';

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('text/html') && !contentType.includes('text/plain')) {
      return '';
    }

    const html = await response.text();
    return extractTextFromHTML(html, maxLength);
  } catch (error) {
    // Silently fail — some sites block scraping
    return '';
  }
}

/**
 * Extract readable text from HTML, removing scripts, styles, nav, etc.
 */
function extractTextFromHTML(html, maxLength) {
  // Remove script and style tags and their content
  let text = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<nav[\s\S]*?<\/nav>/gi, '')
    .replace(/<header[\s\S]*?<\/header>/gi, '')
    .replace(/<footer[\s\S]*?<\/footer>/gi, '')
    .replace(/<aside[\s\S]*?<\/aside>/gi, '');

  // Convert common block elements to newlines
  text = text
    .replace(/<\/?(p|div|br|h[1-6]|li|tr)[^>]*>/gi, '\n')
    .replace(/<[^>]*>/g, '') // Remove all remaining tags
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n') // Collapse excess newlines
    .replace(/[ \t]+/g, ' ') // Collapse spaces
    .trim();

  return text.slice(0, maxLength);
}

/**
 * Perform deep research: search + scrape top results.
 * Returns an array of sources with content.
 */
export async function deepResearch(query, maxSources = 5) {
  // Step 1: Search
  const searchResults = await searchWeb(query, maxSources + 3);

  if (searchResults.length === 0) {
    return { sources: [], summary: 'No search results found.' };
  }

  // Step 2: Scrape top results in parallel
  const scrapingPromises = searchResults.slice(0, maxSources).map(async (result) => {
    const content = await scrapePageContent(result.url);
    return {
      ...result,
      content: content || result.snippet
    };
  });

  const sources = await Promise.all(scrapingPromises);

  // Filter out empty results
  const validSources = sources.filter(s => s.content && s.content.length > 50);

  return {
    sources: validSources,
    query
  };
}

export default {
  searchWeb,
  scrapePageContent,
  deepResearch
};
