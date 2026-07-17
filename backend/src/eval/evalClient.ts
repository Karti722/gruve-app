import { config } from "../config";

export interface EvaluateResult {
  exactMatch: boolean;
  rougeL: number;
  semanticSimilarity: number;
  compositeScore: number;
}

/**
 * Calls the Python service's LLM-output evaluation harness. No in-process
 * fallback: a standalone demo the rest of the app doesn't depend on, so
 * a clear error beats a silently degraded response.
 */
export async function evaluateOutput(candidate: string, reference: string): Promise<EvaluateResult> {
  const res = await fetch(`${config.pythonEmbeddingServiceUrl}/evaluate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ candidate, reference }),
  });

  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { detail?: string };
    throw new Error(body.detail ?? `Evaluation service responded ${res.status}`);
  }

  const data = (await res.json()) as {
    exact_match: boolean;
    rouge_l: number;
    semantic_similarity: number;
    composite_score: number;
  };

  return {
    exactMatch: data.exact_match,
    rougeL: data.rouge_l,
    semanticSimilarity: data.semantic_similarity,
    compositeScore: data.composite_score,
  };
}
