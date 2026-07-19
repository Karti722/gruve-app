import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";

/**
 * Standalone Model Context Protocol server. Runs as its own OS process,
 * completely decoupled from the Express backend: it communicates over
 * stdio using the MCP JSON-RPC framing, the same way it would if it were
 * plugged into Claude Desktop, Claude Code or any other MCP-compatible
 * host. backend/src/agent/mcpClient.ts spawns and talks to exactly this
 * process.
 *
 * Uses the low-level Server API with plain JSON-Schema tool definitions
 * (rather than the zod-based McpServer helper): the same schema shape
 * Anthropic's tool-use API expects, which keeps this file dependency-light
 * and avoids the high-level SDK layer's zod3/zod4 compatibility churn.
 */

const server = new Server(
  { name: "ai-nexus-mcp-server", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

const AI_CONCEPTS = [
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
      description: "Returns the real current weather for a given city, via WeatherAPI.com.",
      inputSchema: {
        type: "object",
        properties: { city: { type: "string", description: "City name, e.g. 'Austin'" } },
        required: ["city"],
      },
    },
    {
      name: "list_ai_concepts",
      description: "Lists the core AI/engineering concepts this demo app is built to showcase.",
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
    return getWeather(city);
  }

  if (name === "list_ai_concepts") {
    return {
      content: [{ type: "text", text: AI_CONCEPTS.map((c, i) => `${i + 1}. ${c}`).join("\n") }],
    };
  }

  throw new Error(`Unknown tool: ${name}`);
});

/**
 * Real current-weather lookup via WeatherAPI.com (weatherapi.com/docs/), a
 * genuinely free tier: 100,000 calls/month, no credit card. There is
 * deliberately no offline/mock fallback here: unlike a missing
 * VOYAGE_API_KEY, which would crash this whole app's Python service at
 * startup (see python-service/app/embeddings.py), a missing or invalid
 * MCP_WEATHER_API_KEY only ever fails this one tool call, returned as a
 * clear MCP tool error, since get_current_time and list_ai_concepts share
 * this same server process and have nothing to do with weather at all.
 */
async function getWeather(city: string) {
  const apiKey = process.env.MCP_WEATHER_API_KEY;
  if (!apiKey) {
    return {
      isError: true,
      content: [{ type: "text", text: "MCP_WEATHER_API_KEY is not configured; cannot fetch real weather data." }],
    };
  }

  const url = `https://api.weatherapi.com/v1/current.json?key=${encodeURIComponent(apiKey)}&q=${encodeURIComponent(city)}`;
  const response = await fetch(url);
  const body: any = await response.json();

  if (!response.ok) {
    const message = body?.error?.message ?? `WeatherAPI request failed with status ${response.status}.`;
    return { isError: true, content: [{ type: "text", text: `WeatherAPI error: ${message}` }] };
  }

  const { location, current } = body as {
    location: { name: string; region: string; country: string };
    current: { temp_f: number; temp_c: number; feelslike_f: number; condition: { text: string }; humidity: number };
  };

  return {
    content: [
      {
        type: "text",
        text:
          `${location.name}, ${location.region || location.country}: ${current.temp_f}°F ` +
          `(feels like ${current.feelslike_f}°F), ${current.condition.text}, ${current.humidity}% humidity. ` +
          `(Live data from WeatherAPI.com, fetched just now.)`,
      },
    ],
  };
}

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("[mcp-server] ai-nexus-mcp-server running on stdio");
}

main().catch((err) => {
  console.error("[mcp-server] fatal error:", err);
  process.exit(1);
});
