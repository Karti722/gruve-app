"""
Extractive text summarization using TextRank (Mihalcea & Tarau, 2004): a
graph-based ranking algorithm that adapts the same random-walk idea behind
Google's original PageRank to sentences instead of web pages.

No language model is used, and no new sentence-similarity mechanism is
introduced either: sentences are embedded with this service's existing
`embed_text` (see embeddings.py) and compared with cosine similarity,
the same building blocks the RAG demo already uses. A sentence that's
similar to many other sentences in the document sits at a hub of the
similarity graph and scores highly; a tangential aside, similar to few
other sentences, scores low. The top-scoring sentences are returned in
their original order to read as a coherent extract.
"""

import re
from typing import List, TypedDict

from app.embeddings import embed_text

# Splits after sentence-ending punctuation, only when followed by whitespace
# and then a capital letter or digit, good enough for the well-formed
# prose this demo expects, without pulling in a full NLP sentence tokenizer.
_SENTENCE_SPLIT_RE = re.compile(r"(?<=[.!?])\s+(?=[A-Z0-9\"'])")


class RankedSentence(TypedDict):
    text: str
    index: int
    score: float


def split_sentences(text: str) -> List[str]:
    candidates = _SENTENCE_SPLIT_RE.split(text.strip())
    return [s.strip() for s in candidates if s.strip()]


def _cosine_similarity(a: List[float], b: List[float]) -> float:
    # embed_text already returns unit-length vectors, so the dot product
    # alone is the cosine similarity, no need to divide by magnitudes.
    return max(sum(x * y for x, y in zip(a, b)), 0.0)


def _text_rank_scores(similarity: List[List[float]], damping: float = 0.85, iterations: int = 30) -> List[float]:
    """Power-iteration PageRank over the sentence similarity graph."""
    n = len(similarity)
    if n == 0:
        return []

    row_sums = [sum(row) or 1.0 for row in similarity]
    transition = [[similarity[i][j] / row_sums[i] for j in range(n)] for i in range(n)]

    scores = [1.0 / n] * n
    for _ in range(iterations):
        next_scores = [(1 - damping) / n] * n
        for i in range(n):
            incoming = sum(transition[j][i] * scores[j] for j in range(n))
            next_scores[i] += damping * incoming
        scores = next_scores

    return scores


def summarize(text: str, sentence_count: int = 3) -> List[RankedSentence]:
    sentences = split_sentences(text)
    if not sentences:
        return []
    if len(sentences) <= sentence_count:
        return [{"text": s, "index": i, "score": 1.0} for i, s in enumerate(sentences)]

    vectors = [embed_text(s) for s in sentences]
    similarity = [[_cosine_similarity(a, b) for b in vectors] for a in vectors]
    scores = _text_rank_scores(similarity)

    top_indices = sorted(range(len(sentences)), key=lambda i: scores[i], reverse=True)[:sentence_count]
    top_indices.sort()  # restore original reading order

    return [{"text": sentences[i], "index": i, "score": round(scores[i], 4)} for i in top_indices]
