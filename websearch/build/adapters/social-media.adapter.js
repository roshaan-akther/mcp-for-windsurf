import { z } from "zod";
import { JSDOM } from "jsdom";
import { fetchJson, scrapeUrl } from "./web-search.adapter.js";
const BASE = "http://127.0.0.1:8888";
// Helper functions
function extractUsername(url) {
    const match = url.match(/(?:twitter\.com|x\.com)\/([^\/\?]+)/);
    return match ? match[1] : "";
}
function extractInstaUsername(url) {
    const match = url.match(/instagram\.com\/([^\/\?]+)/);
    return match ? match[1] : "";
}
function extractNumber(text) {
    const match = text.match(/(\d+(?:\.\d+)?[KM]?)/i);
    return match ? match[1] : "";
}
// X/Twitter Search Tool
const xSearchTool = {
    name: "x_search",
    description: "Search X/Twitter for people, scrape profiles, and return normalized data",
    schema: {
        query: z.string().min(1).describe("Person name or username to search on X/Twitter"),
        scrape_profiles: z.boolean().default(true).describe("Whether to scrape profile details"),
        max_profiles: z.number().min(1).max(10).default(5).describe("Maximum profiles to find and scrape")
    },
    handler: async ({ query, scrape_profiles, max_profiles }) => {
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
        const data = await fetchJson(url, controller);
        clearTimeout(timeout);
        if (!data || !data.results) {
            return {
                content: [
                    {
                        type: "text",
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
                        type: "text",
                        text: `No X/Twitter profiles found for "${query}"`,
                    },
                ],
            };
        }
        // Step 3: Scrape profiles if requested
        let scrapedProfiles = [];
        if (scrape_profiles) {
            scrapedProfiles = await Promise.all(profileResults.map(async (profile) => {
                try {
                    const scraped = await scrapeUrl(profile.url || "");
                    return {
                        url: profile.url,
                        engine: profile.engine,
                        scraped: scraped,
                    };
                }
                catch (error) {
                    return {
                        url: profile.url,
                        engine: profile.engine,
                        error: error instanceof Error ? error.message : "Scraping failed",
                    };
                }
            }));
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
                display_name: title.replace(/on X.*$/i, "").trim(),
                profile_url: profile.url,
                bio: bioMatch ? bioMatch[1].trim() : "",
                followers: extractNumber(followersMatch?.[0] || ''),
                verified: title.toLowerCase().includes("verified"),
                status: "success",
                last_scraped: new Date().toISOString(),
            };
        });
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
                    type: "text",
                    text: JSON.stringify(output, null, 2),
                },
            ],
        };
    }
};
// Instagram Search Tool
const instaSearchTool = {
    name: "insta_search_scrape",
    description: "Search Instagram, get top profiles, and scrape with flexible DOM handling",
    schema: {
        query: z.string().min(1).describe("Person name or username to search on Instagram"),
        max_profiles: z.number().min(1).max(5).default(2).describe("Maximum profiles to find and scrape")
    },
    handler: async ({ query, max_profiles }) => {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 15000);
        // Step 1: Search for Instagram profiles
        const params = new URLSearchParams({
            q: query + " instagram.com",
            format: "json",
            categories: "general,web",
            engines: "bing,duckduckgo,brave",
        });
        const url = `${BASE}/search?${params.toString()}`;
        const data = await fetchJson(url, controller);
        clearTimeout(timeout);
        if (!data || !data.results) {
            return {
                content: [
                    {
                        type: "text",
                        text: `No Instagram results found for "${query}"`,
                    },
                ],
            };
        }
        // Step 2: Extract profile URLs
        const profileResults = (data.results || [])
            .filter((r) => {
            const url = (r.url || "").toLowerCase();
            return url.includes("instagram.com/") && !url.includes("/p/");
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
                        type: "text",
                        text: `No Instagram profiles found for "${query}"`,
                    },
                ],
            };
        }
        // Step 3: Scrape profiles
        const scrapedProfiles = await Promise.all(profileResults.map(async (profile) => {
            try {
                const scraped = await scrapeInstaProfile(profile.url || "");
                return {
                    url: profile.url,
                    engine: profile.engine,
                    scraped: scraped,
                };
            }
            catch (error) {
                return {
                    url: profile.url,
                    engine: profile.engine,
                    error: error instanceof Error ? error.message : "Scraping failed",
                };
            }
        }));
        const output = {
            query: query,
            platform: "Instagram",
            search_summary: {
                total_profiles_found: profileResults.length,
                successfully_scraped: scrapedProfiles.filter((p) => !p.error).length,
                failed_scrapes: scrapedProfiles.filter((p) => p.error).length,
            },
            profiles: scrapedProfiles.map((p) => p.scraped || {
                username: extractInstaUsername(p.url || ""),
                profile_url: p.url,
                status: "failed",
                error: p.error,
            }),
            unresponsive_engines: data.unresponsive_engines || [],
        };
        return {
            content: [
                {
                    type: "text",
                    text: JSON.stringify(output, null, 2),
                },
            ],
        };
    }
};
// Instagram profile scraper
async function scrapeInstaProfile(url) {
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
        // Extract username with multiple fallback patterns
        const usernamePatterns = [
            () => url.match(/instagram\.com\/([^\/\?]+)/)?.[1] || '',
            () => document.querySelector('meta[property="og:url"]')?.getAttribute('content')?.match(/instagram\.com\/([^\/\?]+)/)?.[1] || '',
            () => document.querySelector('[data-username]')?.getAttribute('data-username') || '',
        ];
        const username = usernamePatterns.find(pattern => pattern())?.() || '';
        // Extract display name
        const displayName = document.querySelector('h1, [data-testid="username"]')?.textContent?.trim() || '';
        // Extract bio with multiple patterns
        const metaDescription = document.querySelector('meta[name="description"]')?.getAttribute('content') || '';
        const bioPatterns = [
            () => metaDescription.match(/(.+?)\s*\d+\s*(?:followers|posts|photos)/i)?.[1]?.trim() || '',
            () => document.querySelector('[data-testid="user-description"]')?.textContent?.trim() || '',
            () => document.querySelector('.-qQT3')?.textContent?.trim() || '',
            () => document.querySelector('div[data-visualcompletion="ignore-dynamic"]')?.textContent?.trim() || '',
        ];
        const bio = bioPatterns.find(pattern => pattern())?.() || '';
        // Extract stats
        const content = document.body?.textContent || '';
        const followersMatch = content.match(/(\d+(?:\.\d+)?[KM]?)\s*(?:followers|follower)/i);
        const followingMatch = content.match(/(\d+(?:\.\d+)?[KM]?)\s*following/i);
        const postsMatch = content.match(/(\d+(?:\.\d+)?[KM]?)\s*(?:posts|photos)/i);
        // Extract verification status
        const verified = !!document.querySelector('[data-testid="verified-badge"], .verified-badge');
        // Extract profile image
        const image = document.querySelector('meta[property="og:image"]')?.getAttribute('content') || '';
        // Extract external URL
        const externalUrl = document.querySelector('meta[property="og:url"]')?.getAttribute('content') || '';
        // Only add fields that have values
        const result = {
            username: username,
            profile_url: url,
            status: "success",
            scraped_at: new Date().toISOString(),
        };
        if (displayName && displayName !== username)
            result.display_name = displayName;
        if (bio)
            result.bio = bio;
        if (extractNumber(followersMatch?.[0] || ''))
            result.followers = extractNumber(followersMatch?.[0] || '');
        if (extractNumber(followingMatch?.[0] || ''))
            result.following = extractNumber(followingMatch?.[0] || '');
        if (extractNumber(postsMatch?.[0] || ''))
            result.posts = extractNumber(postsMatch?.[0] || '');
        if (verified)
            result.verified = verified;
        if (image)
            result.profile_image = image;
        if (externalUrl && externalUrl !== url)
            result.external_url = externalUrl;
        return result;
    }
    catch (error) {
        return {
            profile_url: url,
            status: "failed",
            error: error instanceof Error ? error.message : "Unknown error",
            scraped_at: new Date().toISOString(),
        };
    }
}
export const socialMediaAdapter = {
    name: "social-media",
    description: "Social media search and profile scraping tools",
    tools: [xSearchTool, instaSearchTool]
};
