import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import express, { Request, Response } from "express";
import getRawBody from "raw-body";
import { randomUUID } from "crypto";
import { z } from "zod";
import { JSDOM } from "jsdom";
import { fetchTranscript } from "@egoist/youtube-transcript-plus";

const BASE = "http://127.0.0.1:8888";
const DEFAULT_CATEGORIES = "general,web";
const MAX_RESULTS = 6;

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

const server = new McpServer({
  name: "websearch",
  version: "0.1.0",
});

// Scraping tool
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

const scrapeLinksSchema = {
  links: z.array(z.string().url()).describe("Array of URLs to scrape"),
};

server.tool(
  "scrape_links",
  "Scrape multiple URLs and return clean, structured content",
  scrapeLinksSchema,
  async ({ links }) => {
    const results = await Promise.all(
      links.map(async (url) => {
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
  },
);

// Enhanced X/Twitter search and scrape tool
const xSearchSchema = {
  query: z.string().min(1).describe("Person name or username to search on X/Twitter"),
  scrape_profiles: z.boolean().default(true).describe("Whether to scrape profile details"),
  max_profiles: z.number().min(1).max(10).default(5).describe("Maximum profiles to find and scrape"),
};

server.tool(
  "x_search",
  "Search X/Twitter for people, scrape profiles, and return normalized data",
  xSearchSchema,
  async ({ query, scrape_profiles, max_profiles }) => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    // Step 1: Search for profiles
    const params = new URLSearchParams({
      q: query + " twitter.com OR x.com",
      format: "json",
      categories: "general,web",
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
            text: `No X/Twitter results found for "${query}"`,
          },
        ],
      };
    }

    // Step 2: Extract profile URLs
    const profileResults = (data.results || [])
      .filter((r) => {
        const url = (r.url || "").toLowerCase();
        const isProfile = url.includes("twitter.com/") || url.includes("x.com/");
        const isNotPost = !url.includes("/status/");
        return isProfile && isNotPost;
      })
      .slice(0, max_profiles)
      .map((r) => ({
        url: r.url,
        engine: r.engine,
        title: r.title,
        content: r.content,
      }));

    if (profileResults.length === 0) {
      return {
        content: [
          {
            type: "text" as const,
            text: `No X/Twitter profiles found for "${query}"`,
          },
        ],
      };
    }

    // Step 3: Scrape profiles if requested
    let scrapedProfiles: any[] = [];
    if (scrape_profiles) {
      scrapedProfiles = await Promise.all(
        profileResults.map(async (profile) => {
          try {
            const scraped = await scrapeUrl(profile.url || "");
            return {
              url: profile.url,
              engine: profile.engine,
              scraped: scraped,
            };
          } catch (error) {
            return {
              url: profile.url,
              engine: profile.engine,
              error: error instanceof Error ? error.message : "Scraping failed",
            };
          }
        })
      );
    }

    // Step 4: Normalize and structure the output
    const normalizedProfiles = scrapedProfiles.map((profile) => {
      const scraped = profile.scraped;
      if (scraped.error) {
        return {
          username: extractUsername(profile.url),
          profile_url: profile.url,
          status: "failed",
          error: scraped.error,
        };
      }

      // Extract key information from scraped content
      const content = scraped.content || "";
      const title = scraped.title || "";
      
      // Try to extract follower count, following count, bio, etc.
      const followersMatch = content.match(/(\d+(?:\.\d+)?[KM]?)\s*(?:followers|following)/gi);
      const bioMatch = content.match(/(?:bio|about|description)[:\s]*([^.!?]+)/i);
      
      return {
        username: extractUsername(profile.url),
        display_name: title.replace(/on X.*$/i, "").replace(/Twitter.*$/i, "").trim(),
        profile_url: profile.url,
        bio: bioMatch ? bioMatch[1].trim() : "",
        followers: extractNumber(followersMatch?.[0] || ""),
        verified: content.includes("verified") || content.includes("blue check"),
        status: "success",
        last_scraped: scraped.scrapedAt,
      };
    });

    // Step 5: Create final structured output
    const output = {
      query: query,
      search_summary: {
        total_profiles_found: profileResults.length,
        successfully_scraped: normalizedProfiles.filter(p => p.status === "success").length,
        failed_scrapes: normalizedProfiles.filter(p => p.status === "failed").length,
      },
      normalized_profiles: normalizedProfiles,
      unresponsive_engines: data.unresponsive_engines || [],
    };

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(output, null, 2),
        },
      ],
    };
  },
);

