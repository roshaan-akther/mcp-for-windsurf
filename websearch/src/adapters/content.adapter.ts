import { z } from "zod";
import { JSDOM } from "jsdom";
import { fetchTranscript } from "@egoist/youtube-transcript-plus";
import { Adapter, Tool } from "./adapter.js";
import { fetchJson } from "./web-search.adapter.js";

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

// Adult Content Search Tool
const adultSearchTool: Tool = {
  name: "adult_search",
  description: "Search adult content safely with flexible DOM handling",
  schema: {
    query: z.string().min(1).describe("Search query for adult content"),
    max_results: z.number().min(1).max(10).default(5).describe("Maximum results to find and scrape"),
    content_type: z.enum(["videos", "images", "profiles", "all"]).default("all").describe("Type of content to search for")
  },
  handler: async ({ query, max_results, content_type }) => {
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
      .filter((r: SearxResult) => {
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
      .map((r: SearxResult) => ({
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
      contentResults.map(async (content: any) => {
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
        successfully_scraped: scrapedContent.filter((p: any) => !p.error).length,
        failed_scrapes: scrapedContent.filter((p: any) => p.error).length,
      },
      content: scrapedContent.map((p: any) => p.scraped || {
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
  }
};

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

// YouTube Transcript Tool
const youtubeTranscriptTool: Tool = {
  name: "youtube_transcript",
  description: "Get transcript from YouTube video using youtube-transcript package",
  schema: {
    video_url: z.string().min(1).describe("YouTube video URL to get transcript from"),
    language: z.string().optional().describe("Language code for transcript (e.g., 'en', 'es')")
  },
  handler: async ({ video_url, language }) => {
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

      // Extract video metadata (channel, title)
      const metadata = await extractVideoMetadata(video_url);

      const output = {
        video_url: video_url,
        video_id: videoId,
        channel: metadata.channel,
        title: metadata.title,
        language: language || "auto",
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
  }
};

// Helper function to extract video metadata including channel
async function extractVideoMetadata(videoUrl: string): Promise<any> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    
    const response = await fetch(videoUrl, { 
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
    
    // Extract channel name using multiple selectors
    const channelSelectors = [
      () => document.querySelector('link[itemprop="name"]')?.getAttribute('content'),
      () => document.querySelector('[data-channel-name]')?.getAttribute('data-channel-name'),
      () => document.querySelector('.yt-channel-name')?.textContent?.trim(),
      () => document.querySelector('#channel-name')?.textContent?.trim(),
      () => document.querySelector('span[itemprop="author"] link[itemprop="name"]')?.getAttribute('content'),
      () => document.querySelector('ytd-channel-name a')?.textContent?.trim(),
      () => document.querySelector('.ytd-channel-name')?.textContent?.trim(),
      () => document.querySelector('meta[property="og:title"]')?.getAttribute('content')?.split(' - ').pop()?.trim(),
    ];
    
    let channelName = '';
    for (const selector of channelSelectors) {
      try {
        const result = selector();
        if (result && result.length > 0) {
          channelName = result;
          break;
        }
      } catch (e) {
        // Continue to next selector
      }
    }
    
    // Extract video title
    const titleSelectors = [
      () => document.querySelector('meta[property="og:title"]')?.getAttribute('content'),
      () => document.querySelector('title')?.textContent?.replace(' - YouTube', ''),
      () => document.querySelector('h1.title')?.textContent?.trim(),
      () => document.querySelector('.ytd-video-primary-info-renderer h1')?.textContent?.trim(),
    ];
    
    let videoTitle = '';
    for (const selector of titleSelectors) {
      try {
        const result = selector();
        if (result && result.length > 0) {
          videoTitle = result;
          break;
        }
      } catch (e) {
        // Continue to next selector
      }
    }
    
    return {
      channel: channelName || 'Unknown Channel',
      title: videoTitle || 'Unknown Title',
      extracted_at: new Date().toISOString()
    };
    
  } catch (error) {
    return {
      channel: 'Unknown Channel',
      title: 'Unknown Title',
      error: error instanceof Error ? error.message : 'Unknown error',
      extracted_at: new Date().toISOString()
    };
  }
}
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

// YouTube Time-based Transcript Tool
const youtubeTimeTranscriptTool: Tool = {
  name: "youtube_time_transcript",
  description: "Get YouTube transcript for a specific time range (1 min before to 2 min after timestamp)",
  schema: {
    video_url: z.string().min(1).describe("YouTube video URL"),
    timestamp: z.number().min(0).describe("Timestamp in seconds to center the transcript around")
  },
  handler: async ({ video_url, timestamp }) => {
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

      // Fetch transcript
      let transcript;
      try {
        transcript = await fetchTranscript(video_url);
      } catch (urlError) {
        try {
          transcript = await fetchTranscript(videoId);
        } catch (idError) {
          throw new Error(`Failed to fetch transcript: ${idError instanceof Error ? idError.message : 'Unknown'}`);
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

      // Calculate total duration
      const totalDuration = segments.reduce((sum: number, segment: any) => sum + (segment.duration || segment.offset || 0), 0);

      // Check if timestamp is beyond video duration
      if (timestamp > totalDuration) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Video is only ${totalDuration.toFixed(2)}s long, but requested timestamp is ${timestamp}s`,
            },
          ],
        };
      }

      // Calculate time range: 60s before to 120s after timestamp
      const startTime = Math.max(0, timestamp - 60);
      const endTime = Math.min(totalDuration, timestamp + 120);

      // Filter segments within the time range
      let currentTime = 0;
      const filteredSegments = segments.filter((segment: any) => {
        const segmentStart = currentTime;
        const segmentDuration = segment.duration || segment.offset || 0;
        const segmentEnd = segmentStart + segmentDuration;
        currentTime = segmentEnd;
        
        return segmentStart < endTime && segmentEnd > startTime;
      });

      // Format transcript with timestamps
      const formattedTranscript = filteredSegments
        .map((segment: any) => {
          const segmentStart = segment.start || 0;
          return `[${segmentStart.toFixed(2)}s] ${segment.text || segment.content}`;
        })
        .join('\n');

      // Extract video metadata (channel, title)
      const metadata = await extractVideoMetadata(video_url);

      const output = {
        video_url: video_url,
        video_id: videoId,
        channel: metadata.channel,
        title: metadata.title,
        requested_timestamp: timestamp,
        time_range: {
          start: startTime,
          end: endTime,
          duration: endTime - startTime
        },
        video_total_duration: totalDuration,
        segments_in_range: filteredSegments.length,
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
            text: `Error fetching time-based transcript: ${error instanceof Error ? error.message : 'Unknown error'}`,
          },
        ],
      };
    }
  }
};

export const contentAdapter: Adapter = {
  name: "content",
  description: "Content search and extraction tools (adult content, YouTube transcripts)",
  tools: [adultSearchTool, youtubeTranscriptTool, youtubeTimeTranscriptTool]
};
