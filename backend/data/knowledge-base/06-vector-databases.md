# Vector Databases and Embeddings

An embedding is a fixed-length array of floating point numbers that
represents the meaning of a piece of text (or an image, or audio). Text with
similar meaning produces vectors that are close together, typically measured
with cosine similarity or dot product.

A vector database is a data store purpose-built to index and query these
embeddings efficiently at scale, using approximate-nearest-neighbor (ANN)
algorithms such as HNSW so similarity search stays fast even with millions
of vectors. Popular options include Pinecone, Weaviate, Qdrant, Milvus, and
Postgres with the pgvector extension.

For small datasets (a few thousand chunks or fewer), a full, exact
similarity scan — computing cosine similarity between the query vector and
every stored vector — is fast enough that a dedicated ANN index isn't
necessary yet; a relational database with a vector column, or even an
in-memory array, works fine. Teams typically migrate to a dedicated vector
database once dataset size or query volume makes exact search too slow, not
before.

Embeddings and vector search are the retrieval half of a RAG pipeline; the
generation half is handled by the LLM itself.
