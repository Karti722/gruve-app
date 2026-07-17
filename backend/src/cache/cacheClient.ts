import { config } from "../config";

export interface CacheSimResult {
  query: string;
  hit: boolean;
  matchedQuery: string | null;
  similarity: number;
}

export interface CacheSimResponse {
  results: CacheSimResult[];
  hitCount: number;
  missCount: number;
}

interface PythonCacheSimResult {
  query: string;
  hit: boolean;
  matched_query: string | null;
  similarity: number;
}

/**
 * Calls the Python service's semantic-cache simulation. No in-process
 * fallback: a standalone demo the rest of the app doesn't depend on, so
 * a clear error beats a silently degraded response.
 */
export async function simulateCache(queries: string[], threshold = 0.85): Promise<CacheSimResponse> {
  const res = await fetch(`${config.pythonEmbeddingServiceUrl}/cache-sim`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ queries, threshold }),
  });

  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { detail?: string };
    throw new Error(body.detail ?? `Semantic cache service responded ${res.status}`);
  }

  const data = (await res.json()) as {
    results: PythonCacheSimResult[];
    hit_count: number;
    miss_count: number;
  };

  return {
    results: data.results.map((r) => ({
      query: r.query,
      hit: r.hit,
      matchedQuery: r.matched_query,
      similarity: r.similarity,
    })),
    hitCount: data.hit_count,
    missCount: data.miss_count,
  };
}
