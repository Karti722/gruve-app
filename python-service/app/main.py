"""
AI Nexus Python microservice.

Demonstrates: Python, REST APIs and a polyglot microservices architecture
(this FastAPI service is called over HTTP by the Node.js backend to keep
these text-processing concerns isolated and independently deployable/
scalable from the chat/agent/RAG orchestration layer). Endpoints:
/embed for the RAG demo's vector search; /summarize for extractive
summarization (plus keyword extraction and readability scoring);
/tokenize for BPE tokenization and per-model cost estimation; /cache-sim
for a semantic-caching simulation; and /evaluate for a small LLM-output
evaluation harness, the last three modeling everyday applied AI
engineering concerns (token cost, caching and evals) rather than a
single user-facing demo technique.
"""

import os

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from app.embeddings import EMBEDDING_DIMS, embed_batch
from app.eval import evaluate
from app.keywords import extract_keywords
from app.readability import score_readability
from app.semantic_cache import run_cache_simulation
from app.summarizer import RankedSentence, split_sentences, summarize
from app.tokenizer import estimate_cost, tokenize

app = FastAPI(title="AI Nexus Python Service", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class EmbedRequest(BaseModel):
    texts: list[str]


class EmbedResponse(BaseModel):
    embeddings: list[list[float]]
    dims: int


class SummarizeRequest(BaseModel):
    text: str
    sentence_count: int = 3


class RankedSentenceModel(BaseModel):
    text: str
    index: int
    score: float


class ReadabilityModel(BaseModel):
    flesch_reading_ease: float
    flesch_kincaid_grade: float
    word_count: int
    sentence_count: int


class SummarizeResponse(BaseModel):
    sentences: list[RankedSentenceModel]
    total_sentences: int
    keywords: list[str]
    original_readability: ReadabilityModel
    summary_readability: ReadabilityModel


class TokenizeRequest(BaseModel):
    text: str


class CostEstimateModel(BaseModel):
    model: str
    input_cost_usd: float
    input_rate_per_million: float
    output_rate_per_million: float


class TokenizeResponse(BaseModel):
    tokens: list[str]
    token_count: int
    cost_estimates: list[CostEstimateModel]


class CacheSimRequest(BaseModel):
    queries: list[str]
    threshold: float = 0.85


class CacheSimResult(BaseModel):
    query: str
    hit: bool
    matched_query: str | None
    similarity: float


class CacheSimResponse(BaseModel):
    results: list[CacheSimResult]
    hit_count: int
    miss_count: int


class EvaluateRequest(BaseModel):
    candidate: str
    reference: str


class EvaluateResponse(BaseModel):
    exact_match: bool
    rouge_l: float
    semantic_similarity: float
    composite_score: float


@app.get("/health")
def health():
    return {"status": "ok", "dims": EMBEDDING_DIMS}


@app.post("/embed", response_model=EmbedResponse)
def embed(request: EmbedRequest):
    return EmbedResponse(embeddings=embed_batch(request.texts), dims=EMBEDDING_DIMS)


@app.post("/summarize", response_model=SummarizeResponse)
def summarize_endpoint(request: SummarizeRequest):
    sentence_count = max(1, min(request.sentence_count, 10))
    ranked: list[RankedSentence] = summarize(request.text, sentence_count)
    summary_text = " ".join(r["text"] for r in ranked)

    return SummarizeResponse(
        sentences=[RankedSentenceModel(**r) for r in ranked],
        total_sentences=len(split_sentences(request.text)),
        keywords=extract_keywords(request.text),
        original_readability=ReadabilityModel(**score_readability(request.text)),
        summary_readability=ReadabilityModel(**score_readability(summary_text)),
    )


@app.post("/tokenize", response_model=TokenizeResponse)
def tokenize_endpoint(request: TokenizeRequest):
    tokens = tokenize(request.text)
    return TokenizeResponse(
        tokens=tokens,
        token_count=len(tokens),
        cost_estimates=[CostEstimateModel(**c) for c in estimate_cost(len(tokens))],
    )


@app.post("/cache-sim", response_model=CacheSimResponse)
def cache_sim_endpoint(request: CacheSimRequest):
    queries = [q for q in request.queries if q.strip()][:20]
    if len(queries) < 2:
        raise HTTPException(400, "Provide at least two non-empty queries to simulate a cache against.")
    threshold = max(0.0, min(request.threshold, 1.0))
    results = run_cache_simulation(queries, threshold)
    return CacheSimResponse(
        results=[CacheSimResult(**r) for r in results],
        hit_count=sum(1 for r in results if r["hit"]),
        miss_count=sum(1 for r in results if not r["hit"]),
    )


@app.post("/evaluate", response_model=EvaluateResponse)
def evaluate_endpoint(request: EvaluateRequest):
    if not request.candidate.strip() or not request.reference.strip():
        raise HTTPException(400, "Both 'candidate' and 'reference' must be non-empty.")
    return EvaluateResponse(**evaluate(request.candidate, request.reference))


if __name__ == "__main__":
    import uvicorn

    port = int(os.environ.get("EMBEDDING_SERVICE_PORT", 8001))
    uvicorn.run("app.main:app", host="0.0.0.0", port=port, reload=False)
