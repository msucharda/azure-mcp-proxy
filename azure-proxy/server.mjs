// Azure MCP Proxy — Progressive Tool Discovery
// Exposes ONE tool ("azure") to the LLM, routes to the real Azure MCP server internally.
// Supports both stdio (default) and HTTP transport (--http <port>).

import { Server } from "@modelcontextprotocol/sdk/server";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { Client } from "@modelcontextprotocol/sdk/client";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { ListToolsRequestSchema, CallToolRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { createServer } from "node:http";

// --- Configuration ---
const AZURE_MCP_COMMAND = process.env.AZURE_MCP_COMMAND || "npx";
const AZURE_MCP_ARGS = process.env.AZURE_MCP_ARGS
    ? process.env.AZURE_MCP_ARGS.split(" ")
    : ["-y", "@azure/mcp@latest", "server", "start"];

// --- State ---
let azureClient = null;
let toolCatalog = [];    // raw tool definitions from Azure MCP
let categories = {};     // { area: [tool, ...] }

// --- Azure MCP Client Lifecycle ---

async function connectToAzureMcp() {
    const client = new Client({ name: "azure-proxy", version: "1.0.0" });
    const transport = new StdioClientTransport({
        command: AZURE_MCP_COMMAND,
        args: AZURE_MCP_ARGS,
        env: process.env,
    });

    await client.connect(transport);
    return client;
}

async function cacheToolCatalog(client) {
    const result = await client.listTools();
    toolCatalog = result.tools || [];

    // Auto-categorize by tool name prefix (e.g., "compute_vm_get" → category "compute")
    categories = {};
    for (const tool of toolCatalog) {
        const parts = tool.name.split("_");
        const area = parts[0] || "other";
        if (!categories[area]) categories[area] = [];
        categories[area].push(tool);
    }

    console.error(`[azure-proxy] Cached ${toolCatalog.length} tools in ${Object.keys(categories).length} categories`);
}

function formatCategoryIndex() {
    const lines = Object.entries(categories)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([area, tools]) => {
            const names = tools.slice(0, 5).map(t => t.name).join(", ");
            const more = tools.length > 5 ? ` (+${tools.length - 5} more)` : "";
            return `• ${area} (${tools.length} tools): ${names}${more}`;
        });
    return [
        `Azure Tool Catalog — ${toolCatalog.length} tools in ${Object.keys(categories).length} categories:`,
        "",
        ...lines,
        "",
        'Call with mode:"discover" and category:"<name>" to see tool details.',
        'Call with mode:"execute", tool:"<tool_name>", and arguments:{...} to run a tool.',
    ].join("\n");
}

function formatCategoryTools(area) {
    const tools = categories[area];
    if (!tools) {
        return `Unknown category "${area}". Available: ${Object.keys(categories).sort().join(", ")}`;
    }
    const lines = tools.map(t => {
        const desc = t.description ? ` — ${t.description.slice(0, 120)}` : "";
        return `• ${t.name}${desc}`;
    });
    return [
        `Category "${area}" — ${tools.length} tools:`,
        "",
        ...lines,
    ].join("\n");
}

function formatToolDetail(toolName) {
    const tool = toolCatalog.find(t => t.name === toolName);
    if (!tool) {
        return `Unknown tool "${toolName}". Use mode:"discover" to browse available tools.`;
    }
    const schema = tool.inputSchema ? JSON.stringify(tool.inputSchema, null, 2) : "No parameters";
    return [
        `Tool: ${tool.name}`,
        tool.description ? `Description: ${tool.description}` : "",
        `Input Schema:`,
        schema,
    ].filter(Boolean).join("\n");
}

// --- MCP Proxy Server ---

const server = new Server(
    { name: "azure-proxy", version: "1.0.0" },
    { capabilities: { tools: {} } }
);

// Handle tools/list — expose just ONE tool
server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
        {
            name: "azure",
            description: [
                "Unified Azure tool — discover and execute any Azure operation.",
                "Modes: 'discover' (browse categories/tools), 'execute' (run a tool).",
                "Examples:",
                "  Discover all categories: {mode:'discover'}",
                "  Discover a category:    {mode:'discover', category:'compute'}",
                "  Tool details:           {mode:'discover', tool:'compute_vm_get'}",
                "  Execute a tool:         {mode:'execute', tool:'compute_vm_get', arguments:{...}}",
            ].join("\n"),
            inputSchema: {
                type: "object",
                properties: {
                    mode: {
                        type: "string",
                        enum: ["discover", "execute"],
                        description: "Operation mode. 'discover' to browse, 'execute' to run a tool.",
                    },
                    category: {
                        type: "string",
                        description: "Category name for discovery (e.g., 'compute', 'storage').",
                    },
                    tool: {
                        type: "string",
                        description: "Tool name to get details or execute (e.g., 'compute_vm_get').",
                    },
                    arguments: {
                        type: "object",
                        description: "Arguments to pass to the tool (execute mode only).",
                        additionalProperties: true,
                    },
                },
            },
        },
    ],
}));