// Instagram optimized search and scrape tool
const instaSearchScrapeSchema = {
  query: z.string().min(1).describe("Person name or username to search on Instagram"),
  max_profiles: z.number().min(1).max(5).default(2).describe("Maximum profiles to find and scrape"),
};

server.tool(
  "insta_search_scrape",
  "Search Instagram, get top profiles, and scrape with flexible DOM handling",
  instaSearchScrapeSchema,
  async ({ query, max_profiles }) => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    // Step 1: Search for profiles
    const params = new URLSearchParams({
      q: query + " instagram.com",
      format: "json",
      categories: "general,web",
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
            text: `No Instagram results found for "${query}"`,
          },
        ],
      };
    }

    // Step 2: Extract profile URLs
    const profileResults = (data.results || [])
      .filter((r) => {
        const url = (r.url || "").toLowerCase();
        const isProfile = url.includes("instagram.com/");
        const isNotPost = !url.includes("/p/") && !url.includes("/reel/") && !url.includes("/tv/") && !url.includes("/accounts/");
        return isProfile && isNotPost;
      })
      .slice(0, max_profiles)
      .map((r) => ({
        url: r.url,
        engine: r.engine,
        title: r.title,
        content: r.content,
      }));

    if (profileResults.length === 0) {
      return {
        content: [
          {
            type: "text" as const,
            text: `No Instagram profiles found for "${query}"`,
          },
        ],
      };
    }

    // Step 3: Scrape profiles with Instagram-optimized extraction
    const scrapedProfiles = await Promise.all(
      profileResults.map(async (profile) => {
        try {
          const scraped = await scrapeInstaProfile(profile.url || "");
          return {
            url: profile.url,
            engine: profile.engine,
            scraped: scraped,
          };
        } catch (error) {
          return {
            url: profile.url,
            engine: profile.engine,
            error: error instanceof Error ? error.message : "Scraping failed",
          };
        }
      })
    );

    // Step 4: Create final structured output
    const output = {
      query: query,
      platform: "Instagram",
      search_summary: {
        total_profiles_found: profileResults.length,
        successfully_scraped: scrapedProfiles.filter(p => !p.error).length,
        failed_scrapes: scrapedProfiles.filter(p => p.error).length,
      },
      profiles: scrapedProfiles.map(p => p.scraped || {
        profile_url: p.url,
        status: "failed",
        error: p.error,
      }),
      unresponsive_engines: data.unresponsive_engines || [],
    };

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(output, null, 2),
        },
      ],
    };
  },
);

