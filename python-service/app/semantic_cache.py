"""
Semantic caching: instead of only reusing a cached response when a new
request's text matches a previous one *exactly*, a semantic cache reuses
it whenever the new request's embedding is close enough (by cosine
similarity) to a previous one already in the cache, catching paraphrases
and near-duplicates that a plain string-match cache would miss entirely.
Production LLM systems lean on this heavily: a cache hit skips the model
call completely, at whatever the going per-token rate happens to be (see
tokenizer.py), one of the highest-leverage, lowest-effort cost
optimizations available once a system is handling real traffic.

This demo processes a list of queries in order against a running,
in-memory cache and reports, for each one, whether it hit an existing
entry (and which one, and how similar) or was a miss that got added.
"""

from typing import List, Optional

from app.embeddings import embed_text


def _cosine_similarity(a: List[float], b: List[float]) -> float:
    return max(sum(x * y for x, y in zip(a, b)), 0.0)


def run_cache_simulation(queries: List[str], threshold: float = 0.85) -> List[dict]:
    cache: List[dict] = []
    results: List[dict] = []

    for raw_query in queries:
        query = raw_query.strip()
        if not query:
            continue
        embedding = embed_text(query)

        best_match: Optional[str] = None
        best_similarity = 0.0
        for entry in cache:
            similarity = _cosine_similarity(embedding, entry["embedding"])
            if similarity > best_similarity:
                best_similarity = similarity
                best_match = entry["text"]

        hit = best_match is not None and best_similarity >= threshold
        results.append(
            {
                "query": query,
                "hit": hit,
                "matched_query": best_match if hit else None,
                "similarity": round(best_similarity, 4),
            }
        )

        if not hit:
            cache.append({"text": query, "embedding": embedding})

    return results
