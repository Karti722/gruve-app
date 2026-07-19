/**
 * A richer visual for the agent's search_knowledge_base tool result,
 * parallel to WeatherCard and CalculatorCard: reuses the same visual
 * language as SourceCitation (the RAG chapter's citation cards), since
 * this tool wraps the exact same retrieval (see backend/src/agent/tools.ts).
 * Labeled "REAL", not "LIVE": it's a genuine vector search against this
 * app's real pgvector store, not simulated, but it isn't an external API
 * call either, so "LIVE" would overstate it the same way it would for the
 * calculator.
 */

const PASSAGE_HEADER = /\[(.+?)\] \(similarity (-?[\d.]+)\): /g;

interface ParsedPassage {
  source: string;
  similarity: number;
  text: string;
}

export function parseKnowledgeBaseOutput(output: string): ParsedPassage[] | null {
  if (output.trim() === "No relevant passages found.") return [];

  // Split on each passage's own header (not on blank lines, which the
  // knowledge base's real markdown passages routinely also contain inside
  // their own 300-character slice, since backend/src/agent/tools.ts joins
  // passages with "\n\n" too, the exact same separator; a naive
  // output.split("\n\n") would then incorrectly cut a single passage's text
  // into two, mistaking one of its internal blank lines for a boundary.
  const headers = [...output.matchAll(PASSAGE_HEADER)];
  if (headers.length === 0) return null;

  const passages: ParsedPassage[] = [];
  for (let i = 0; i < headers.length; i++) {
    const header = headers[i];
    const start = (header.index ?? 0) + header[0].length;
    const end = i + 1 < headers.length ? headers[i + 1].index : output.length;
    passages.push({
      source: header[1],
      similarity: Number(header[2]),
      text: output.slice(start, end).trim(),
    });
  }
  return passages;
}

export function KnowledgeBaseResults({ output }: { output: string }) {
  const passages = parseKnowledgeBaseOutput(output);
  if (passages === null) return null;

  if (passages.length === 0) {
    return <p className="text-sm italic text-paper-ink/60">No relevant passages found.</p>;
  }

  return (
    <div className="space-y-3">
      <span className="pill text-sky-700">REAL · Knowledge-base search</span>
      <ol className="space-y-3">
        {passages.map((p, i) => (
          <li key={i} className="border-l-2 border-brand-500/30 pl-4">
            <div className="mb-1 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 font-display text-xs uppercase tracking-wide text-paper-ink/40">
              <span className="text-brand-700">
                [{i + 1}] {p.source}
              </span>
              <span className="shrink-0">similarity {p.similarity.toFixed(2)}</span>
            </div>
            <p className="text-sm italic leading-relaxed text-paper-ink/70">{p.text}</p>
          </li>
        ))}
      </ol>
    </div>
  );
}
