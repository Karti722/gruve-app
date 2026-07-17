# Vector Databases and Embeddings

An embedding is a fixed-length array of floating point numbers that
represents the meaning of a piece of text (or an image or audio). Text with
similar meaning produces vectors that are close together, typically measured
with cosine similarity or dot product.

A vector database is a data store purpose-built to index and query these
embeddings efficiently at scale, using approximate-nearest-neighbor (ANN)
algorithms such as HNSW so similarity search stays fast even with millions
of vectors. Popular options include Pinecone, Weaviate, Qdrant, Milvus and
Postgres with the pgvector extension.

For small datasets (a few thousand chunks or fewer), a full, exact
similarity scan (computing cosine similarity between the query vector and
every stored vector in application code) is often fast enough that a
dedicated ANN index isn't strictly necessary. Even so, reaching for a real
vector-capable store early costs little and means the retrieval query,
index and scaling story are already production-shaped rather than something
to migrate later. This app's own RAG pipeline does exactly that: it stores
embeddings in Postgres via the pgvector extension, with a genuine HNSW index
(`CREATE INDEX ... USING hnsw (embedding vector_cosine_ops)`), and asks
Postgres itself to do the nearest-neighbor search (`ORDER BY embedding <=>
$query LIMIT k`) rather than pulling every row into application memory.

Embeddings and vector search are the retrieval half of a RAG pipeline; the
generation half is handled by the LLM itself.