// Instagram-optimized profile scraper
async function scrapeInstaProfile(url: string): Promise<any> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    
    const response = await fetch(url, { 
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1'
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
    
    // Extract basic info with multiple selectors for flexibility
    const title = document.querySelector('title')?.textContent?.trim() || '';
    const metaDescription = document.querySelector('meta[name="description"]')?.getAttribute('content')?.trim() || '';
    
    // Flexible username extraction
    const usernamePatterns = [
      () => url.match(/instagram\.com\/([^\/\?]+)/)?.[1] || '',
      () => document.querySelector('meta[property="og:url"]')?.getAttribute('content')?.match(/instagram\.com\/([^\/\?]+)/)?.[1] || '',
      () => document.querySelector('[data-username]')?.getAttribute('data-username') || '',
    ];
    const username = usernamePatterns.find(pattern => pattern())?.() || '';
    
    // Flexible display name extraction
    const displayNamePatterns = [
      () => title.split('•')[0]?.replace('on Instagram', '').replace('Instagram', '').trim() || '',
      () => document.querySelector('h1')?.textContent?.trim() || '',
      () => document.querySelector('[data-testid="username"]')?.textContent?.trim() || '',
    ];
    const displayName = displayNamePatterns.find(pattern => pattern())?.() || username;
    
    // Flexible bio extraction
    const bioPatterns = [
      () => metaDescription.match(/(.+?)\s*\d+\s*(?:followers|posts|photos)/i)?.[1]?.trim() || '',
      () => document.querySelector('[data-testid="user-description"]')?.textContent?.trim() || '',
      () => document.querySelector('.-qQT3')?.textContent?.trim() || '',
      () => document.querySelector('div[data-visualcompletion="ignore-dynamic"]')?.textContent?.trim() || '',
    ];
    const bio = bioPatterns.find(pattern => pattern())?.() || '';
    
    // Flexible stats extraction (followers, following, posts)
    const content = document.body?.textContent || '';
    const statsPatterns = [
      /(\d+(?:\.\d+)?[KM]?)\s*(?:followers|follower)/gi,
      /(\d+(?:\.\d+)?[KM]?)\s*(?:following|follows)/gi,
      /(\d+(?:\.\d+)?[KM]?)\s*(?:posts|post|photos|photo)/gi,
    ];
    
    const followersMatch = content.match(statsPatterns[0]);
    const followingMatch = content.match(statsPatterns[1]);
    const postsMatch = content.match(statsPatterns[2]);
    
    // Flexible verification check
    const verificationPatterns = [
      () => content.includes('verified') || content.includes('blue check'),
      () => !!document.querySelector('[data-testid="verified-badge"]'),
      () => !!document.querySelector('.coreSpriteVerifiedBadge'),
      () => !!document.querySelector('.verified'),
    ];
    const verified = verificationPatterns.some(pattern => pattern());
    
    // Extract additional metadata
    const externalUrl = document.querySelector('meta[property="og:url"]')?.getAttribute('content') || url;
    const image = document.querySelector('meta[property="og:image"]')?.getAttribute('content') || '';
    
    // Extract and return only populated fields
    const result: any = {
      username,
      profile_url: url,
      status: "success",
      scraped_at: new Date().toISOString(),
    };
    
    // Only add fields that have values
    if (displayName && displayName !== username) result.display_name = displayName;
    if (bio) result.bio = bio;
    if (extractNumber(followersMatch?.[0] || '')) result.followers = extractNumber(followersMatch?.[0] || '');
    if (extractNumber(followingMatch?.[0] || '')) result.following = extractNumber(followingMatch?.[0] || '');
    if (extractNumber(postsMatch?.[0] || '')) result.posts = extractNumber(postsMatch?.[0] || '');
    if (verified) result.verified = verified;
    if (image) result.profile_image = image;
    if (externalUrl && externalUrl !== url) result.external_url = externalUrl;
    
    return result;
    
  } catch (error) {
    return {
      profile_url: url,
      status: "failed",
      error: error instanceof Error ? error.message : "Unknown error",
      scraped_at: new Date().toISOString(),
    };
  }
}

// Adult content search and scrape tool
const adultSearchSchema = {
  query: z.string().min(1).describe("Search query for adult content"),
  max_results: z.number().min(1).max(10).default(5).describe("Maximum results to find and scrape"),
  content_type: z.enum(["videos", "images", "profiles", "all"]).default("all").describe("Type of content to search for"),
};

