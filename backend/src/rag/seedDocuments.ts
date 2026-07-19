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

  // One embedTexts call per file used to mean one Voyage request per file.
  // Voyage's free tier defaults to 3 requests/minute until a payment method
  // is on file (still free up to 200M tokens either way), so 7 files in a
  // tight loop got rate-limited partway through. Embedding every chunk from
  // every file in a single batched call keeps this to one request total.
  const allChunks: { source: string; text: string }[] = [];
  for (const file of files) {
    const fullPath = path.join(KB_DIR, file);
    const raw = fs.readFileSync(fullPath, "utf-8");
    for (const text of chunkText(raw)) {
      allChunks.push({ source: file, text });
    }
  }

  const embeddings = await embedTexts(
    allChunks.map((c) => c.text),
    "document"
  );
  for (let i = 0; i < allChunks.length; i++) {
    await addChunk(allChunks[i].source, allChunks[i].text, embeddings[i]);
  }

  console.log(`[rag] seeding complete: ${await countChunks()} chunks indexed.`);
}
