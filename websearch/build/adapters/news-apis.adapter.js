import { z } from "zod";
// NewsAPI.org Tool
const newsApiTool = {
    name: "newsapi",
    description: "Get news articles from NewsAPI.org",
    schema: {
        query: z.string().optional().describe("Search keywords"),
        category: z.enum(['business', 'entertainment', 'general', 'health', 'science', 'sports', 'technology']).optional().describe("News category"),
        country: z.string().default('us').describe("Country code (e.g., us, gb, de, fr)"),
        page_size: z.number().min(1).max(100).default(10).describe("Number of articles (1-100)"),
        api_key: z.string().optional().describe("NewsAPI.org key (optional, uses demo key)")
    },
    handler: async ({ query, category, country, page_size, api_key }) => {
        try {
            // Use demo API key if none provided
            const apiKey = api_key || 'demo';
            const baseUrl = 'https://newsapi.org/v2/top-headlines';
            const params = new URLSearchParams({
                apiKey: apiKey,
                country: country,
                pageSize: page_size.toString()
            });
            if (query) {
                params.set('q', query);
                baseUrl.replace('/top-headlines', '/everything');
            }
            if (category) {
                params.set('category', category);
            }
            const response = await fetch(`${baseUrl}?${params}`);
            if (!response.ok) {
                if (response.status === 401) {
                    return {
                        content: [
                            {
                                type: "text",
                                text: "Invalid API key. Please provide a valid NewsAPI.org key or get one free from https://newsapi.org/"
                            }
                        ]
                    };
                }
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            const data = await response.json();
            return {
                content: [
                    {
                        type: "text",
                        text: JSON.stringify({
                            source: "NewsAPI.org",
                            total_results: data.totalResults,
                            articles: data.articles.map((article) => ({
                                title: article.title,
                                description: article.description,
                                author: article.author,
                                source: article.source.name,
                                url: article.url,
                                image_url: article.urlToImage,
                                published_at: article.publishedAt,
                                content_preview: article.content?.substring(0, 200) + '...'
                            })),
                            filters: {
                                query,
                                category,
                                country
                            },
                            fetched_at: new Date().toISOString()
                        }, null, 2)
                    }
                ]
            };
        }
        catch (error) {
            return {
                content: [
                    {
                        type: "text",
                        text: `Error fetching news: ${error instanceof Error ? error.message : 'Unknown error'}`
                    }
                ]
            };
        }
    }
};
// Guardian API Tool
const guardianApiTool = {
    name: "guardian_news",
    description: "Get news articles from The Guardian API",
    schema: {
        query: z.string().optional().describe("Search keywords"),
        section: z.string().optional().describe("Guardian section (e.g., politics, technology, sport)"),
        page_size: z.number().min(1).max(50).default(10).describe("Number of articles (1-50)"),
        api_key: z.string().optional().describe("Guardian API key (optional, uses demo key)")
    },
    handler: async ({ query, section, page_size, api_key }) => {
        try {
            // Use demo API key if none provided
            const apiKey = api_key || 'demo';
            const baseUrl = 'https://content.guardianapis.com/search';
            const params = new URLSearchParams({
                'api-key': apiKey,
                'page-size': page_size.toString(),
                'show-fields': 'headline,standfirst,bodyText,thumbnail,byline',
                'order-by': 'newest'
            });
            if (query) {
                params.set('q', query);
            }
            if (section) {
                params.set('section', section);
            }
            const response = await fetch(`${baseUrl}?${params}`);
            if (!response.ok) {
                if (response.status === 403) {
                    return {
                        content: [
                            {
                                type: "text",
                                text: "Invalid API key. Please provide a valid Guardian API key or get one free from https://open-platform.theguardian.com/access/"
                            }
                        ]
                    };
                }
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            const data = await response.json();
            return {
                content: [
                    {
                        type: "text",
                        text: JSON.stringify({
                            source: "The Guardian API",
                            total_results: data.response.total,
                            current_page: data.response.currentPage,
                            pages: data.response.pages,
                            articles: data.response.results.map((article) => ({
                                id: article.id,
                                title: article.webTitle,
                                section: article.sectionName,
                                author: article.fields?.byline,
                                headline: article.fields?.headline,
                                standfirst: article.fields?.standfirst,
                                body_preview: article.fields?.bodyText?.substring(0, 300) + '...',
                                thumbnail: article.fields?.thumbnail,
                                url: article.webUrl,
                                published_at: article.webPublicationDate,
                                pillar: article.pillarName
                            })),
                            filters: {
                                query,
                                section
                            },
                            fetched_at: new Date().toISOString()
                        }, null, 2)
                    }
                ]
            };
        }
        catch (error) {
            return {
                content: [
                    {
                        type: "text",
                        text: `Error fetching Guardian news: ${error instanceof Error ? error.message : 'Unknown error'}`
                    }
                ]
            };
        }
    }
};
// NewsAPI.org Everything Search Tool
const newsApiSearchTool = {
    name: "newsapi_search",
    description: "Search all news articles from NewsAPI.org",
    schema: {
        query: z.string().min(1).describe("Search keywords"),
        domains: z.string().optional().describe("Comma-separated list of domains to search"),
        from_date: z.string().optional().describe("From date (YYYY-MM-DD)"),
        to_date: z.string().optional().describe("To date (YYYY-MM-DD)"),
        language: z.string().default('en').describe("Language code (e.g., en, es, fr)"),
        sort_by: z.enum(['relevancy', 'popularity', 'publishedAt']).default('publishedAt').describe("Sort order"),
        page_size: z.number().min(1).max(100).default(10).describe("Number of articles (1-100)"),
        api_key: z.string().optional().describe("NewsAPI.org key (optional, uses demo key)")
    },
    handler: async ({ query, domains, from_date, to_date, language, sort_by, page_size, api_key }) => {
        try {
            const apiKey = api_key || 'demo';
            const baseUrl = 'https://newsapi.org/v2/everything';
            const params = new URLSearchParams({
                apiKey: apiKey,
                q: query,
                language: language,
                sortBy: sort_by,
                pageSize: page_size.toString()
            });
            if (domains) {
                params.set('domains', domains);
            }
            if (from_date) {
                params.set('from', from_date);
            }
            if (to_date) {
                params.set('to', to_date);
            }
            const response = await fetch(`${baseUrl}?${params}`);
            if (!response.ok) {
                if (response.status === 401) {
                    return {
                        content: [
                            {
                                type: "text",
                                text: "Invalid API key. Please provide a valid NewsAPI.org key or get one free from https://newsapi.org/"
                            }
                        ]
                    };
                }
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            const data = await response.json();
            return {
                content: [
                    {
                        type: "text",
                        text: JSON.stringify({
                            source: "NewsAPI.org",
                            total_results: data.totalResults,
                            articles: data.articles.map((article) => ({
                                title: article.title,
                                description: article.description,
                                author: article.author,
                                source: article.source.name,
                                url: article.url,
                                image_url: article.urlToImage,
                                published_at: article.publishedAt,
                                content_preview: article.content?.substring(0, 200) + '...'
                            })),
                            search_params: {
                                query,
                                domains,
                                from_date,
                                to_date,
                                language,
                                sort_by
                            },
                            fetched_at: new Date().toISOString()
                        }, null, 2)
                    }
                ]
            };
        }
        catch (error) {
            return {
                content: [
                    {
                        type: "text",
                        text: `Error searching news: ${error instanceof Error ? error.message : 'Unknown error'}`
                    }
                ]
            };
        }
    }
};
// JSONPlaceholder Mock News Tool (for testing without API key)
const mockNewsTool = {
    name: "mock_news",
    description: "Get mock news articles for testing (no API key required)",
    schema: {
        category: z.string().optional().describe("News category"),
        limit: z.number().min(1).max(20).default(5).describe("Number of articles (1-20)")
    },
    handler: async ({ category, limit }) => {
        try {
            const mockArticles = [
                {
                    title: "Breaking: Major Technology Breakthrough Announced",
                    description: "Scientists have made a groundbreaking discovery that could revolutionize the tech industry.",
                    author: "Tech Reporter",
                    source: "Mock News Network",
                    url: "https://example.com/news/1",
                    image_url: "https://picsum.photos/seed/tech1/800/600.jpg",
                    published_at: new Date().toISOString(),
                    content_preview: "In a stunning development today, researchers unveiled..."
                },
                {
                    title: "Global Markets React to Economic Changes",
                    description: "Financial markets worldwide are responding to new economic policies.",
                    author: "Finance Correspondent",
                    source: "Mock Business Daily",
                    url: "https://example.com/news/2",
                    image_url: "https://picsum.photos/seed/finance1/800/600.jpg",
                    published_at: new Date(Date.now() - 3600000).toISOString(),
                    content_preview: "Stock markets around the globe showed mixed reactions..."
                },
                {
                    title: "Healthcare Innovation Saves Lives",
                    description: "New medical treatments are showing promising results in clinical trials.",
                    author: "Health Reporter",
                    source: "Mock Health News",
                    url: "https://example.com/news/3",
                    image_url: "https://picsum.photos/seed/health1/800/600.jpg",
                    published_at: new Date(Date.now() - 7200000).toISOString(),
                    content_preview: "A revolutionary new treatment approach has demonstrated..."
                }
            ];
            const filteredArticles = category
                ? mockArticles.filter(article => article.title.toLowerCase().includes(category.toLowerCase()) ||
                    article.description.toLowerCase().includes(category.toLowerCase()))
                : mockArticles;
            const limitedArticles = filteredArticles.slice(0, limit);
            return {
                content: [
                    {
                        type: "text",
                        text: JSON.stringify({
                            source: "Mock News API",
                            total_results: limitedArticles.length,
                            articles: limitedArticles,
                            category_filter: category,
                            fetched_at: new Date().toISOString()
                        }, null, 2)
                    }
                ]
            };
        }
        catch (error) {
            return {
                content: [
                    {
                        type: "text",
                        text: `Error generating mock news: ${error instanceof Error ? error.message : 'Unknown error'}`
                    }
                ]
            };
        }
    }
};
export const newsApisAdapter = {
    name: "news-apis",
    description: "News and article APIs from multiple providers",
    tools: [
        newsApiTool,
        guardianApiTool,
        newsApiSearchTool,
        mockNewsTool
    ]
};
