import cors from "cors";
import express from "express";
import { agentRouter } from "./routes/agent.route";
import { chatRouter } from "./routes/chat.route";
import { ragRouter } from "./routes/rag.route";
import { summarizeRouter } from "./routes/summarize.route";
import { config } from "./config";
import { seedKnowledgeBaseIfEmpty } from "./rag/seedDocuments";

const app = express();

app.use(cors({ origin: config.frontendUrls }));
app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", mockMode: config.isMockMode });
});

app.use("/api/chat", chatRouter);
app.use("/api/rag", ragRouter);
app.use("/api/agent", agentRouter);
app.use("/api/summarize", summarizeRouter);

async function main() {
  await seedKnowledgeBaseIfEmpty();

  app.listen(config.port, () => {
    console.log(`\n[server] AI Nexus backend listening on http://localhost:${config.port}`);
    console.log(`[server] LLM mode: ${config.isMockMode ? "MOCK (no ANTHROPIC_API_KEY set)" : "LIVE (Anthropic)"}\n`);
  });
}

main().catch((err) => {
  console.error("[server] fatal startup error:", err);
  process.exit(1);
});
