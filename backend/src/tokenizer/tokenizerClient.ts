import { config } from "../config";

export interface CostEstimate {
  model: string;
  inputCostUsd: number;
  inputRatePerMillion: number;
  outputRatePerMillion: number;
}

export interface TokenizeResult {
  tokens: string[];
  tokenCount: number;
  costEstimates: CostEstimate[];
}

interface PythonCostEstimate {
  model: string;
  input_cost_usd: number;
  input_rate_per_million: number;
  output_rate_per_million: number;
}

/**
 * Calls the Python service's real, from-scratch BPE tokenizer. No
 * in-process fallback: a standalone demo the rest of the app doesn't
 * depend on, so a clear error beats a silently degraded response.
 */
export async function tokenizeText(text: string): Promise<TokenizeResult> {
  const res = await fetch(`${config.pythonEmbeddingServiceUrl}/tokenize`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });

  if (!res.ok) {
    throw new Error(`Tokenizer service responded ${res.status}`);
  }

  const data = (await res.json()) as {
    tokens: string[];
    token_count: number;
    cost_estimates: PythonCostEstimate[];
  };

  return {
    tokens: data.tokens,
    tokenCount: data.token_count,
    costEstimates: data.cost_estimates.map((c) => ({
      model: c.model,
      inputCostUsd: c.input_cost_usd,
      inputRatePerMillion: c.input_rate_per_million,
      outputRatePerMillion: c.output_rate_per_million,
    })),
  };
}
