import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
const server = new McpServer({
    name: "websearch",
    version: "0.1.0",
});
// Simple test tool
server.tool("test_tool", "A simple test tool", {
    message: z.string().describe("Test message")
}, async ({ message }) => {
    return {
        content: [
            {
                type: "text",
                text: `Test response: ${message}`
            }
        ]
    };
});
async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("websearch-searxng MCP server running on stdio");
    // Keep the process alive indefinitely for stdio transport
    return new Promise(() => { });
}
main().catch((err) => {
    console.error("Fatal error", err);
    process.exit(1);
});