server.tool(
  "adult_search",
  "Search adult content safely with flexible DOM handling",
  adultSearchSchema,
  async ({ query, max_results, content_type }) => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    // Step 1: Search with adult content filters
    let searchQuery = query;
    if (content_type === "videos") searchQuery += " videos porn";
    else if (content_type === "images") searchQuery += " images porn";
    else if (content_type === "profiles") searchQuery += " profiles porn";
    else searchQuery += " porn";

    const params = new URLSearchParams({
      q: searchQuery,
      format: "json",
      categories: "general,web",
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
            text: `No adult content results found for "${query}"`,
          },
        ],
      };
    }

    // Step 2: Filter and extract adult content URLs
    const contentResults = (data.results || [])
      .filter((r) => {
        const url = (r.url || "").toLowerCase();
        const title = (r.title || "").toLowerCase();
        const content = (r.content || "").toLowerCase();
        
        // Basic adult content detection
        const adultKeywords = ["porn", "xxx", "adult", "sex", "nsfw"];
        const hasAdultKeywords = adultKeywords.some(keyword => 
          url.includes(keyword) || title.includes(keyword) || content.includes(keyword)
        );
        
        return hasAdultKeywords;
      })
      .slice(0, max_results)
      .map((r) => ({
        url: r.url,
        engine: r.engine,
        title: r.title,
        content: r.content,
      }));

    if (contentResults.length === 0) {
      return {
        content: [
          {
            type: "text" as const,
            text: `No adult content found for "${query}"`,
          },
        ],
      };
    }

    // Step 3: Scrape content with adult-optimized extraction
    const scrapedContent = await Promise.all(
      contentResults.map(async (content) => {
        try {
          const scraped = await scrapeAdultContent(content.url || "");
          return {
            url: content.url,
            engine: content.engine,
            scraped: scraped,
          };
        } catch (error) {
          return {
            url: content.url,
            engine: content.engine,
            error: error instanceof Error ? error.message : "Scraping failed",
          };
        }
      })
    );

    // Step 4: Create final structured output
    const output = {
      query: query,
      content_type: content_type,
      platform: "Adult Content",
      search_summary: {
        total_results_found: contentResults.length,
        successfully_scraped: scrapedContent.filter(p => !p.error).length,
        failed_scrapes: scrapedContent.filter(p => p.error).length,
      },
      content: scrapedContent.map(p => p.scraped || {
        content_url: p.url,
        status: "failed",
        error: p.error,
      }),
      unresponsive_engines: data.unresponsive_engines || [],
      safety_notice: "This tool searches for adult content. Use responsibly and ensure compliance with local laws.",
    };

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(output, null, 2),
        },
      ],
    };
  },
);

// Adult content-optimized scraper
async function scrapeAdultContent(url: string): Promise<any> {
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
    
    // Extract basic info
    const title = document.querySelector('title')?.textContent?.trim() || '';
    const metaDescription = document.querySelector('meta[name="description"]')?.getAttribute('content')?.trim() || '';
    
    // Extract content type
    const videoElements = document.querySelectorAll('video, source[type*="video"]');
    const imageElements = document.querySelectorAll('img');
    const isVideo = videoElements.length > 0;
    const isImage = imageElements.length > 0;
    
    // Extract duration for videos
    let duration = '';
    if (isVideo) {
      const durationPatterns = [
        /(\d{1,2}:\d{2}(?::\d{2})?)/g,
        /(\d+)\s*(?:min|minutes|secs?|seconds?)/gi,
      ];
      const content = document.body?.textContent || '';
      const durationMatch = durationPatterns[0].exec(content) || durationPatterns[1].exec(content);
      duration = durationMatch ? durationMatch[1] : '';
    }
    
    // Extract quality indicators
    const qualityPatterns = [
      /(4k|1080p|720p|480p|360p)/gi,
      /(hd|full hd|ultra hd)/gi,
    ];
    const content = document.body?.textContent || '';
    const qualityMatch = qualityPatterns[0].exec(content) || qualityPatterns[1].exec(content);
    const quality = qualityMatch ? qualityMatch[1] : '';
    
    // Extract and return only populated fields
    const result: any = {
      content_url: url,
      content_type: isVideo ? 'video' : isImage ? 'image' : 'unknown',
      status: "success",
      scraped_at: new Date().toISOString(),
    };
    
    // Only add fields that have values
    if (title) result.title = title;
    if (metaDescription && metaDescription !== title) result.description = metaDescription;
    if (duration) result.duration = duration;
    if (quality) result.quality = quality;
    
    return result;
    
  } catch (error) {
    return {
      content_url: url,
      status: "failed",
      error: error instanceof Error ? error.message : "Unknown error",
      scraped_at: new Date().toISOString(),
    };
  }
}

