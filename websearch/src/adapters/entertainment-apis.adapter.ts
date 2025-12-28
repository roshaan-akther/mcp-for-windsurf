import { z } from "zod";
import { Tool, Adapter } from "./adapter.js";

// Types for entertainment APIs
interface Movie {
  id: number;
  title: string;
  overview: string;
  release_date: string;
  poster_path: string;
  backdrop_path: string;
  vote_average: number;
  vote_count: number;
  popularity: number;
  genre_ids: number[];
  adult: boolean;
  original_language: string;
  original_title: string;
}

interface TVShow {
  id: number;
  name: string;
  overview: string;
  first_air_date: string;
  poster_path: string;
  backdrop_path: string;
  vote_average: number;
  vote_count: number;
  popularity: number;
  genre_ids: number[];
  original_language: string;
  original_name: string;
}

interface Game {
  id: number;
  name: string;
  released: string;
  background_image: string;
  rating: number;
  rating_top: number;
  metacritic: number;
  playtime: number;
  suggestions_count: number;
  reviews_count: number;
  genres: Array<{ id: number; name: string }>;
  platforms: Array<{ id: number; name: string }>;
}

interface Book {
  id: string;
  volumeInfo: {
    title: string;
    authors: string[];
    publisher: string;
    publishedDate: string;
    description: string;
    industryIdentifiers: Array<{
      type: string;
      identifier: string;
    }>;
    readingModes: {
      text: boolean;
      image: boolean;
    };
    pageCount: number;
    printType: string;
    categories: string[];
    averageRating: number;
    ratingsCount: number;
    maturityRating: string;
    allowAnonLogging: boolean;
    contentVersion: string;
    panelizationSummary: {
      containsEpubBubbles: boolean;
      containsImageBubbles: boolean;
    };
    imageLinks: {
      smallThumbnail: string;
      thumbnail: string;
    };
    language: string;
    previewLink: string;
    infoLink: string;
    canonicalVolumeLink: string;
  };
}

