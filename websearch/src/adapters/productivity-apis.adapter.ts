import { z } from "zod";
import { Tool, Adapter } from "./adapter.js";

// Types for productivity APIs
interface TodoItem {
  userId: number;
  id: number;
  title: string;
  completed: boolean;
}

interface Post {
  userId: number;
  id: number;
  title: string;
  body: string;
}

interface Album {
  userId: number;
  id: number;
  title: string;
}

interface Photo {
  albumId: number;
  id: number;
  title: string;
  url: string;
  thumbnailUrl: string;
}

interface Comment {
  postId: number;
  id: number;
  name: string;
  email: string;
  body: string;
}

interface User {
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

// JSONPlaceholder Todos Tool
const jsonPlaceholderTodosTool: Tool = {
  name: "jsonplaceholder_todos",
  description: "Get todo items from JSONPlaceholder API for testing",
  schema: {
    limit: z.number().min(1).max(20).default(10).describe("Number of todos to fetch (1-20)"),
    completed: z.boolean().optional().describe("Filter by completion status"),
    user_id: z.number().optional().describe("Filter by user ID")
  },
  handler: async ({ limit, completed, user_id }) => {
    try {
      let url = 'https://jsonplaceholder.typicode.com/todos';
      const params = new URLSearchParams();
      
      if (completed !== undefined) {
        params.set('completed', completed.toString());
      }
      
      if (user_id) {
        params.set('userId', user_id.toString());
      }
      
      if (params.toString()) {
        url += `?${params.toString()}`;
      }
      
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const todos: TodoItem[] = await response.json();
      const limitedTodos = todos.slice(0, limit);

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({
              source: "JSONPlaceholder API",
              total_todos: todos.length,
              returned_todos: limitedTodos.length,
              filters: {
                completed,
                user_id
              },
              todos: limitedTodos,
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
            text: `Error fetching todos: ${error instanceof Error ? error.message : 'Unknown error'}`
          }
        ]
      };
    }
  }
};

// JSONPlaceholder Albums Tool
const jsonPlaceholderAlbumsTool: Tool = {
  name: "jsonplaceholder_albums",
  description: "Get photo albums from JSONPlaceholder API for testing",
  schema: {
    limit: z.number().min(1).max(20).default(10).describe("Number of albums to fetch (1-20)"),
    user_id: z.number().optional().describe("Filter by user ID")
  },
  handler: async ({ limit, user_id }) => {
    try {
      let url = 'https://jsonplaceholder.typicode.com/albums';
      
      if (user_id) {
        url += `?userId=${user_id}`;
      }
      
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const albums: Album[] = await response.json();
      const limitedAlbums = albums.slice(0, limit);

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({
              source: "JSONPlaceholder API",
              total_albums: albums.length,
              returned_albums: limitedAlbums.length,
              filter_user_id: user_id,
              albums: limitedAlbums,
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
            text: `Error fetching albums: ${error instanceof Error ? error.message : 'Unknown error'}`
          }
        ]
      };
    }
  }
};

