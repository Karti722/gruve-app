"""
Gruve embeddings microservice.

Demonstrates: Python, REST APIs, and a polyglot microservices architecture
(this FastAPI service is called over HTTP by the Node.js backend to keep
the embedding-generation concern isolated and independently deployable/
scalable from the chat/agent/RAG orchestration layer).
"""

import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from app.embeddings import EMBEDDING_DIMS, embed_batch

app = FastAPI(title="Gruve Embeddings Service", version="1.0.0")

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


@app.get("/health")
def health():
    return {"status": "ok", "dims": EMBEDDING_DIMS}


@app.post("/embed", response_model=EmbedResponse)
def embed(request: EmbedRequest):
    return EmbedResponse(embeddings=embed_batch(request.texts), dims=EMBEDDING_DIMS)


if __name__ == "__main__":
    import uvicorn

    port = int(os.environ.get("EMBEDDING_SERVICE_PORT", 8001))
    uvicorn.run("app.main:app", host="0.0.0.0", port=port, reload=False)
