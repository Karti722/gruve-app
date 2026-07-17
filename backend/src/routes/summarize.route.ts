import { Router } from "express";
import { summarizeText } from "../summarize/summarizeClient";
import { describeError } from "../utils/errors";

export const summarizeRouter = Router();

/**
 * POST /api/summarize
 * body: { text: string, sentenceCount?: number }
 * Extractive summarization demo: scores every sentence in the input with
 * TextRank and returns the top-scoring N, in their original reading order.
 */
summarizeRouter.post("/", async (req, res) => {
  const { text, sentenceCount } = req.body as { text?: string; sentenceCount?: number };

  if (!text || typeof text !== "string") {
    return res.status(400).json({ error: "Request body must include a string 'text' field." });
  }

  try {
    const result = await summarizeText(text, sentenceCount ?? 3);
    res.json(result);
  } catch (err) {
    console.error("[summarize] error:", err);
    res.status(500).json({ error: `Failed to summarize the text: ${describeError(err)}` });
  }
});
