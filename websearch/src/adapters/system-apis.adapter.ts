import { z } from "zod";
import { Tool, Adapter } from "./adapter.js";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

// Platform-specific browser opening commands
function getBrowserCommand(url: string): string {
  const platform = process.platform;
  
  switch (platform) {
    case 'darwin': // macOS
      return `open "${url}"`;
    case 'win32': // Windows
      return `start "" "${url}"`;
    case 'linux': // Linux
      return `xdg-open "${url}"`;
    default:
      throw new Error(`Unsupported platform: ${platform}`);
  }
}

// URL validation
function isValidUrl(url: string): boolean {
  try {
    const urlObj = new URL(url);
    return urlObj.protocol === 'http:' || urlObj.protocol === 'https:';
  } catch {
    return false;
  }
}

// Open URL in Browser Tool
const openUrlTool: Tool = {
  name: "open_url",
  description: "Open a URL in the system default browser",
  schema: {
    url: z.string().url().describe("The URL to open in the browser"),
    wait_time: z.number().min(0).max(10).default(0).describe("Wait time in seconds before opening (0-10)")
  },
  handler: async ({ url, wait_time }) => {
    try {
      // Validate URL
      if (!isValidUrl(url)) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Invalid URL: ${url}. Please provide a valid HTTP or HTTPS URL.`
            }
          ]
        };
      }

      // Wait if specified
      if (wait_time > 0) {
        await new Promise(resolve => setTimeout(resolve, wait_time * 1000));
      }

      // Get platform-specific command
      const command = getBrowserCommand(url);
      
      // Execute the command
      const { stdout, stderr } = await execAsync(command);
      
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({
              success: true,
              url: url,
              platform: process.platform,
              command: command,
              opened_at: new Date().toISOString(),
              message: `Successfully opened ${url} in your default browser`
            }, null, 2)
          }
        ]
      };

    } catch (error) {
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({
              success: false,
              url: url,
              platform: process.platform,
              error: error instanceof Error ? error.message : 'Unknown error',
              opened_at: new Date().toISOString(),
              message: `Failed to open ${url} in browser`
            }, null, 2)
          }
        ]
      };
    }
  }
};

// Multiple URLs Tool
const openMultipleUrlsTool: Tool = {
  name: "open_multiple_urls",
  description: "Open multiple URLs in the system default browser",
  schema: {
    urls: z.array(z.string().url()).min(1).max(10).describe("Array of URLs to open (1-10 URLs)"),
    delay_between: z.number().min(0).max(5).default(1).describe("Delay between opening URLs in seconds (0-5)"),
    wait_time: z.number().min(0).max(10).default(0).describe("Initial wait time before opening first URL (0-10)")
  },
  handler: async ({ urls, delay_between, wait_time }) => {
    try {
      // Validate all URLs
      const invalidUrls = urls.filter((url: string) => !isValidUrl(url));
      if (invalidUrls.length > 0) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Invalid URLs found: ${invalidUrls.join(', ')}. Please provide valid HTTP or HTTPS URLs.`
            }
          ]
        };
      }

      // Initial wait
      if (wait_time > 0) {
        await new Promise(resolve => setTimeout(resolve, wait_time * 1000));
      }

      const results = [];
      
      // Open each URL with delay
      for (let i = 0; i < urls.length; i++) {
        const url = urls[i];
        
        try {
          const command = getBrowserCommand(url as string);
          await execAsync(command);
          
          results.push({
            url: url,
            success: true,
            opened_at: new Date().toISOString()
          });
          
          // Delay between URLs (except for the last one)
          if (i < urls.length - 1 && delay_between > 0) {
            await new Promise(resolve => setTimeout(resolve, delay_between * 1000));
          }
          
        } catch (error) {
          results.push({
            url: url as string,
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
            opened_at: new Date().toISOString()
          });
        }
      }

      const successCount = results.filter(r => r.success).length;
      
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({
              total_urls: urls.length,
              successful_opens: successCount,
              failed_opens: urls.length - successCount,
              platform: process.platform,
              delay_between: delay_between,
              initial_wait: wait_time,
              results: results,
              completed_at: new Date().toISOString(),
              message: `Opened ${successCount} of ${urls.length} URLs successfully`
            }, null, 2)
          }
        ]
      };

    } catch (error) {
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({
              success: false,
              error: error instanceof Error ? error.message : 'Unknown error',
              completed_at: new Date().toISOString(),
              message: `Failed to process multiple URLs`
            }, null, 2)
          }
        ]
      };
    }
  }
};

export const systemApisAdapter: Adapter = {
  name: "system-apis",
  description: "System APIs for opening URLs and browser automation",
  tools: [
    openUrlTool,
    openMultipleUrlsTool
  ]
};