// JSONPlaceholder Photos Tool
const jsonPlaceholderPhotosTool: Tool = {
  name: "jsonplaceholder_photos",
  description: "Get photos from JSONPlaceholder API for testing",
  schema: {
    limit: z.number().min(1).max(50).default(20).describe("Number of photos to fetch (1-50)"),
    album_id: z.number().optional().describe("Filter by album ID")
  },
  handler: async ({ limit, album_id }) => {
    try {
      let url = 'https://jsonplaceholder.typicode.com/photos';
      
      if (album_id) {
        url += `?albumId=${album_id}`;
      }
      
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const photos: Photo[] = await response.json();
      const limitedPhotos = photos.slice(0, limit);

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({
              source: "JSONPlaceholder API",
              total_photos: photos.length,
              returned_photos: limitedPhotos.length,
              filter_album_id: album_id,
              photos: limitedPhotos.map(photo => ({
                id: photo.id,
                title: photo.title,
                url: photo.url,
                thumbnail_url: photo.thumbnailUrl,
                album_id: photo.albumId
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
            text: `Error fetching photos: ${error instanceof Error ? error.message : 'Unknown error'}`
          }
        ]
      };
    }
  }
};

// HTTPBin Testing Tool
const httpbinTool: Tool = {
  name: "httpbin_test",
  description: "Test HTTP requests with HTTPBin API",
  schema: {
    method: z.enum(['get', 'post', 'put', 'patch', 'delete']).default('get').describe("HTTP method to test"),
    endpoint: z.string().default('/get').describe("HTTPBin endpoint to test"),
    data: z.string().optional().describe("Data to send (for POST/PUT/PATCH)"),
    headers: z.record(z.string()).optional().describe("Custom headers to send")
  },
  handler: async ({ method, endpoint, data, headers }) => {
    try {
      const baseUrl = 'https://httpbin.org';
      const url = `${baseUrl}${endpoint}`;
      
      const options: RequestInit = {
        method: method.toUpperCase(),
        headers: {
          'Content-Type': 'application/json',
          ...headers
        }
      };

      if (data && ['POST', 'PUT', 'PATCH'].includes(method.toUpperCase())) {
        options.body = data;
      }

      const response = await fetch(url, options);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({
              source: "HTTPBin API",
              method: method.toUpperCase(),
              endpoint: endpoint,
              status_code: response.status,
              status_text: response.statusText,
              response_headers: Object.fromEntries(response.headers.entries()),
              result: result,
              sent_data: data,
              sent_headers: headers,
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
            text: `Error testing HTTP request: ${error instanceof Error ? error.message : 'Unknown error'}`
          }
        ]
      };
    }
  }
};

// JSONPlaceholder Complete Data Tool
const jsonPlaceholderCompleteTool: Tool = {
  name: "jsonplaceholder_complete",
  description: "Get complete dataset from JSONPlaceholder API",
  schema: {
    include_users: z.boolean().default(true).describe("Include users data"),
    include_posts: z.boolean().default(true).describe("Include posts data"),
    include_comments: z.boolean().default(true).describe("Include comments data"),
    include_albums: z.boolean().default(true).describe("Include albums data"),
    include_photos: z.boolean().default(true).describe("Include photos data"),
    include_todos: z.boolean().default(true).describe("Include todos data")
  },
  handler: async ({ include_users, include_posts, include_comments, include_albums, include_photos, include_todos }) => {
    try {
      const results: any = {
        source: "JSONPlaceholder API",
        fetched_at: new Date().toISOString(),
        data: {}
      };

      const promises = [];

      if (include_users) {
        promises.push(
          fetch('https://jsonplaceholder.typicode.com/users')
            .then(res => res.json())
            .then(users => { results.data.users = users; })
        );
      }

      if (include_posts) {
        promises.push(
          fetch('https://jsonplaceholder.typicode.com/posts')
            .then(res => res.json())
            .then(posts => { results.data.posts = posts; })
        );
      }

      if (include_comments) {
        promises.push(
          fetch('https://jsonplaceholder.typicode.com/comments')
            .then(res => res.json())
            .then(comments => { results.data.comments = comments; })
        );
      }

      if (include_albums) {
        promises.push(
          fetch('https://jsonplaceholder.typicode.com/albums')
            .then(res => res.json())
            .then(albums => { results.data.albums = albums; })
        );
      }

      if (include_photos) {
        promises.push(
          fetch('https://jsonplaceholder.typicode.com/photos')
            .then(res => res.json())
            .then(photos => { results.data.photos = photos; })
        );
      }

      if (include_todos) {
        promises.push(
          fetch('https://jsonplaceholder.typicode.com/todos')
            .then(res => res.json())
            .then(todos => { results.data.todos = todos; })
        );
      }

      await Promise.all(promises);

      // Add summary statistics
      results.summary = {
        users: results.data.users?.length || 0,
        posts: results.data.posts?.length || 0,
        comments: results.data.comments?.length || 0,
        albums: results.data.albums?.length || 0,
        photos: results.data.photos?.length || 0,
        todos: results.data.todos?.length || 0
      };

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(results, null, 2)
          }
        ]
      };

    } catch (error) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Error fetching complete dataset: ${error instanceof Error ? error.message : 'Unknown error'}`
          }
        ]
      };
    }
  }
};

// UUID Generator Tool
const uuidGeneratorTool: Tool = {
  name: "uuid_generator",
  description: "Generate UUIDs using HTTPBin UUID service",
  schema: {
    count: z.number().min(1).max(100).default(1).describe("Number of UUIDs to generate (1-100)")
  },
  handler: async ({ count }) => {
    try {
      const promises = Array.from({ length: count }, () => 
        fetch('https://httpbin.org/uuid').then(res => res.json())
      );

      const results = await Promise.all(promises);
      const uuids = results.map(result => result.uuid);

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({
              source: "HTTPBin UUID API",
              total_uuids: uuids.length,
              uuids: uuids,
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
            text: `Error generating UUIDs: ${error instanceof Error ? error.message : 'Unknown error'}`
          }
        ]
      };
    }
  }
};

export const productivityApisAdapter: Adapter = {
  name: "productivity-apis",
  description: "Productivity and testing APIs for development and data management",
  tools: [
    jsonPlaceholderTodosTool,
    jsonPlaceholderAlbumsTool,
    jsonPlaceholderPhotosTool,
    httpbinTool,
    jsonPlaceholderCompleteTool,
    uuidGeneratorTool
  ]
};
