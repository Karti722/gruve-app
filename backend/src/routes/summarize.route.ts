import { Router } from "express";
import { config } from "../config";
import { llmClient } from "../llm";
import { buildSummarizePrompt } from "../prompts/systemPrompts";
import { summarizeText } from "../summarize/summarizeClient";
import { describeError } from "../utils/errors";

export const summarizeRouter = Router();

/**
 * POST /api/summarize
 * body: { text: string, sentenceCount?: number, mode?: "abstractive" | "extractive" }
 *
 * Two independent summarization techniques, selectable per request:
 * - "abstractive" (default): asks the LLM to paraphrase the text in its own
 *   words, via buildSummarizePrompt, the same generation mechanism chat/RAG/
 *   agent already use. Costs a real model call; can compress and rephrase
 *   freely; cannot be fully trusted to never introduce a subtly-off claim.
 * - "extractive": the Python service's real TextRank algorithm, which
 *   selects and ranks the document's own sentences verbatim, plus term-
 *   frequency keyword extraction and Flesch-Kincaid readability scoring.
 *   Runs free, with no model call and no chance of inventing a claim, but
 *   can only ever rearrange sentences that already exist.
 * See Chapter 5's prose for the fuller cost/trust trade-off between them.
 */
summarizeRouter.post("/", async (req, res) => {
  const { text, sentenceCount, mode } = req.body as {
    text?: string;
    sentenceCount?: number;
    mode?: "abstractive" | "extractive";
  };

  if (!text || typeof text !== "string") {
    return res.status(400).json({ error: "Request body must include a string 'text' field." });
  }

  const resolvedMode = mode === "extractive" ? "extractive" : "abstractive";

  try {
    if (resolvedMode === "extractive") {
      const result = await summarizeText(text, sentenceCount ?? 3);
      return res.json({ mode: "extractive", ...result });
    }

    const systemPrompt = buildSummarizePrompt(sentenceCount ?? 3);
    const summary = await llmClient.chat([{ role: "user", content: text }], systemPrompt);
    res.json({ mode: "abstractive", summary, mock: config.isMockMode });
  } catch (err) {
    console.error("[summarize] error:", err);
    res.status(500).json({ error: `Failed to summarize the text: ${describeError(err)}` });
  }
});
