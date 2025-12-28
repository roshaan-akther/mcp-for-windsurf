import { z } from "zod";
import { Tool, Adapter } from "./adapter.js";

// Types for various free APIs
interface JSONPlaceholderUser {
  id: number;
  name: string;
  username: string;
  email: string;
  address: {
    street: string;
    suite: string;
    city: string;
    zipcode: string;
    geo: {
      lat: string;
      lng: string;
    };
  };
  phone: string;
  website: string;
  company: {
    name: string;
    catchPhrase: string;
    bs: string;
  };
}

interface JSONPlaceholderPost {
  userId: number;
  id: number;
  title: string;
  body: string;
}

interface JSONPlaceholderComment {
  postId: number;
  id: number;
  name: string;
  email: string;
  body: string;
}

interface QuoteData {
  _id: string;
  content: string;
  author: string;
  tags: string[];
  authorSlug: string;
  length: number;
  dateAdded: string;
  dateModified: string;
}

interface RandomUser {
  gender: string;
  name: {
    title: string;
    first: string;
    last: string;
  };
  location: {
    street: {
      number: number;
      name: string;
    };
    city: string;
    state: string;
    country: string;
    postcode: string;
  };
  email: string;
  login: {
    uuid: string;
    username: string;
    password: string;
    salt: string;
    md5: string;
    sha1: string;
    sha256: string;
  };
  dob: {
    date: string;
    age: number;
  };
  registered: {
    date: string;
    age: number;
  };
  phone: string;
  cell: string;
  picture: {
    large: string;
    medium: string;
    thumbnail: string;
  };
  nat: string;
}

// JSONPlaceholder API Tools
const jsonPlaceholderUsersTool: Tool = {
  name: "jsonplaceholder_users",
  description: "Get fake user data from JSONPlaceholder API for testing",
  schema: {
    limit: z.number().min(1).max(10).default(5).describe("Number of users to fetch (1-10)")
  },
  handler: async ({ limit }) => {
    try {
      const response = await fetch('https://jsonplaceholder.typicode.com/users');
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const users: JSONPlaceholderUser[] = await response.json();
      const limitedUsers = users.slice(0, limit);

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({
              source: "JSONPlaceholder API",
              total_users: users.length,
              returned_users: limitedUsers.length,
              users: limitedUsers,
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
            text: `Error fetching users: ${error instanceof Error ? error.message : 'Unknown error'}`
          }
        ]
      };
    }
  }
};

const jsonPlaceholderPostsTool: Tool = {
  name: "jsonplaceholder_posts",
  description: "Get fake blog posts from JSONPlaceholder API for testing",
  schema: {
    limit: z.number().min(1).max(20).default(10).describe("Number of posts to fetch (1-20)"),
    user_id: z.number().optional().describe("Filter posts by user ID")
  },
  handler: async ({ limit, user_id }) => {
    try {
      let url = 'https://jsonplaceholder.typicode.com/posts';
      if (user_id) {
        url += `?userId=${user_id}`;
      }
      
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const posts: JSONPlaceholderPost[] = await response.json();
      const limitedPosts = posts.slice(0, limit);

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({
              source: "JSONPlaceholder API",
              total_posts: posts.length,
              returned_posts: limitedPosts.length,
              filter_user_id: user_id,
              posts: limitedPosts,
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
            text: `Error fetching posts: ${error instanceof Error ? error.message : 'Unknown error'}`
          }
        ]
      };
    }
  }
};

const jsonPlaceholderCommentsTool: Tool = {
  name: "jsonplaceholder_comments",
  description: "Get fake comments from JSONPlaceholder API for testing",
  schema: {
    limit: z.number().min(1).max(20).default(10).describe("Number of comments to fetch (1-20)"),
    post_id: z.number().optional().describe("Filter comments by post ID")
  },
  handler: async ({ limit, post_id }) => {
    try {
      let url = 'https://jsonplaceholder.typicode.com/comments';
      if (post_id) {
        url += `?postId=${post_id}`;
      }
      
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const comments: JSONPlaceholderComment[] = await response.json();
      const limitedComments = comments.slice(0, limit);

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({
              source: "JSONPlaceholder API",
              total_comments: comments.length,
              returned_comments: limitedComments.length,
              filter_post_id: post_id,
              comments: limitedComments,
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
            text: `Error fetching comments: ${error instanceof Error ? error.message : 'Unknown error'}`
          }
        ]
      };
    }
  }
};

