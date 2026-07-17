import fs from "fs";
import path from "path";

// See vectorStore.ts for why this is "../../data" rather than "../data".
const KB_DIR = path.resolve(__dirname, "../../data/knowledge-base");

export interface KnowledgeBaseFileMeta {
  source: string;
  title: string;
}

export interface KnowledgeBaseFile extends KnowledgeBaseFileMeta {
  content: string;
}

let cache: KnowledgeBaseFileMeta[] | null = null;

/** Pulls a human-friendly title from a markdown file's first `# Heading`,
 * falling back to the filename if one isn't found. */
function extractTitle(markdown: string, fallback: string): string {
  const heading = markdown.match(/^#\s+(.+)$/m);
  return heading ? heading[1].trim() : fallback;
}

/** Every knowledge-base file's identifier + display title. Cached in memory
 * since the files are static for the process lifetime (same assumption
 * seedDocuments.ts makes). */
export function listKnowledgeBaseFiles(): KnowledgeBaseFileMeta[] {
  if (!cache) {
    cache = fs
      .readdirSync(KB_DIR)
      .filter((f) => f.endsWith(".md"))
      .sort()
      .map((source) => {
        const raw = fs.readFileSync(path.join(KB_DIR, source), "utf-8");
        return { source, title: extractTitle(raw, source) };
      });
  }
  return cache;
}

export function getKnowledgeBaseTitle(source: string): string {
  return listKnowledgeBaseFiles().find((f) => f.source === source)?.title ?? source;
}

/** Full content of a single knowledge-base file, or null if `source` isn't
 * one of the known files (guards against path traversal: only exact
 * matches from the directory listing are ever read). */
export function readKnowledgeBaseFile(source: string): KnowledgeBaseFile | null {
  const meta = listKnowledgeBaseFiles().find((f) => f.source === source);
  if (!meta) return null;

  const content = fs.readFileSync(path.join(KB_DIR, source), "utf-8");
  return { source, title: meta.title, content };
}