// Handle tools/call — route the single "azure" tool
server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    if (name !== "azure") {
        return { content: [{ type: "text", text: `Unknown tool: ${name}` }], isError: true };
    }

    const mode = args?.mode || (args?.tool && args?.arguments ? "execute" : "discover");

    try {
        // --- Discover mode ---
        if (mode === "discover") {
            // Ensure catalog is loaded
            if (toolCatalog.length === 0 && azureClient) {
                await cacheToolCatalog(azureClient);
            }

            if (args?.tool) {
                return { content: [{ type: "text", text: formatToolDetail(args.tool) }] };
            }
            if (args?.category) {
                return { content: [{ type: "text", text: formatCategoryTools(args.category) }] };
            }
            return { content: [{ type: "text", text: formatCategoryIndex() }] };
        }

        // --- Execute mode ---
        if (mode === "execute") {
            if (!args?.tool) {
                return { content: [{ type: "text", text: "Execute mode requires 'tool' parameter." }], isError: true };
            }
            if (!azureClient) {
                return { content: [{ type: "text", text: "Azure MCP server not connected." }], isError: true };
            }

            const result = await azureClient.callTool({
                name: args.tool,
                arguments: args.arguments ?? {},
            });

            return result;
        }

        return { content: [{ type: "text", text: `Unknown mode: ${mode}. Use 'discover' or 'execute'.` }], isError: true };

    } catch (err) {
        return {
            content: [{ type: "text", text: `Error: ${err.message}` }],
            isError: true,
        };
    }
});

// --- CLI Args ---
function parseArgs() {
    const args = process.argv.slice(2);
    const opts = { httpPort: null };
    for (let i = 0; i < args.length; i++) {
        if (args[i] === "--http" && args[i + 1]) {
            opts.httpPort = parseInt(args[i + 1], 10);
            i++;
        }
    }
    return opts;
}

// --- Startup ---

async function main() {
    const opts = parseArgs();

    // 1. Connect to real Azure MCP server
    console.error("[azure-proxy] Connecting to Azure MCP server...");
    try {
        azureClient = await connectToAzureMcp();
        console.error("[azure-proxy] Connected to Azure MCP server");
        await cacheToolCatalog(azureClient);
    } catch (err) {
        console.error(`[azure-proxy] WARNING: Failed to connect to Azure MCP: ${err.message}`);
        console.error("[azure-proxy] Proxy will start but execute mode won't work until Azure MCP is available");
    }

    // 2. Start proxy server
    if (opts.httpPort) {
        // HTTP mode — for Docker/Harbor/remote access
        const httpServer = createServer(async (req, res) => {
            // Health check
            if (req.method === "GET" && req.url === "/health") {
                res.writeHead(200, { "Content-Type": "application/json" });
                res.end(JSON.stringify({ status: "ok", tools: toolCatalog.length }));
                return;
            }

            // MCP endpoint
            if (req.url === "/mcp") {
                const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
                res.setHeader("Access-Control-Allow-Origin", "*");
                res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
                res.setHeader("Access-Control-Allow-Headers", "Content-Type, Accept");
                if (req.method === "OPTIONS") {
                    res.writeHead(204);
                    res.end();
                    return;
                }
                await server.connect(transport);
                await transport.handleRequest(req, res);
                return;
            }

            res.writeHead(404);
            res.end("Not found");
        });

        httpServer.listen(opts.httpPort, "0.0.0.0", () => {
            console.error(`[azure-proxy] Proxy server running on http://0.0.0.0:${opts.httpPort}/mcp`);
        });
    } else {
        // stdio mode — for Copilot CLI direct integration
        const transport = new StdioServerTransport();
        await server.connect(transport);
        console.error("[azure-proxy] Proxy server running on stdio");
    }
}

main().catch((err) => {
    console.error(`[azure-proxy] Fatal error: ${err.message}`);
    process.exit(1);
});
