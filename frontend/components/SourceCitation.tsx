import type { RagSource } from "@/lib/api";

export function SourceCitation({ source }: { source: RagSource }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
      <div className="mb-1 flex items-center justify-between text-xs text-white/50">
        <span className="font-mono text-brand-400">[{source.citation}]</span>
        <span>{source.source}</span>
        <span>similarity {source.similarity.toFixed(2)}</span>
      </div>
      <p className="whitespace-pre-wrap text-sm leading-relaxed text-white/70">{source.text}</p>
    </div>
  );
}
