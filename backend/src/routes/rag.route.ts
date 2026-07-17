import { Router } from "express";
import { config } from "../config";
import { llmClient } from "../llm";
import { buildRagPrompt } from "../prompts/systemPrompts";
import { embedTexts } from "../rag/embeddingsClient";
import { getKnowledgeBaseTitle, listKnowledgeBaseFiles, readKnowledgeBaseFile } from "../rag/knowledgeBaseFiles";
import { searchSimilar } from "../rag/vectorStore";
import { describeError } from "../utils/errors";

export const ragRouter = Router();

/**
 * POST /api/rag/query
 * body: { question: string }
 * Full retrieval-augmented generation pipeline: embed the question, do a
 * cosine-similarity search against the seeded knowledge base, then ask the
 * LLM to answer using only the retrieved passages, cited by number.
 */
ragRouter.post("/query", async (req, res) => {
  const { question } = req.body as { question?: string };

  if (!question || typeof question !== "string") {
    return res.status(400).json({ error: "Request body must include a string 'question' field." });
  }

  try {
    const [queryEmbedding] = await embedTexts([question]);
    const matches = await searchSimilar(queryEmbedding, 4);

    const contextChunks = matches.map((m, i) => ({ id: i + 1, source: m.source, text: m.text }));
    const systemPrompt = buildRagPrompt(contextChunks);

    const answer = await llmClient.chat([{ role: "user", content: question }], systemPrompt);

    res.json({
      answer,
      sources: matches.map((m, i) => ({
        citation: i + 1,
        source: m.source,
        title: getKnowledgeBaseTitle(m.source),
        text: m.text,
        similarity: Number(m.score.toFixed(3)),
      })),
      mock: config.isMockMode,
    });
  } catch (err) {
    console.error("[rag] error:", err);
    res.status(500).json({ error: `Failed to answer the question: ${describeError(err)}` });
  }
});

/**
 * GET /api/rag/sources
 * Lists every article in the knowledge base (id + display title) so the
 * frontend can offer a "browse the knowledge base yourself" picker.
 */
ragRouter.get("/sources", (_req, res) => {
  res.json({ sources: listKnowledgeBaseFiles() });
});

/**
 * GET /api/rag/sources/:source
 * Full content of a single knowledge-base article, for the same browser.
 */
ragRouter.get("/sources/:source", (req, res) => {
  const file = readKnowledgeBaseFile(req.params.source);
  if (!file) {
    return res.status(404).json({ error: "That knowledge base article doesn't exist." });
  }
  res.json(file);
});
