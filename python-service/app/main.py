"""
AI Nexus Python microservice.

Demonstrates: Python, REST APIs, and a polyglot microservices architecture
(this FastAPI service is called over HTTP by the Node.js backend to keep
these text-processing concerns isolated and independently deployable/
scalable from the chat/agent/RAG orchestration layer). Two real endpoints:
/embed for the RAG demo's vector search, and /summarize for the extractive
summarization demo, which also returns keyword extraction and before/after
readability scoring for the same input text.
"""

import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from app.embeddings import EMBEDDING_DIMS, embed_batch
from app.keywords import extract_keywords
from app.readability import score_readability
from app.summarizer import RankedSentence, split_sentences, summarize

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


if __name__ == "__main__":
    import uvicorn

    port = int(os.environ.get("EMBEDDING_SERVICE_PORT", 8001))
    uvicorn.run("app.main:app", host="0.0.0.0", port=port, reload=False)
