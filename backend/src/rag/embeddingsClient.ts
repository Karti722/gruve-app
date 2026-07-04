import { config } from "../config";

const EMBEDDING_DIMS = 256;

/**
 * Gets embeddings for a batch of texts. Prefers the Python microservice
 * (python-service/) so the "polyglot microservices" and "vector embeddings"
 * concepts are demonstrated end to end; if that service is unreachable
 * (not started, still booting, etc.) it transparently falls back to an
 * identical deterministic hashing embedding computed in-process, so the RAG
 * demo never hard-fails just because one service is down.
 */
export async function embedTexts(texts: string[]): Promise<number[][]> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);

    const res = await fetch(`${config.pythonEmbeddingServiceUrl}/embed`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ texts }),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) throw new Error(`embedding service responded ${res.status}`);

    const data = (await res.json()) as { embeddings: number[][] };
    return data.embeddings;
  } catch (err) {
    console.warn(
      `[embeddingsClient] python-service unreachable (${(err as Error).message}); ` +
        `using in-process fallback embedding instead.`
    );
    // NOTE: must be wrapped in an arrow fn — Array.map passes (value, index,
    // array) to its callback, and index would otherwise silently clobber
    // localHashEmbedding's `dims` parameter.
    return texts.map((text) => localHashEmbedding(text));
  }
}

/** Deterministic hashing ("bag of words") embedding — no ML model required.
 * Same algorithm the Python service falls back to, so results stay
 * consistent whichever path served the request. Good enough for keyword-ish
 * semantic similarity in a demo; swap for real sentence-transformer or
 * OpenAI embeddings in production. */
export function localHashEmbedding(text: string, dims = EMBEDDING_DIMS): number[] {
  const vector = new Array(dims).fill(0);
  const words = text.toLowerCase().match(/[a-z0-9]+/g) ?? [];

  for (const word of words) {
    vector[hashString(word) % dims] += 1;
  }

  const norm = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0)) || 1;
  return vector.map((v) => v / norm);
}

function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash * 31 + value.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}
