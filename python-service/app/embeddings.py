"""
Text embedding generation for the RAG pipeline.

This uses a deterministic hashing ("bag of words") embedding so the whole
demo installs and runs with zero downloaded ML models and no GPU/API key:
`pip install -r requirements.txt` is the entire setup. It captures enough
keyword-level semantic similarity to make the RAG demo's retrieval results
sensible.

To upgrade to real semantic embeddings, swap the body of `embed_text` for
something like:

    from sentence_transformers import SentenceTransformer
    _model = SentenceTransformer("all-MiniLM-L6-v2")
    def embed_text(text: str) -> list[float]:
        return _model.encode(text).tolist()

or call OpenAI's `/embeddings` endpoint. Everything else in this service
(the FastAPI route, the Node.js client that calls it) stays unchanged
because the interface is just "text in, float vector out".
"""

import re
from typing import List

EMBEDDING_DIMS = 256
_TOKEN_RE = re.compile(r"[a-z0-9]+")


def _hash_str(value: str) -> int:
    h = 0
    for ch in value:
        h = (h * 31 + ord(ch)) & 0xFFFFFFFF
    return h


def embed_text(text: str, dims: int = EMBEDDING_DIMS) -> List[float]:
    vector = [0.0] * dims
    for word in _TOKEN_RE.findall(text.lower()):
        vector[_hash_str(word) % dims] += 1.0

    norm = sum(v * v for v in vector) ** 0.5 or 1.0
    return [v / norm for v in vector]


def embed_batch(texts: List[str]) -> List[List[float]]:
    return [embed_text(t) for t in texts]