// TMDB Movies Tool
const tmdbMoviesTool: Tool = {
  name: "tmdb_movies",
  description: "Get popular movies from TMDB API",
  schema: {
    category: z.enum(['popular', 'top_rated', 'upcoming', 'now_playing']).default('popular').describe("Movie category"),
    page: z.number().min(1).max(500).default(1).describe("Page number (1-500)"),
    api_key: z.string().optional().describe("TMDB API key (optional, uses demo key)")
  },
  handler: async ({ category, page, api_key }) => {
    try {
      const apiKey = api_key || 'demo';
      const baseUrl = 'https://api.themoviedb.org/3/movie';
      const params = new URLSearchParams({
        api_key: apiKey,
        page: page.toString()
      });

      const response = await fetch(`${baseUrl}/${category}?${params}`);
      
      if (!response.ok) {
        if (response.status === 401) {
          return {
            content: [
              {
                type: "text" as const,
                text: "Invalid API key. Please provide a valid TMDB API key or get one free from https://www.themoviedb.org/settings/api"
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
            type: "text" as const,
            text: JSON.stringify({
              source: "TMDB API",
              category: category,
              page: data.page,
              total_pages: data.total_pages,
              total_results: data.total_results,
              movies: data.results.map((movie: Movie) => ({
                id: movie.id,
                title: movie.title,
                overview: movie.overview,
                release_date: movie.release_date,
                poster_url: movie.poster_path ? `https://image.tmdb.org/t/p/w500${movie.poster_path}` : null,
                backdrop_url: movie.backdrop_path ? `https://image.tmdb.org/t/p/w1280${movie.backdrop_path}` : null,
                rating: movie.vote_average,
                vote_count: movie.vote_count,
                popularity: movie.popularity,
                adult: movie.adult,
                original_language: movie.original_language,
                original_title: movie.original_title
              })),
              fetched_at: new Date().toISOString()
            }, null, 2)
          }
        ]
      };

    } catch (error) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Error fetching movies: ${error instanceof Error ? error.message : 'Unknown error'}`
          }
        ]
      };
    }
  }
};

// TMDB TV Shows Tool
const tmdbTVShowsTool: Tool = {
  name: "tmdb_tv_shows",
  description: "Get popular TV shows from TMDB API",
  schema: {
    category: z.enum(['popular', 'top_rated', 'on_the_air', 'airing_today']).default('popular').describe("TV show category"),
    page: z.number().min(1).max(500).default(1).describe("Page number (1-500)"),
    api_key: z.string().optional().describe("TMDB API key (optional, uses demo key)")
  },
  handler: async ({ category, page, api_key }) => {
    try {
      const apiKey = api_key || 'demo';
      const baseUrl = 'https://api.themoviedb.org/3/tv';
      const params = new URLSearchParams({
        api_key: apiKey,
        page: page.toString()
      });

      const response = await fetch(`${baseUrl}/${category}?${params}`);
      
      if (!response.ok) {
        if (response.status === 401) {
          return {
            content: [
              {
                type: "text" as const,
                text: "Invalid API key. Please provide a valid TMDB API key or get one free from https://www.themoviedb.org/settings/api"
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
            type: "text" as const,
            text: JSON.stringify({
              source: "TMDB API",
              category: category,
              page: data.page,
              total_pages: data.total_pages,
              total_results: data.total_results,
              tv_shows: data.results.map((show: TVShow) => ({
                id: show.id,
                name: show.name,
                overview: show.overview,
                first_air_date: show.first_air_date,
                poster_url: show.poster_path ? `https://image.tmdb.org/t/p/w500${show.poster_path}` : null,
                backdrop_url: show.backdrop_path ? `https://image.tmdb.org/t/p/w1280${show.backdrop_path}` : null,
                rating: show.vote_average,
                vote_count: show.vote_count,
                popularity: show.popularity,
                original_language: show.original_language,
                original_name: show.original_name
              })),
              fetched_at: new Date().toISOString()
            }, null, 2)
          }
        ]
      };

    } catch (error) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Error fetching TV shows: ${error instanceof Error ? error.message : 'Unknown error'}`
          }
        ]
      };
    }
  }
};

// RAWG Games Tool
const rawgGamesTool: Tool = {
  name: "rawg_games",
  description: "Get games from RAWG Video Games Database API",
  schema: {
    category: z.enum(['popular', 'new', 'upcoming', 'best']).default('popular').describe("Game category"),
    page: z.number().min(1).max(100).default(1).describe("Page number (1-100)"),
    page_size: z.number().min(1).max(40).default(20).describe("Number of games per page (1-40)"),
    platforms: z.string().optional().describe("Platform IDs (comma-separated)"),
    genres: z.string().optional().describe("Genre IDs (comma-separated)")
  },
  handler: async ({ category, page, page_size, platforms, genres }) => {
    try {
      const baseUrl = 'https://api.rawg.io/api/games';
      const params = new URLSearchParams({
        key: 'demo',
        page: page.toString(),
        page_size: page_size.toString()
      });

      // Set ordering based on category
      switch (category) {
        case 'popular':
          params.set('ordering', '-rating');
          break;
        case 'new':
          params.set('ordering', '-released');
          break;
        case 'upcoming':
          params.set('ordering', '-released');
          params.set('dates', '2024-01-01,2025-12-31');
          break;
        case 'best':
          params.set('ordering', '-metacritic');
          break;
      }

      if (platforms) {
        params.set('platforms', platforms);
      }

      if (genres) {
        params.set('genres', genres);
      }

      const response = await fetch(`${baseUrl}?${params}`);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({
              source: "RAWG API",
              category: category,
              page: data.current_page,
              total_pages: data.total_pages,
              total_results: data.count,
              games: data.results.map((game: Game) => ({
                id: game.id,
                name: game.name,
                released: game.released,
                background_image: game.background_image,
                rating: game.rating,
                rating_top: game.rating_top,
                metacritic: game.metacritic,
                playtime: game.playtime,
                suggestions_count: game.suggestions_count,
                reviews_count: game.reviews_count,
                genres: game.genres,
                platforms: game.platforms
              })),
              fetched_at: new Date().toISOString()
            }, null, 2)
          }
        ]
      };

    } catch (error) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Error fetching games: ${error instanceof Error ? error.message : 'Unknown error'}`
          }
        ]
      };
    }
  }
};

