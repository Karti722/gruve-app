"""
Text embedding generation for the RAG pipeline.

Calls Voyage AI's real embedding API. Voyage, not OpenAI or Claude, because
Anthropic itself doesn't offer an embeddings endpoint at all and instead
names Voyage as its own recommended embeddings partner: see
platform.claude.com/docs/en/build-with-claude/embeddings. `voyage-4-lite`
specifically is the cheapest current-generation Voyage model, and every
account gets 200 million free tokens on this model family, comfortably
covering this app's entire realistic lifetime usage at $0.

Requires VOYAGE_API_KEY. There is deliberately no offline/mock fallback
here, unlike chat, RAG generation and summarize: a fabricated embedding
would silently corrupt the vector store the exact same way an earlier
in-process hashing fallback for the backend's own embedding calls once did
(see the git history of backend/src/rag/embeddingsClient.ts), so this
fails loudly and immediately at startup if the key is missing, rather than
lazily the first time something tries to embed text.

This replaces an earlier from-scratch deterministic hashing ("bag of
words") embedding. That was a real, historically-legitimate technique (the
"hashing trick," the same idea behind scikit-learn's HashingVectorizer),
refined over time with stopword filtering and a domain-acronym expansion
table to fix specific failure modes it had, but it could never capture
true synonymy the way a real trained embedding model does. All of that
stopword/acronym machinery is gone along with it: a real embedding model
does not need it.

`input_type` follows Voyage's documented best practice for retrieval:
pass "document" when embedding text that will be searched *against* (the
knowledge-base chunks seeded once), and "query" when embedding the text
doing the searching (a live question), since Voyage's model treats the
two asymmetrically for better retrieval quality. Callers doing a
symmetric, non-retrieval comparison (the semantic cache, TextRank
sentence-similarity, the eval metric) omit it entirely.
"""

import os
from typing import List, Optional

import voyageai

EMBEDDING_DIMS = 1024
_MODEL = "voyage-4-lite"

_client = voyageai.Client(api_key=os.environ["VOYAGE_API_KEY"])


def embed_batch(texts: List[str], input_type: Optional[str] = None) -> List[List[float]]:
    result = _client.embed(
        texts,
        model=_MODEL,
        input_type=input_type,
        output_dimension=EMBEDDING_DIMS,
    )
    return result.embeddings
