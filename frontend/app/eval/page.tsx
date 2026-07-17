"use client";

import { useState } from "react";
import { evaluateOutput, type EvaluateResponse } from "@/lib/api";
import { TextbookPage } from "@/components/TextbookPage";
import { Analogy } from "@/components/Analogy";
import { Sources } from "@/components/Sources";

const SAMPLES = [
  {
    label: "Exact match",
    candidate: "The Model Context Protocol standardizes how AI applications connect to tools.",
    reference: "The Model Context Protocol standardizes how AI applications connect to tools.",
  },
  {
    label: "Correct, but phrased differently",
    candidate: "MCP gives AI applications a standard way to discover and call external tools.",
    reference: "The Model Context Protocol standardizes how AI applications connect to tools.",
  },
  {
    label: "Off-topic",
    candidate: "Retrieval-augmented generation grounds answers in retrieved documents.",
    reference: "The Model Context Protocol standardizes how AI applications connect to tools.",
  },
];

export default function EvalPage() {
  const [candidate, setCandidate] = useState("");
  const [reference, setReference] = useState("");
  const [result, setResult] = useState<EvaluateResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function runEvaluate(c: string, r: string) {
    if (!c.trim() || !r.trim() || loading) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const response = await evaluateOutput(c, r);
      setResult(response);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-10">
      <div className="space-y-3">
        <h2 className="font-display text-xs font-bold uppercase tracking-[0.2em] text-paper-ink/50">
          Try it yourself
        </h2>

        <div className="card space-y-4">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              runEvaluate(candidate, reference);
            }}
            className="space-y-3"
          >
            <label className="block space-y-1">
              <span className="font-display text-xs font-bold uppercase tracking-wide text-paper-ink/40">
                Candidate answer
              </span>
              <textarea
                className="input min-h-[5rem] resize-y"
                placeholder="The answer you want to score…"
                value={candidate}
                onChange={(e) => setCandidate(e.target.value)}
                disabled={loading}
              />
            </label>
            <label className="block space-y-1">
              <span className="font-display text-xs font-bold uppercase tracking-wide text-paper-ink/40">
                Reference answer
              </span>
              <textarea
                className="input min-h-[5rem] resize-y"
                placeholder="The known-correct answer to compare against…"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                disabled={loading}
              />
            </label>
            <div className="flex justify-end">
              <button
                type="submit"
                className="btn-primary shrink-0"
                disabled={loading || !candidate.trim() || !reference.trim()}
              >
                Evaluate
              </button>
            </div>
          </form>

          <div>
            <p className="font-display text-xs font-bold uppercase tracking-wide text-paper-ink/40">
              Try a sample pair
            </p>
            <ol className="mt-2 space-y-1.5 text-sm">
              {SAMPLES.map((sample, i) => (
                <li key={sample.label}>
                  <button
                    type="button"
                    onClick={() => {
                      setCandidate(sample.candidate);
                      setReference(sample.reference);
                      runEvaluate(sample.candidate, sample.reference);
                    }}
                    className="text-left leading-relaxed text-paper-ink/70 underline decoration-paper-ink/25 decoration-dotted underline-offset-4 transition hover:text-brand-700 hover:decoration-brand-500"
                  >
                    {i + 1}. {sample.label}
                  </button>
                </li>
              ))}
            </ol>
          </div>
        </div>

        {loading && <p className="text-sm italic text-paper-ink/40">Scoring…</p>}
        {error && <p className="text-sm text-red-600">Error: {error}</p>}

        {result && (
          <div className="card">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-paper-ink/10 pb-2">
              <h3 className="font-display text-xs font-bold uppercase tracking-[0.2em] text-paper-ink/50">
                Scores
              </h3>
              <span className="pill text-paper-ink/60">composite {result.compositeScore.toFixed(3)}</span>
            </div>
            <dl className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="border-l-2 border-brand-500/30 pl-4">
                <dt className="font-display text-xs uppercase tracking-wide text-paper-ink/40">Exact match</dt>
                <dd className="mt-1 text-lg font-semibold text-paper-ink">{result.exactMatch ? "Yes" : "No"}</dd>
              </div>
              <div className="border-l-2 border-brand-500/30 pl-4">
                <dt className="font-display text-xs uppercase tracking-wide text-paper-ink/40">ROUGE-L</dt>
                <dd className="mt-1 text-lg font-semibold text-paper-ink">{result.rougeL.toFixed(3)}</dd>
              </div>
              <div className="border-l-2 border-brand-500/30 pl-4">
                <dt className="font-display text-xs uppercase tracking-wide text-paper-ink/40">
                  Semantic similarity
                </dt>
                <dd className="mt-1 text-lg font-semibold text-paper-ink">{result.semanticSimilarity.toFixed(3)}</dd>
              </div>
            </dl>
          </div>
        )}
      </div>

      <TextbookPage eyebrow="Chapter 7" title="Evaluating AI Outputs" pageNumber="Page 7">
        <p>
          Chapter 6 cut cost with a semantic cache, but a cache hit is only a win if the cached
          answer was actually correct for the new question, not merely similar-sounding. More
          broadly, every change to a prompt, a model or a retrieval strategy raises the same
          question: did this make the system better or worse? Eyeballing a handful of outputs
          doesn't scale and doesn't catch regressions reliably. <strong>Evaluation</strong> is the
          discipline of scoring outputs against a reference answer systematically enough to actually
          trust the result.
        </p>

        <h2 className="font-display text-lg font-bold text-paper-ink">
          <span className="text-brand-600">7.1</span> Three Signals, Cheapest First
        </h2>
        <p>
          Production eval pipelines often use another LLM as a judge for nuanced grading, but a
          model call is exactly the expensive thing Chapters 1 and 6 were trying to avoid, so real
          pipelines typically run cheaper, deterministic checks first and reserve the model-as-judge
          step for cases that need it. This demo runs three of those cheaper signals:{" "}
          <strong>exact match</strong> (did the answer match character-for-character), a{" "}
          <strong>ROUGE-L</strong> overlap score (the longest sequence of words the candidate and
          reference share, in order; a standard, decades-old summarization and translation metric)
          and <strong>semantic similarity</strong> (the same embedding-based cosine similarity from
          Chapters 3 and 6, catching a correct answer that happens to be phrased differently).
        </p>
        <p>
          Try the three samples above. The exact-match pair scores a perfect 1.0 on everything. The
          paraphrase scores low on exact match and ROUGE-L (neither cares about meaning, only
          shared words in order) while semantic similarity gives it partial credit for saying the
          same thing differently. The off-topic pair scores near zero across the board. No single
          signal is sufficient on its own, which is exactly why a real harness combines several.
        </p>

        <Analogy>
          Grading a short-answer exam by checking for the exact expected sentence would fail every
          student who explained the idea correctly in their own words. Grading it by word overlap
          alone would reward a student who strings together the right vocabulary in a nonsensical
          order. A real grader, human or automated, checks several signals together, the same way
          this demo does before ever reaching for something as expensive as another model's
          judgment.
        </Analogy>

        <p>
          Taken together, Chapter 1's token economics, Chapter 6's caching and this chapter's
          evaluation are the applied-engineering thread running underneath the rest of this
          tutorial: knowing what a request costs, cutting that cost without silently breaking
          correctness, and measuring correctness well enough to know the difference. Chapter 8
          picks the story back up with how real companies apply all of this, cost, caching and
          evaluation included, at production scale.
        </p>

        <Sources
          items={[
            {
              label: "Lin, \"ROUGE: A Package for Automatic Evaluation of Summaries\" (2004)",
              href: "https://aclanthology.org/W04-1013/",
            },
            {
              label: "Cosine similarity, Wikipedia",
              href: "https://en.wikipedia.org/wiki/Cosine_similarity",
            },
          ]}
        />
      </TextbookPage>
    </div>
  );
}
