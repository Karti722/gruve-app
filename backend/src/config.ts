import dotenv from "dotenv";
import path from "path";

// Load .env from the repo root so one file configures every service.
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

export const config = {
  port: Number(process.env.PORT ?? 4000),

  anthropicApiKey: process.env.ANTHROPIC_API_KEY ?? "",
  anthropicModel: process.env.ANTHROPIC_MODEL ?? "claude-sonnet-5",

  /** True when no API key is configured — the app falls back to canned,
   * clearly-labeled mock responses so the whole demo still runs end to end. */
  get isMockMode(): boolean {
    return this.anthropicApiKey.trim().length === 0;
  },

  pythonEmbeddingServiceUrl:
    process.env.PYTHON_EMBEDDING_SERVICE_URL ?? "http://localhost:8001",

  mcpServerEntry: process.env.MCP_SERVER_ENTRY ?? "../mcp-server/dist/index.js",
};
