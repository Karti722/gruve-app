"use client";

import { useState } from "react";
import { queryRag, type RagSource } from "@/lib/api";
import { SourceCitation } from "@/components/SourceCitation";

const SAMPLE_QUESTIONS = [
  "What is the Model Context Protocol?",
  "When should I use a dedicated vector database instead of exact search?",
  "What is the difference between RAG and fine-tuning?",
];

export default function RagPage() {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<string | null>(null);
  const [sources, setSources] = useState<RagSource[]>([]);
  const [mockMode, setMockMode] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function runQuery(q: string) {
    if (!q.trim() || loading) return;
    setLoading(true);
    setError(null);
    setAnswer(null);
    try {
      const response = await queryRag(q);
      setAnswer(response.answer);
      setSources(response.sources);
      setMockMode(response.mock);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Retrieval-Augmented Generation</h1>
        <p className="mt-1 text-white/60">
          Your question is embedded, matched against a vector store (seeded from the markdown docs
          in <code className="rounded bg-white/10 px-1.5 py-0.5">backend/data/knowledge-base</code>)
          via cosine similarity, then answered strictly from the retrieved passages with citations.
        </p>
      </div>

      <div className="card space-y-4">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            runQuery(question);
          }}
          className="flex gap-2"
        >
          <input
            className="input"
            placeholder="Ask about LLMs, RAG, agents, MCP, vector DBs…"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            disabled={loading}
          />
          <button type="submit" className="btn-primary" disabled={loading || !question.trim()}>
            Ask
          </button>
        </form>

        <div className="flex flex-wrap gap-2">
          {SAMPLE_QUESTIONS.map((q) => (
            <button
              key={q}
              onClick={() => {
                setQuestion(q);
                runQuery(q);
              }}
              className="pill transition hover:bg-white/10"
              type="button"
            >
              {q}
            </button>
          ))}
        </div>
      </div>

      {loading && <p className="text-sm text-white/40">Embedding query, searching knowledge base…</p>}
      {error && <p className="text-sm text-red-400">Error: {error}</p>}

      {answer && (
        <div className="space-y-4">
          <div className="card">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="font-semibold text-white">Answer</h2>
              {mockMode !== null && (
                <span className={`pill ${mockMode ? "text-amber-300" : "text-emerald-300"}`}>
                  {mockMode ? "MOCK MODE" : "LIVE · Anthropic"}
                </span>
              )}
            </div>
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-white/90">{answer}</p>
          </div>

          <div className="space-y-3">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-white/50">
              Retrieved sources
            </h3>
            {sources.map((s) => (
              <SourceCitation key={s.citation} source={s} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