// Google Books Tool
const googleBooksTool: Tool = {
  name: "google_books",
  description: "Search books from Google Books API",
  schema: {
    query: z.string().min(1).describe("Search query for books"),
    max_results: z.number().min(1).max(40).default(10).describe("Maximum number of results (1-40)"),
    print_type: z.enum(['all', 'books', 'magazines']).default('all').describe("Print type filter"),
    filter: z.enum(['partial', 'full', 'free-ebooks', 'paid-ebooks', 'ebooks']).default('partial').describe("Filter type")
  },
  handler: async ({ query, max_results, print_type, filter }) => {
    try {
      const baseUrl = 'https://www.googleapis.com/books/v1/volumes';
      const params = new URLSearchParams({
        q: query,
        maxResults: max_results.toString(),
        printType: print_type,
        filter: filter
      });

      const response = await fetch(`${baseUrl}?${params}`);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({
              source: "Google Books API",
              total_items: data.totalItems,
              max_results: max_results,
              query: query,
              filters: {
                print_type,
                filter
              },
              books: data.items?.map((book: Book) => ({
                id: book.id,
                title: book.volumeInfo.title,
                authors: book.volumeInfo.authors,
                publisher: book.volumeInfo.publisher,
                published_date: book.volumeInfo.publishedDate,
                description: book.volumeInfo.description,
                isbn: book.volumeInfo.industryIdentifiers,
                page_count: book.volumeInfo.pageCount,
                categories: book.volumeInfo.categories,
                average_rating: book.volumeInfo.averageRating,
                ratings_count: book.volumeInfo.ratingsCount,
                language: book.volumeInfo.language,
                thumbnail: book.volumeInfo.imageLinks?.thumbnail,
                preview_link: book.volumeInfo.previewLink,
                info_link: book.volumeInfo.infoLink
              })) || [],
              fetched_at: new Date().toISOString()
            }, null, 2)
          }
        ]
      };

    } catch (error) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Error searching books: ${error instanceof Error ? error.message : 'Unknown error'}`
          }
        ]
      };
    }
  }
};

// Spotify Search Tool (requires API key)
const spotifySearchTool: Tool = {
  name: "spotify_search",
  description: "Search music from Spotify API",
  schema: {
    query: z.string().min(1).describe("Search query"),
    type: z.enum(['album', 'artist', 'playlist', 'track']).default('track').describe("Search type"),
    limit: z.number().min(1).max(50).default(10).describe("Number of results (1-50)"),
    api_key: z.string().optional().describe("Spotify API access token")
  },
  handler: async ({ query, type, limit, api_key }) => {
    try {
      if (!api_key) {
        return {
          content: [
            {
              type: "text" as const,
              text: "Spotify API access token required. Get one from Spotify Developer Dashboard: https://developer.spotify.com/"
            }
          ]
        };
      }

      const baseUrl = 'https://api.spotify.com/v1/search';
      const params = new URLSearchParams({
        q: query,
        type: type,
        limit: limit.toString()
      });

      const response = await fetch(`${baseUrl}?${params}`, {
        headers: {
          'Authorization': `Bearer ${api_key}`
        }
      });
      
      if (!response.ok) {
        if (response.status === 401) {
          return {
            content: [
              {
                type: "text" as const,
                text: "Invalid Spotify API token. Please provide a valid access token"
              }
            ]
          };
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      const results = data[`${type}s`];

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({
              source: "Spotify API",
              search_type: type,
              query: query,
              total_results: results?.total || 0,
              items: results?.items?.map((item: any) => ({
                id: item.id,
                name: item.name,
                type: type,
                popularity: item.popularity,
                preview_url: item.preview_url,
                external_urls: item.external_urls,
                images: item.images,
                artists: item.artists?.map((artist: any) => ({
                  name: artist.name,
                  id: artist.id
                })),
                album: item.album ? {
                  name: item.album.name,
                  release_date: item.album.release_date,
                  images: item.album.images
                } : null
              })) || [],
              fetched_at: new Date().toISOString()
            }, null, 2)
          }
        ]
      };

    } catch (error) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Error searching Spotify: ${error instanceof Error ? error.message : 'Unknown error'}`
          }
        ]
      };
    }
  }
};

export const entertainmentApisAdapter: Adapter = {
  name: "entertainment-apis",
  description: "Entertainment APIs for movies, TV shows, games, books, and music",
  tools: [
    tmdbMoviesTool,
    tmdbTVShowsTool,
    rawgGamesTool,
    googleBooksTool,
    spotifySearchTool
  ]
};
