import { z } from "zod";
import { JSDOM } from "jsdom";
import { Adapter, Tool } from "./adapter.js";

const BASE = "http://127.0.0.1:8888";

type SearxResult = {
  title?: string;
  url?: string;
  content?: string;
  engine?: string;
  category?: string;
};

type SearxResponse = {
  results?: SearxResult[];
  unresponsive_engines?: string[];
  query?: string;
};

async function fetchJson<T>(url: string, controller: AbortController): Promise<T | null> {
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) {
      console.error(`SearXNG HTTP ${res.status}: ${await res.text()}`);
      return null;
    }
    return (await res.json()) as T;
  } catch (err) {
    console.error("SearXNG fetch failed", err);
    return null;
  }
}

async function scrapeUrl(url: string): Promise<any> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    
    const response = await fetch(url, { 
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });
    
    clearTimeout(timeout);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const html = await response.text();
    const dom = new JSDOM(html);
    const document = dom.window.document;
    
    // Remove script and style elements
    document.querySelectorAll('script, style, nav, header, footer, aside, .ad, .advertisement, .sidebar').forEach(el => el.remove());
    
    // Extract main content
    const title = document.querySelector('title')?.textContent?.trim() || '';
    const metaDescription = document.querySelector('meta[name="description"]')?.getAttribute('content')?.trim() || '';
    
    // Try to find main content areas
    const mainContent = document.querySelector('main, article, .content, .post-content, .entry-content, #content') ||
                        document.querySelector('div[class*="content"], div[class*="article"], div[class*="post"]');
    
    let content = '';
    if (mainContent) {
      content = mainContent.textContent?.trim() || '';
    } else {
      // Fallback to body content
      content = document.body?.textContent?.trim() || '';
    }
    
    // Clean up content
    content = content
      .replace(/\s+/g, ' ')
      .replace(/\n\s*\n/g, '\n')
      .trim();
    
    // Extract structured data
    const headings = Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6')).map(h => ({
      level: parseInt(h.tagName.charAt(1)),
      text: h.textContent?.trim() || ''
    }));
    
    const links = Array.from(document.querySelectorAll('a[href]')).slice(0, 20).map(a => ({
      text: a.textContent?.trim() || '',
      href: a.getAttribute('href') || ''
    }));
    
    const images = Array.from(document.querySelectorAll('img[src]')).slice(0, 10).map(img => ({
      src: img.getAttribute('src') || '',
      alt: img.getAttribute('alt') || '',
      title: img.getAttribute('title') || ''
    }));
    
    return {
      url,
      title,
      metaDescription,
      content: content.substring(0, 5000), // Limit content length
      headings,
      links,
      images,
      wordCount: content.split(/\s+/).length,
      scrapedAt: new Date().toISOString()
    };
    
  } catch (error) {
    return {
      url,
      error: error instanceof Error ? error.message : 'Unknown error',
      scrapedAt: new Date().toISOString()
    };
  }
}

// Web Search Tools
const getLinksTool: Tool = {
  name: "get_links",
  description: "Search SearXNG and return up to 6 links",
  schema: {
    query: z.string().min(1).describe("Search query"),
    categories: z.string().optional().describe("Comma-separated categories (default general,web)")
  },
  handler: async ({ query, categories }) => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const params = new URLSearchParams({
      q: query,
      format: "json",
      categories: categories || "general,web",
      engines: "bing,duckduckgo,brave",
    });

    const url = `${BASE}/search?${params.toString()}`;
    const data = await fetchJson<SearxResponse>(url, controller);
    clearTimeout(timeout);

    if (!data || !data.results) {
      return {
        content: [
          {
            type: "text" as const,
            text: `No results found for "${query}"`,
          },
        ],
      };
    }

    const results = data.results.slice(0, 6).map((r) => ({
      title: r.title,
      url: r.url,
      content: r.content,
      engine: r.engine,
    }));

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(results, null, 2),
        },
      ],
    };
  }
};

const scrapeLinksTool: Tool = {
  name: "scrape_links",
  description: "Scrape multiple URLs and return clean, structured content",
  schema: {
    links: z.array(z.string().url()).describe("Array of URLs to scrape")
  },
  handler: async ({ links }) => {
    const results = await Promise.all(
      links.map(async (url: string) => {
        const result = await scrapeUrl(url);
        return {
          type: "text" as const,
          text: JSON.stringify(result, null, 2)
        };
      })
    );
    
    return {
      content: results
    };
  }
};

export { fetchJson, scrapeUrl };

export const webSearchAdapter: Adapter = {
  name: "web-search",
  description: "Web search and content scraping tools using SearXNG",
  tools: [getLinksTool, scrapeLinksTool]
};
