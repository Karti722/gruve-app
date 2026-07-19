"""
Evaluating LLM outputs: scoring a model's response against a reference
answer instead of eyeballing it, which is what actually lets a team ship
changes to a prompt or model with confidence instead of guesswork. Real
eval pipelines often spend a model call on an "LLM-as-judge" for nuanced
grading, but that's expensive to run on every single case, so they
typically run cheaper, deterministic signals first: exact match, a
longest-common-subsequence overlap score (the same idea behind ROUGE-L, a
standard summarization/translation metric; Lin, 2004) and embedding-based
semantic similarity (see embeddings.py) for catching answers that are
correct but phrased differently. This demo runs exactly those three.
"""

from typing import List

from app.embeddings import embed_batch


def _cosine_similarity(a: List[float], b: List[float]) -> float:
    return max(sum(x * y for x, y in zip(a, b)), 0.0)


def _lcs_length(a: List[str], b: List[str]) -> int:
    dp = [[0] * (len(b) + 1) for _ in range(len(a) + 1)]
    for i in range(1, len(a) + 1):
        for j in range(1, len(b) + 1):
            if a[i - 1] == b[j - 1]:
                dp[i][j] = dp[i - 1][j - 1] + 1
            else:
                dp[i][j] = max(dp[i - 1][j], dp[i][j - 1])
    return dp[-1][-1]


def _rouge_l(candidate: str, reference: str) -> float:
    cand_words = candidate.lower().split()
    ref_words = reference.lower().split()
    if not cand_words or not ref_words:
        return 0.0
    lcs = _lcs_length(cand_words, ref_words)
    precision = lcs / len(cand_words)
    recall = lcs / len(ref_words)
    if precision + recall == 0:
        return 0.0
    return round(2 * precision * recall / (precision + recall), 4)


def evaluate(candidate: str, reference: str) -> dict:
    exact_match = candidate.strip().lower() == reference.strip().lower()
    rouge_l = _rouge_l(candidate, reference)
    candidate_vec, reference_vec = embed_batch([candidate, reference])
    semantic_similarity = round(_cosine_similarity(candidate_vec, reference_vec), 4)
    composite = round((rouge_l + semantic_similarity) / 2, 4)

    return {
        "exact_match": exact_match,
        "rouge_l": rouge_l,
        "semantic_similarity": semantic_similarity,
        "composite_score": composite,
    }