// YouTube transcript tool
const youtubeTranscriptSchema = {
  video_url: z.string().min(1).describe("YouTube video URL to get transcript from"),
  language: z.string().optional().describe("Language code for transcript (e.g., 'en', 'es')"),
};

server.tool(
  "youtube_transcript",
  "Get transcript from YouTube video using youtube-transcript package",
  youtubeTranscriptSchema,
  async ({ video_url, language }) => {
    try {
      // Extract video ID from URL
      const videoIdMatch = video_url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/);
      const videoId = videoIdMatch ? videoIdMatch[1] : null;
      
      if (!videoId) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Invalid YouTube URL: ${video_url}`,
            },
          ],
        };
      }

      // Fetch transcript - try with full URL first, then videoId
      let transcript;
      try {
        // Try with full URL first
        transcript = await fetchTranscript(video_url);
      } catch (urlError) {
        try {
          // Fallback to videoId
          transcript = await fetchTranscript(videoId);
        } catch (idError) {
          throw new Error(`Failed to fetch transcript: URL error - ${urlError instanceof Error ? urlError.message : 'Unknown'}, ID error - ${idError instanceof Error ? idError.message : 'Unknown'}`);
        }
      }
      
      if (!transcript || (!Array.isArray(transcript) && !transcript.segments)) {
        return {
          content: [
            {
              type: "text" as const,
              text: `No transcript available for video: ${video_url}`,
            },
          ],
        };
      }

      // Handle different response formats
      let segments: any[] = [];
      if (Array.isArray(transcript)) {
        segments = transcript;
      } else if (transcript.segments && Array.isArray(transcript.segments)) {
        segments = transcript.segments;
      }

      if (segments.length === 0) {
        return {
          content: [
            {
              type: "text" as const,
              text: `No transcript segments available for video: ${video_url}`,
            },
          ],
        };
      }

      // Format transcript
      const formattedTranscript = segments
        .map((segment: any) => `[${(segment.duration || segment.offset || 0).toFixed(2)}s] ${segment.text || segment.content}`)
        .join('\n');

      // Get total duration
      const totalDuration = segments.reduce((sum: number, segment: any) => sum + (segment.duration || segment.offset || 0), 0);

      const output = {
        video_url: video_url,
        video_id: videoId,
        language: language || 'auto',
        total_duration_seconds: totalDuration,
        total_duration_formatted: formatDuration(totalDuration),
        segment_count: segments.length,
        transcript: formattedTranscript,
        fetched_at: new Date().toISOString(),
      };

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(output, null, 2),
          },
        ],
      };

    } catch (error) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Error fetching transcript: ${error instanceof Error ? error.message : 'Unknown error'}`,
          },
        ],
      };
    }
  },
);

// Helper function to format duration
function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  } else {
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  }
}

// Helper functions
function extractUsername(url: string): string {
  const match = url.match(/(?:twitter\.com|x\.com)\/([^\/\?]+)/);
  return match ? match[1] : "";
}

function extractInstaUsername(url: string): string {
  const match = url.match(/instagram\.com\/([^\/\?]+)/);
  return match ? match[1] : "";
}

function extractNumber(text: string): string {
  const match = text.match(/(\d+(?:\.\d+)?[KM]?)/i);
  return match ? match[1] : "";
}