// Quotes API Tool
const quotesApiTool: Tool = {
  name: "quotes_api",
  description: "Get inspirational quotes from Quotes REST API",
  schema: {
    limit: z.number().min(1).max(20).default(5).describe("Number of quotes to fetch (1-20)"),
    author: z.string().optional().describe("Filter quotes by author name"),
    tags: z.string().optional().describe("Filter quotes by tags (comma-separated)")
  },
  handler: async ({ limit, author, tags }) => {
    try {
      let url = 'https://api.quotable.io/quotes';
      const params = new URLSearchParams({
        limit: limit.toString()
      });
      
      if (author) {
        params.set('author', author);
      }
      
      if (tags) {
        params.set('tags', tags);
      }
      
      if (params.toString()) {
        url += `?${params.toString()}`;
      }
      
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      const quotes: QuoteData[] = data.results || data;

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({
              source: "Quotable API",
              total_quotes: data.count || quotes.length,
              returned_quotes: quotes.length,
              filter_author: author,
              filter_tags: tags,
              quotes: quotes,
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
            text: `Error fetching quotes: ${error instanceof Error ? error.message : 'Unknown error'}`
          }
        ]
      };
    }
  }
};

// Random User API Tool
const randomUserTool: Tool = {
  name: "random_user_api",
  description: "Generate random user data using Random User Generator API",
  schema: {
    limit: z.number().min(1).max(10).default(1).describe("Number of users to generate (1-10)"),
    gender: z.enum(['male', 'female']).optional().describe("Filter by gender"),
    nationality: z.string().optional().describe("Filter by nationality (e.g., 'US', 'GB', 'DE')")
  },
  handler: async ({ limit, gender, nationality }) => {
    try {
      let url = 'https://randomuser.me/api/';
      const params = new URLSearchParams({
        results: limit.toString()
      });
      
      if (gender) {
        params.set('gender', gender);
      }
      
      if (nationality) {
        params.set('nat', nationality);
      }
      
      if (params.toString()) {
        url += `?${params.toString()}`;
      }
      
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      const users: RandomUser[] = data.results || [];

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({
              source: "Random User Generator API",
              total_users: users.length,
              filter_gender: gender,
              filter_nationality: nationality,
              users: users,
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
            text: `Error generating random users: ${error instanceof Error ? error.message : 'Unknown error'}`
          }
        ]
      };
    }
  }
};

// Cat Facts API Tool
const catFactsTool: Tool = {
  name: "cat_facts_api",
  description: "Get random cat facts from Cat Facts API",
  schema: {
    limit: z.number().min(1).max(10).default(3).describe("Number of cat facts to fetch (1-10)")
  },
  handler: async ({ limit }) => {
    try {
      const facts = [];
      
      for (let i = 0; i < limit; i++) {
        const response = await fetch('https://catfact.ninja/fact');
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const fact = await response.json();
        facts.push(fact);
      }

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({
              source: "Cat Facts API",
              total_facts: facts.length,
              facts: facts,
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
            text: `Error fetching cat facts: ${error instanceof Error ? error.message : 'Unknown error'}`
          }
        ]
      };
    }
  }
};

// Dog CEO API Tool
const dogImagesTool: Tool = {
  name: "dog_images_api",
  description: "Get random dog images from Dog CEO API",
  schema: {
    limit: z.number().min(1).max(10).default(3).describe("Number of dog images to fetch (1-10)"),
    breed: z.string().optional().describe("Filter by dog breed (e.g., 'hound', 'poodle', 'retriever')")
  },
  handler: async ({ limit, breed }) => {
    try {
      let url = 'https://dog.ceo/api/breeds/image/random';
      
      if (breed) {
        url = `https://dog.ceo/api/breed/${breed}/images/random/${limit}`;
      } else {
        url += `/${limit}`;
      }
      
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      const images = data.message || [];
      
      // Convert single image to array for consistency
      const imageArray = Array.isArray(images) ? images : [images];

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({
              source: "Dog CEO API",
              total_images: imageArray.length,
              filter_breed: breed,
              images: imageArray.map((img: string, index: number) => ({
                id: `dog_${index}`,
                url: img,
                breed: breed || 'random'
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
            text: `Error fetching dog images: ${error instanceof Error ? error.message : 'Unknown error'}`
          }
        ]
      };
    }
  }
};

export const freeApisAdapter: Adapter = {
  name: "free-apis",
  description: "Collection of free APIs for testing and development",
  tools: [
    jsonPlaceholderUsersTool,
    jsonPlaceholderPostsTool,
    jsonPlaceholderCommentsTool,
    quotesApiTool,
    randomUserTool,
    catFactsTool,
    dogImagesTool
  ]
};
