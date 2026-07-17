/**
 * Splits a markdown document into overlapping chunks along paragraph
 * boundaries. Overlap preserves context that would otherwise be lost right
 * at a chunk edge: a standard RAG preprocessing trick.
 */
export function chunkText(text: string, maxChars = 600, overlapChars = 100): string[] {
  const paragraphs = text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);

  const chunks: string[] = [];
  let current = "";

  for (const paragraph of paragraphs) {
    if ((current + "\n\n" + paragraph).length > maxChars && current.length > 0) {
      chunks.push(current.trim());
      // Keep the tail of the previous chunk as overlap for the next one.
      current = current.slice(Math.max(0, current.length - overlapChars));
    }
    current = current ? `${current}\n\n${paragraph}` : paragraph;
  }

  if (current.trim()) chunks.push(current.trim());
  return chunks;
}
