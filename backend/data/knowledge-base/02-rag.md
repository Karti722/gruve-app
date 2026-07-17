# Retrieval-Augmented Generation (RAG)

Retrieval-Augmented Generation combines a search step with a generation step
so an LLM can answer questions using information it was never trained on:
private documents, recent data or a company's internal knowledge base.

The standard pipeline has four stages:

1. **Chunking**: long documents are split into smaller passages (a few
   hundred tokens each) so retrieval can be precise rather than pulling in
   entire documents.
2. **Embedding**: each chunk is converted into a dense numeric vector using
   an embedding model, such that semantically similar text produces vectors
   that are close together in vector space.
3. **Retrieval**: at query time, the user's question is embedded with the
   same model, and a vector database returns the top-K most similar chunks,
   usually ranked by cosine similarity.
4. **Generation**: the retrieved chunks are inserted into the LLM's prompt
   as context, and the model is instructed to answer using only that context
   and to cite its sources.

RAG is preferred over fine-tuning when the underlying data changes
frequently, when answers must be traceable to a source document or when there
isn't enough data to justify training a custom model.
