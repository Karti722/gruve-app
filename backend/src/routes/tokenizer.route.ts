import Anthropic from "@anthropic-ai/sdk";
import { Router } from "express";
import { config } from "../config";
import { describeError } from "../utils/errors";

export const tokenizerRouter = Router();

// Published per-million-token pricing, USD, current as of this writing: see
// platform.claude.com/docs/en/about-claude/pricing. Changes over time; this
// is illustrative, not a live-fetched price. Kept in sync by hand with the
// same rates this app's Anthropic client is actually configured against.
const MODEL_PRICING: Record<string, { inputPerMillion: number; outputPerMillion: number }> = {
  "claude-haiku-4-5": { inputPerMillion: 1.0, outputPerMillion: 5.0 },
  "claude-sonnet-5": { inputPerMillion: 2.0, outputPerMillion: 10.0 },
  "claude-opus-4-8": { inputPerMillion: 5.0, outputPerMillion: 25.0 },
};

function estimateCost(tokenCount: number) {
  return Object.entries(MODEL_PRICING).map(([model, pricing]) => ({
    model,
    inputCostUsd: Number(((tokenCount / 1_000_000) * pricing.inputPerMillion).toFixed(6)),
    inputRatePerMillion: pricing.inputPerMillion,
    outputRatePerMillion: pricing.outputPerMillion,
  }));
}

// Anthropic's token-counting endpoint (POST /v1/messages/count_tokens) is
// still under the SDK's `beta` namespace in @anthropic-ai/sdk 0.32.x; the
// call itself is a stable, generally-available API, not an experimental
// feature, this is purely an SDK-version quirk.
const anthropic = new Anthropic({ apiKey: config.anthropicApiKey });

/**
 * POST /api/tokenize
 * body: { text: string }
 * Returns the exact token count Anthropic's own API reports for the text
 * (via the real, free /v1/messages/count_tokens endpoint), plus a per-model
 * cost estimate at published rates. Replaces an earlier from-scratch BPE
 * tokenizer: that implementation was a real algorithm, but its token
 * boundaries never matched Claude's actual tokenizer, which meant the "cost
 * to run this on claude-sonnet-5" figure shown next to it was never quite
 * right for the very model it named. This endpoint asks Claude directly
 * instead, so the count is exact for whichever model `ANTHROPIC_MODEL` is
 * set to. Requires a real ANTHROPIC_API_KEY; there is no mock fallback here
 * (unlike chat/RAG/agent/summarize), since a fabricated token count would
 * undermine the entire point of this endpoint, an exact number.
 */
tokenizerRouter.post("/", async (req, res) => {
  const { text } = req.body as { text?: string };

  if (!text || typeof text !== "string") {
    return res.status(400).json({ error: "Request body must include a string 'text' field." });
  }

  try {
    const result = await anthropic.beta.messages.countTokens({
      model: config.anthropicModel,
      messages: [{ role: "user", content: text }],
    });

    res.json({ tokenCount: result.input_tokens, costEstimates: estimateCost(result.input_tokens) });
  } catch (err) {
    console.error("[tokenize] error:", err);
    res.status(500).json({ error: `Failed to count tokens: ${describeError(err)}` });
  }
});
