import { config } from "../config";

// Must match python-service/app/embeddings.py's EMBEDDING_DIMS exactly: this
// value sets the pgvector column width in vectorStore.ts, so it has to equal
// the length of the vectors python-service actually returns (voyage-4-lite,
// requested at this exact output dimension).
export const EMBEDDING_DIMS = 1024;

const MAX_ATTEMPTS = 5;
const RETRY_DELAY_MS = 1000;

/**
 * Gets embeddings for a batch of texts by calling the Python microservice
 * (python-service/), which in turn calls Voyage AI's real embedding API;
 * see embeddings.py for why Voyage specifically. There is deliberately no
 * in-process fallback: an earlier version of this function silently
 * substituted a local hash embedding whenever python-service was
 * unreachable, which meant a transient failure during the one-time
 * knowledge-base seed (see seedDocuments.ts) could permanently seed the
 * vector store with embeddings from a different, less accurate algorithm
 * than every later live query uses, a silent, hard-to-diagnose
 * retrieval-quality bug rather than a visible error. Every caller
 * (rag.route.ts, tools.ts, seedDocuments.ts) already wraps its work in a
 * try/catch that returns a clean error response, so failing loudly here is
 * strictly safer than degrading silently.
 *
 * `inputType` threads through Voyage's documented "document" vs "query"
 * distinction for asymmetric retrieval quality: pass "document" when
 * embedding text that will be searched *against* (seedDocuments.ts's
 * knowledge-base chunks), "query" when embedding the text doing the
 * searching (rag.route.ts, tools.ts). Callers doing a symmetric comparison
 * instead (none in this file; see semantic_cache.py, summarizer.py) omit it.
 *
 * It does retry a few times first, on a short fixed delay: `npm run dev`
 * starts backend and python-service (a `uvicorn --reload` process, a couple
 * seconds slower to actually accept connections than to start) concurrently,
 * so backend's very first embedding call, the knowledge-base seed at
 * startup, can easily race python-service's own boot. That's an ordinary
 * timing race, not a real outage, so it's worth a few seconds of retrying
 * the identical, correct call before treating it as a genuine failure.
 */
export async function embedTexts(texts: string[], inputType?: "query" | "document"): Promise<number[][]> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);

    try {
      const res = await fetch(`${config.pythonEmbeddingServiceUrl}/embed`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ texts, input_type: inputType ?? null }),
        signal: controller.signal,
      });

      if (!res.ok) throw new Error(`embedding service responded ${res.status}`);

      const data = (await res.json()) as { embeddings: number[][] };
      return data.embeddings;
    } catch (err) {
      lastError = err;
      if (attempt < MAX_ATTEMPTS) {
        console.warn(
          `[embeddingsClient] attempt ${attempt}/${MAX_ATTEMPTS} failed (${(err as Error).message}), ` +
            `retrying in ${RETRY_DELAY_MS}ms...`
        );
        await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
      }
    } finally {
      clearTimeout(timeout);
    }
  }

  throw lastError;
}
