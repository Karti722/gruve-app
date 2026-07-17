"use client";

import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import {
  getKnowledgeBaseSource,
  listKnowledgeBaseSources,
  type KnowledgeBaseSource,
} from "@/lib/api";

/**
 * Lets a visitor read the actual articles the RAG demo searches through,
 * instead of only ever seeing short retrieved snippets. Picking an article
 * from the dropdown shows its full text below, rendered like a page pulled
 * straight from the tutorial's own book.
 */
export function KnowledgeBaseBrowser() {
  const [sources, setSources] = useState<KnowledgeBaseSource[]>([]);
  const [selected, setSelected] = useState<string>("");
  const [content, setContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listKnowledgeBaseSources()
      .then((res) => {
        setSources(res.sources);
        if (res.sources[0]) setSelected(res.sources[0].source);
      })
      .catch((err) => setError((err as Error).message));
  }, []);

  useEffect(() => {
    if (!selected) return;
    setLoading(true);
    setError(null);
    getKnowledgeBaseSource(selected)
      .then((file) => setContent(file.content))
      .catch((err) => setError((err as Error).message))
      .finally(() => setLoading(false));
  }, [selected]);

  return (
    <div className="card space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <p className="max-w-md text-sm text-paper-ink/60">
          This is the real article collection the search above looks through — pick one to read it
          in full and see exactly what the AI is drawing its answers from.
        </p>

        {sources.length > 0 && (
          <select
            className="input w-auto min-w-[240px] cursor-pointer"
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
            aria-label="Choose a knowledge base article"
          >
            {sources.map((s) => (
              <option key={s.source} value={s.source}>
                {s.title}
              </option>
            ))}
          </select>
        )}
      </div>

      {error && <p className="text-sm text-red-600">Error: {error}</p>}
      {loading && <p className="text-sm italic text-paper-ink/40">Loading article…</p>}

      {content && !loading && (
        <div className="border-t border-paper-ink/10 pt-4">
          <div className="prose prose-sm max-w-none font-serif prose-headings:font-display prose-headings:text-paper-ink prose-p:text-paper-ink/85 prose-strong:text-paper-ink prose-a:text-brand-600 prose-li:text-paper-ink/85">
            <ReactMarkdown>{content}</ReactMarkdown>
          </div>
        </div>
      )}
    </div>
  );
}
