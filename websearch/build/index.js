import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import express from "express";
import getRawBody from "raw-body";
import { randomUUID } from "crypto";
import { toolRegistry, webSearchAdapter, socialMediaAdapter, contentAdapter, xPostsAdapter, pornHubAdapter, pornPicsAdapter, freeApisAdapter, productivityApisAdapter, systemApisAdapter, terminalApisAdapter } from "./adapters/index.js";
const server = new McpServer({
    name: "websearch",
    version: "0.1.0",
});
// Register all adapters
toolRegistry.register(webSearchAdapter);
toolRegistry.register(socialMediaAdapter);
toolRegistry.register(contentAdapter);
toolRegistry.register(xPostsAdapter);
toolRegistry.register(pornHubAdapter);
toolRegistry.register(pornPicsAdapter);
toolRegistry.register(freeApisAdapter);
toolRegistry.register(productivityApisAdapter);
toolRegistry.register(systemApisAdapter);
toolRegistry.register(terminalApisAdapter);
// Register all tools with the MCP server
const allTools = toolRegistry.getAllTools();
allTools.forEach(tool => {
    server.tool(tool.name, tool.description, tool.schema, tool.handler);
});
// MCP Resource registration
server.resource("mcp://websearch", "Web Search MCP Server", async () => ({
    contents: [{
            uri: "mcp://websearch",
            mimeType: "text/plain",
            text: "Use the get_links tool to search the web using SearXNG.\n\nExample usage:\n- Call get_links with query: 'latest technology trends 2025'\n- Optional categories parameter: 'general,web', 'news', 'images', etc.\n- Returns up to 6 search results with titles, URLs, and snippets."
        }]
}));
async function main() {
    const transportMode = (process.env.TRANSPORT || "http").toLowerCase();
    if (transportMode === "stdio") {
        const transport = new StdioServerTransport();
        await server.connect(transport);
        console.error("websearch-searxng MCP server running on stdio");
        // Keep the process alive indefinitely for stdio transport
        return new Promise(() => { });
    }
    else {
        const app = express();
        app.use(express.json());
        const transport = new StreamableHTTPServerTransport({
            enableJsonResponse: true,
            sessionIdGenerator: () => randomUUID(),
        });
        await server.connect(transport);
        // POST /mcp handles JSON-RPC messages; body must be raw for JSON-RPC parsing
        app.post("/mcp", async (req, res) => {
            try {
                const body = await getRawBody(req, { encoding: "utf8" });
                await transport.handleRequest(req, res, body);
            }
            catch (err) {
                console.error("POST /mcp error", err);
                if (!res.headersSent) {
                    res.status(500).json({ error: "Internal server error" });
                }
            }
        });
        // GET /mcp for SSE stream
        app.get("/mcp", async (req, res) => {
            try {
                await transport.handleRequest(req, res);
            }
            catch (err) {
                console.error("GET /mcp error", err);
                if (!res.headersSent) {
                    res.status(500).json({ error: "Internal server error" });
                }
            }
        });
        // DELETE /mcp to close session
        app.delete("/mcp", async (req, res) => {
            try {
                await transport.handleRequest(req, res);
            }
            catch (err) {
                console.error("DELETE /mcp error", err);
                if (!res.headersSent) {
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
