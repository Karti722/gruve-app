import dotenv from "dotenv";
import path from "path";

// Load .env from the repo root so one file configures every service.
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

export const config = {
  port: Number(process.env.PORT ?? 4000),

  anthropicApiKey: process.env.ANTHROPIC_API_KEY ?? "",
  anthropicModel: process.env.ANTHROPIC_MODEL ?? "claude-sonnet-5",

  /** True when no API key is configured: the app falls back to canned,
   * clearly-labeled mock responses so the whole demo still runs end to end. */
  get isMockMode(): boolean {
    return this.anthropicApiKey.trim().length === 0;
  },

  pythonEmbeddingServiceUrl:
    process.env.PYTHON_EMBEDDING_SERVICE_URL ?? "http://localhost:8001",

  /** Origin(s) allowed to call this API from a browser (CORS), comma-separated.
   * Defaults to the local frontend dev server. In production this must be set
   * to the frontend's real public URL: an open origin policy would let any
   * other website's JS call this backend (and spend your Anthropic budget)
   * directly from a visitor's browser. */
  frontendUrls: (process.env.FRONTEND_URL ?? "http://localhost:3000")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),

  mcpServerEntry: process.env.MCP_SERVER_ENTRY ?? "../mcp-server/dist/index.js",

  /** pgvector-enabled Postgres instance backing the RAG vector store. Port
   * 5433 (not 5432) so it doesn't clash with a default local Postgres. */
  postgresUrl:
    process.env.POSTGRES_URL ?? "postgresql://nexus:nexus@localhost:5433/nexus_vectors",
};
