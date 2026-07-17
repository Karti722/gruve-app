import type { RagSource } from "@/lib/api";

export function SourceCitation({ source }: { source: RagSource }) {
  return (
    <div className="border-l-2 border-brand-500/30 pl-4">
      <div className="mb-1 flex items-center justify-between font-display text-xs uppercase tracking-wide text-paper-ink/40">
        <span className="text-brand-700">
          [{source.citation}] {source.title}
        </span>
        <span>similarity {source.similarity.toFixed(2)}</span>
      </div>
      <p className="whitespace-pre-wrap text-sm italic leading-relaxed text-paper-ink/70">
        {source.text}
      </p>
    </div>
  );
}