// Add a simple resource using the correct API
server.resource(
  "websearch",
  "mcp://websearch",
  {
    description: "Search the web using SearXNG",
    mimeType: "text/plain",
  },
  async () => {
    return {
      contents: [
        {
          uri: "mcp://websearch",
          mimeType: "text/plain",
          text: "Web Search MCP Server\n\nUse the get_links tool to search the web using SearXNG.\n\nExample usage:\n- Call get_links with query: 'latest technology trends 2025'\n- Optional categories parameter: 'general,web', 'news', 'images', etc.\n- Returns up to 6 search results with titles, URLs, and snippets."
        }
      ]
    };
  }
);

const getLinksSchema = {
  query: z.string().min(1).describe("Search query"),
  categories: z
    .string()
    .optional()
    .describe("Comma-separated categories (default general,web)"),
};

server.tool(
  "get_links",
  "Search SearXNG and return up to 6 links",
  getLinksSchema,
  async ({ query, categories }) => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    const params = new URLSearchParams({
      q: query,
      format: "json",
      categories: categories?.trim() || DEFAULT_CATEGORIES,
    });

    const url = `${BASE}/search?${params.toString()}`;
    const data = await fetchJson<SearxResponse>(url, controller);
    clearTimeout(timeout);

    if (!data || !data.results) {
      return {
        content: [
          {
            type: "text",
            text: "No results or failed to query SearXNG.",
          },
        ],
      };
    }

    const items = (data.results || [])
      .filter((r) => r.url)
      .slice(0, MAX_RESULTS)
      .map((r, idx) => {
        const title = r.title || r.url || "Untitled";
        const snippet = r.content ? ` — ${r.content}` : "";
        const engine = r.engine ? ` [${r.engine}]` : "";
        return `${idx + 1}. ${title}${engine}\n${r.url}${snippet}`;
      });

    const unresp =
      data.unresponsive_engines && data.unresponsive_engines.length
        ? `\nUnresponsive engines: ${data.unresponsive_engines.join(", ")}`
        : "";

    const body = items.length
      ? `Top ${items.length} links for "${data.query || query}":\n\n${items.join("\n\n")}${unresp}`
      : "No results with links were returned.";

    return {
      content: [
        {
          type: "text",
          text: body,
        },
      ],
    };
  },
);

async function main() {
  const transportMode = (process.env.TRANSPORT || "http").toLowerCase();

  if (transportMode === "stdio") {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("websearch-searxng MCP server running on stdio");
    
    // Keep the process alive indefinitely for stdio transport
    return new Promise(() => {});
  } else {

  const app = express();

  const transport = new StreamableHTTPServerTransport({
    enableJsonResponse: true, // allow POST JSON responses
    sessionIdGenerator: () => randomUUID(),
  });

  await server.connect(transport);

  // POST /mcp handles JSON-RPC messages; body must be raw for JSON-RPC parsing
  app.post("/mcp", async (req: Request, res: Response) => {
    try {
      const body = await getRawBody(req as any, { encoding: "utf8" });
      await transport.handleRequest(req as any, res as any, body);
    } catch (err) {
      console.error("POST /mcp error", err);
      if (!(res as any).headersSent) {
        res.status(500).json({ error: "Internal server error" });
      }
    }
  });

  // GET /mcp for SSE stream
  app.get("/mcp", async (req: Request, res: Response) => {
    try {
      await transport.handleRequest(req as any, res as any);
    } catch (err) {
      console.error("GET /mcp error", err);
      if (!(res as any).headersSent) {
        res.status(500).json({ error: "Internal server error" });
      }
    }
  });

  // DELETE /mcp to close session
  app.delete("/mcp", async (req: Request, res: Response) => {
    try {
      await transport.handleRequest(req as any, res as any);
    } catch (err) {
      console.error("DELETE /mcp error", err);
      if (!(res as any).headersSent) {
        res.status(500).json({ error: "Internal server error" });
      }
    }
  });

  const port = process.env.PORT ? Number(process.env.PORT) : 3000;
  app.listen(port, "0.0.0.0", () => {
    console.error(`websearch-searxng MCP server running on http://0.0.0.0:${port}/mcp`);
  });
  }
}

main().catch((err) => {
  console.error("Fatal error", err);
  process.exit(1);
});
