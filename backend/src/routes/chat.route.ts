import { Router } from "express";
import { config } from "../config";
import { llmClient } from "../llm";
import type { ChatMessage } from "../llm/types";
import { CHAT_SYSTEM_PROMPT } from "../prompts/systemPrompts";
import { describeError } from "../utils/errors";

export const chatRouter = Router();

/**
 * POST /api/chat
 * body: { message: string, history?: ChatMessage[] }
 * Plain LLM chat completion demo: no tools, no retrieval, just prompt
 * templating and multi-turn history.
 */
chatRouter.post("/", async (req, res) => {
  const { message, history } = req.body as { message?: string; history?: ChatMessage[] };

  if (!message || typeof message !== "string") {
    return res.status(400).json({ error: "Request body must include a string 'message' field." });
  }

  const messages: ChatMessage[] = [...(history ?? []), { role: "user", content: message }];

  try {
    const reply = await llmClient.chat(messages, CHAT_SYSTEM_PROMPT);
    res.json({ reply, mock: config.isMockMode });
  } catch (err) {
    console.error("[chat] error:", err);
    res.status(500).json({ error: `Failed to generate a chat response: ${describeError(err)}` });
  }
});
