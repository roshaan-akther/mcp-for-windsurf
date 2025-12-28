#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

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

async function runServer() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("websearch MCP server running on stdio");
}

runServer().catch((err) => {
  console.error("Fatal error", err);
  process.exit(1);
});
