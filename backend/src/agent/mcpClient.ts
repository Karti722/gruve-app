import path from "path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { config } from "../config";
import type { ToolDefinition } from "../llm/types";

/**
 * Thin wrapper around the MCP TypeScript SDK's Client. The backend acts as
 * an MCP *client* here, spawning mcp-server/ as a child process over stdio
 * and discovering/calling its tools exactly like Claude Desktop or Claude
 * Code would. Connection is lazy and cached; if the MCP server hasn't been
 * built yet, every call fails soft so the rest of the agent demo still
 * works with just the local tools.
 */

let clientPromise: Promise<Client | null> | null = null;

function getClient(): Promise<Client | null> {
  if (!clientPromise) {
    clientPromise = connect();
  }
  return clientPromise;
}

async function connect(): Promise<Client | null> {
  try {
    const entry = path.resolve(__dirname, "../../", config.mcpServerEntry);
    const transport = new StdioClientTransport({
      command: process.execPath, // current Node binary
      args: [entry],
    });

    const client = new Client({ name: "ai-nexus-agent", version: "1.0.0" }, { capabilities: {} });
    await client.connect(transport);
    console.log(`[mcp] connected to MCP server at ${entry}`);
    return client;
  } catch (err) {
    console.warn(
      `[mcp] could not connect to MCP server (${(err as Error).message}). ` +
        `Run "npm run build --prefix mcp-server" first, or continue the agent demo with local tools only.`
    );
    return null;
  }
}

export async function getMcpTools(): Promise<ToolDefinition[]> {
  const client = await getClient();
  if (!client) return [];

  const { tools } = await client.listTools();
  return tools.map((t) => ({
    name: t.name,
    description: t.description ?? "",
    input_schema: (t.inputSchema ?? { type: "object", properties: {} }) as Record<string, unknown>,
  }));
}

export async function callMcpTool(name: string, input: Record<string, unknown>): Promise<string> {
  const client = await getClient();
  if (!client) return `MCP server unavailable: could not call tool "${name}".`;

  const result = await client.callTool({ name, arguments: input });
  const content = result.content as Array<{ type: string; text?: string }>;

  return content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("\n");
}
