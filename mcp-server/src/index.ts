import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";

/**
 * Standalone Model Context Protocol server. Runs as its own OS process,
 * completely decoupled from the Express backend — it communicates over
 * stdio using the MCP JSON-RPC framing, the same way it would if it were
 * plugged into Claude Desktop, Claude Code, or any other MCP-compatible
 * host. backend/src/agent/mcpClient.ts spawns and talks to exactly this
 * process.
 *
 * Uses the low-level Server API with plain JSON-Schema tool definitions
 * (rather than the zod-based McpServer helper) — the same schema shape
 * Anthropic's tool-use API expects, which keeps this file dependency-light
 * and avoids the high-level SDK layer's zod3/zod4 compatibility churn.
 */

const server = new Server(
  { name: "gruve-mcp-server", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

const WEATHER_CONDITIONS = ["sunny", "partly cloudy", "overcast", "light rain", "clear skies"];

const JOB_CONCEPTS = [
  "Large Language Models (LLMs)",
  "Retrieval-Augmented Generation (RAG)",
  "Prompt engineering",
  "AI agents and tool use",
  "Model Context Protocol (MCP)",
  "Vector databases and embeddings",
  "React/Next.js frontends",
  "REST APIs and microservices",
  "Docker and container orchestration",
  "AI-assisted coding tools (Cursor, Claude Code, Copilot)",
];

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "get_current_time",
      description: "Returns the current server date and time in ISO-8601 format.",
      inputSchema: { type: "object", properties: {} },
    },
    {
      name: "get_weather",
      description: "Returns a mock current-weather report for a given city. Demo data only, not a live API.",
      inputSchema: {
        type: "object",
        properties: { city: { type: "string", description: "City name, e.g. 'Austin'" } },
        required: ["city"],
      },
    },
    {
      name: "list_job_concepts",
      description:
        "Lists the AI/engineering concepts this demo app was built to showcase, straight from the job posting it targets.",
      inputSchema: { type: "object", properties: {} },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  if (name === "get_current_time") {
    return { content: [{ type: "text", text: new Date().toISOString() }] };
  }

  if (name === "get_weather") {
    const city = String((args as { city?: string })?.city ?? "");
    const seed = hashString(city.toLowerCase());
    const tempF = 55 + (seed % 40);
    const condition = WEATHER_CONDITIONS[seed % WEATHER_CONDITIONS.length];
    return {
      content: [
        { type: "text", text: `${city}: ${tempF}°F, ${condition} (mock data served by the MCP tool server).` },
      ],
    };
  }

  if (name === "list_job_concepts") {
    return {
      content: [{ type: "text", text: JOB_CONCEPTS.map((c, i) => `${i + 1}. ${c}`).join("\n") }],
    };
  }

  throw new Error(`Unknown tool: ${name}`);
});

function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash * 31 + value.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("[mcp-server] gruve-mcp-server running on stdio");
}

main().catch((err) => {
  console.error("[mcp-server] fatal error:", err);
  process.exit(1);
});
