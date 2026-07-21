import { Pool } from "pg";
import { config } from "../config";
import { EMBEDDING_DIMS } from "./embeddingsClient";

/**
 * Vector store backed by real pgvector: a Postgres extension that adds a
 * native `vector` column type plus ANN indexing (HNSW). Similarity search is
 * pushed down into Postgres as an indexed `ORDER BY embedding <=> $query`
 * query instead of pulling every row into JS and scoring it by hand: the
 * same pattern a production RAG pipeline would use (see
 * 06-vector-databases.md for the general concept, and this file for how it
 * looks in practice with a real vector DB rather than an exact in-memory scan).
 */

export interface StoredChunk {
  id: number;
  source: string;
  text: string;
}

export interface SearchResult extends StoredChunk {
  score: number;
}

// Neon (and most hosted Postgres) requires TLS, but node-postgres doesn't
// reliably auto-enable it from a bare `?sslmode=require` query string, and
// with no connectionTimeoutMillis a stalled handshake hangs forever instead
// of failing fast. Local dev's Docker Postgres has no TLS at all, hence the
// localhost check rather than always enabling ssl. 30s (not something
// tighter) because Neon's free tier scales to zero when idle, and waking it
// back up can occasionally take longer than a normal already-warm TLS
// handshake, a real 10s timeout here once killed a Cloud Run startup that
// was otherwise fine, just unlucky enough to hit a cold Neon instance.
const pool = new Pool({
  connectionString: config.postgresUrl,
  ssl: config.postgresUrl.includes("localhost") ? false : { rejectUnauthorized: false },
  connectionTimeoutMillis: 30_000,
});

let readyPromise: Promise<void> | null = null;

/** Lazily creates the pgvector extension, table, HNSW index and a
 * `(source, text)` uniqueness constraint the first time the store is
 * touched. Safe to call repeatedly; every statement is idempotent (`IF NOT
 * EXISTS`). The uniqueness constraint exists because `seedKnowledgeBaseIfEmpty`'s
 * "check if empty, then insert" is a classic check-then-act race: if two
 * backend processes ever start concurrently (e.g. a dev-server restart
 * racing the process it's replacing), both can see an empty table and both
 * proceed to seed the full knowledge base, silently tripling every chunk.
 * That's exactly what happened once during development; the constraint
 * below makes it a DB-level guarantee that can't recur, rather than
 * something that depends on application code never racing. */
function ensureReady(): Promise<void> {
  if (!readyPromise) {
    readyPromise = (async () => {
      await pool.query("CREATE EXTENSION IF NOT EXISTS vector");
      await pool.query(`
        CREATE TABLE IF NOT EXISTS chunks (
          id SERIAL PRIMARY KEY,
          source TEXT NOT NULL,
          text TEXT NOT NULL,
          embedding vector(${EMBEDDING_DIMS}) NOT NULL
        )
      `);
      await pool.query(`
        CREATE INDEX IF NOT EXISTS chunks_embedding_hnsw_idx
        ON chunks USING hnsw (embedding vector_cosine_ops)
      `);
      await pool.query(`
        CREATE UNIQUE INDEX IF NOT EXISTS chunks_source_text_unique
        ON chunks (source, text)
      `);
    })();
  }
  return readyPromise;
}

/** pgvector's wire format for a vector literal: '[0.1,0.2,...]'. */
function toVectorLiteral(embedding: number[]): string {
  return `[${embedding.join(",")}]`;
}

export async function isStoreEmpty(): Promise<boolean> {
  return (await countChunks()) === 0;
}

export async function clearStore(): Promise<void> {
  await ensureReady();
  await pool.query("DELETE FROM chunks");
}

export async function addChunk(source: string, text: string, embedding: number[]): Promise<void> {
  await ensureReady();
  // ON CONFLICT DO NOTHING: two concurrent seed attempts inserting the same
  // (source, text) pair is now a harmless no-op instead of a duplicate row.
  await pool.query(
    `INSERT INTO chunks (source, text, embedding) VALUES ($1, $2, $3)
     ON CONFLICT (source, text) DO NOTHING`,
    [source, text, toVectorLiteral(embedding)]
  );
}

export async function countChunks(): Promise<number> {
  await ensureReady();
  const { rows } = await pool.query<{ count: string }>("SELECT COUNT(*) AS count FROM chunks");
  return Number(rows[0].count);
}

export async function searchSimilar(queryEmbedding: number[], topK = 4): Promise<SearchResult[]> {
  await ensureReady();

  // `<=>` is pgvector's cosine-distance operator (0 = identical). Flipping it
  // to `1 - distance` keeps the same "higher score = more similar" semantics
  // the rest of the app (routes, agent tools, frontend) already expects.
  const { rows } = await pool.query<{ id: number; source: string; text: string; score: number }>(
    `SELECT id, source, text, 1 - (embedding <=> $1) AS score
     FROM chunks
     ORDER BY embedding <=> $1
     LIMIT $2`,
    [toVectorLiteral(queryEmbedding), topK]
  );

  return rows.map((r) => ({ ...r, score: Number(r.score) }));
}
