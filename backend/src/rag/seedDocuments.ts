import fs from "fs";
import path from "path";
import { chunkText } from "./chunker";
import { embedTexts } from "./embeddingsClient";
import { addChunk, countChunks, isStoreEmpty } from "./vectorStore";

// See vectorStore.ts for why this is "../../data" rather than "../data".
const KB_DIR = path.resolve(__dirname, "../../data/knowledge-base");

/** Loads every markdown file in data/knowledge-base, chunks it, embeds the
 * chunks and writes them into the vector store. Runs once at server
 * startup; skipped on subsequent restarts once the store is populated. */
export async function seedKnowledgeBaseIfEmpty(): Promise<void> {
  if (!(await isStoreEmpty())) {
    console.log(`[rag] vector store already has ${await countChunks()} chunks, skipping seed.`);
    return;
  }

  const files = fs.readdirSync(KB_DIR).filter((f) => f.endsWith(".md"));
  console.log(`[rag] seeding vector store from ${files.length} knowledge-base file(s)...`);

  for (const file of files) {
    const fullPath = path.join(KB_DIR, file);
    const raw = fs.readFileSync(fullPath, "utf-8");
    const chunks = chunkText(raw);
    const embeddings = await embedTexts(chunks);

    for (let i = 0; i < chunks.length; i++) {
      await addChunk(file, chunks[i], embeddings[i]);
    }
  }

  console.log(`[rag] seeding complete: ${await countChunks()} chunks indexed.`);
}
