import Database from "better-sqlite3";
import fs from "fs";
import path from "path";

/**
 * Lightweight vector store backed by SQLite: rows hold the raw chunk text
 * plus its embedding (serialized as JSON). Similarity search is an exact
 * cosine-similarity scan in JS rather than an ANN index — perfectly fine at
 * the scale of a demo knowledge base (see 06-vector-databases.md for when a
 * dedicated vector DB like Pinecone/Qdrant actually becomes necessary).
 */

export interface StoredChunk {
  id: number;
  source: string;
  text: string;
}

export interface SearchResult extends StoredChunk {
  score: number;
}

// __dirname is backend/src/rag in dev (tsx) and backend/dist/rag once built —
// both are exactly two levels below backend/, so this resolves to the same
// backend/data/ directory in either case.
const dbPath = path.resolve(__dirname, "../../data/vector-store.sqlite");
fs.mkdirSync(path.dirname(dbPath), { recursive: true });
const db = new Database(dbPath);

db.exec(`
  CREATE TABLE IF NOT EXISTS chunks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source TEXT NOT NULL,
    text TEXT NOT NULL,
    embedding TEXT NOT NULL
  );
`);

export function isStoreEmpty(): boolean {
  const row = db.prepare("SELECT COUNT(*) as count FROM chunks").get() as { count: number };
  return row.count === 0;
}

export function clearStore(): void {
  db.exec("DELETE FROM chunks");
}

export function addChunk(source: string, text: string, embedding: number[]): void {
  db.prepare("INSERT INTO chunks (source, text, embedding) VALUES (?, ?, ?)").run(
    source,
    text,
    JSON.stringify(embedding)
  );
}

export function countChunks(): number {
  const row = db.prepare("SELECT COUNT(*) as count FROM chunks").get() as { count: number };
  return row.count;
}

export function searchSimilar(queryEmbedding: number[], topK = 4): SearchResult[] {
  const rows = db.prepare("SELECT id, source, text, embedding FROM chunks").all() as (StoredChunk & {
    embedding: string;
  })[];

  const scored = rows.map((row) => ({
    id: row.id,
    source: row.source,
    text: row.text,
    score: cosineSimilarity(queryEmbedding, JSON.parse(row.embedding)),
  }));

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, topK);
}

function cosineSimilarity(a: number[], b: number[]): number {
  const len = Math.min(a.length, b.length);
  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < len; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}
