"use client";

import { useState } from "react";
import { simulateCache, type CacheSimResponse } from "@/lib/api";
import { TextbookPage } from "@/components/TextbookPage";
import { Analogy } from "@/components/Analogy";
import { Sources } from "@/components/Sources";

const SAMPLE_QUERIES = [
  "What is the Model Context Protocol?",
  "Can you explain MCP to me?",
  "What is the capital of France?",
  "What is the Model Context Protocol?",
  "How does retrieval-augmented generation work?",
].join("\n");

export default function CachePage() {
  const [queriesText, setQueriesText] = useState("");
  const [threshold, setThreshold] = useState(0.85);
  const [result, setResult] = useState<CacheSimResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function runSimulation(input: string, t: number) {
    const queries = input
      .split("\n")
      .map((q) => q.trim())
      .filter(Boolean);
    if (queries.length < 2 || loading) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const response = await simulateCache(queries, t);
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
              runSimulation(queriesText, threshold);
            }}
            className="space-y-3"
          >
            <textarea
              className="input min-h-[9rem] resize-y font-mono text-sm"
              placeholder="One query per line: include a few paraphrases and a repeat to see it work…"
              value={queriesText}
              onChange={(e) => setQueriesText(e.target.value)}
              disabled={loading}
            />
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <label className="flex items-center gap-2 text-sm text-paper-ink/60">
                Similarity threshold
                <input
                  type="number"
                  min={0}
                  max={1}
                  step={0.05}
                  className="input w-24 py-1.5"
                  value={threshold}
                  onChange={(e) => setThreshold(Number(e.target.value))}
                />
              </label>
              <button
                type="submit"
                className="btn-primary shrink-0"
                disabled={loading || queriesText.trim().split("\n").filter(Boolean).length < 2}
              >
                Run simulation
              </button>
            </div>
          </form>

          <div>
            <button
              type="button"
              onClick={() => {
                setQueriesText(SAMPLE_QUERIES);
                runSimulation(SAMPLE_QUERIES, threshold);
              }}
              className="text-left text-sm leading-relaxed text-paper-ink/70 underline decoration-paper-ink/25 decoration-dotted underline-offset-4 transition hover:text-brand-700 hover:decoration-brand-500"
            >
              Try a sample query stream
            </button>
          </div>
        </div>

        {loading && <p className="text-sm italic text-paper-ink/40">Replaying queries against the cache…</p>}
        {error && <p className="text-sm text-red-600">Error: {error}</p>}

        {result && (
          <div className="card space-y-4">
            <div className="mb-1 flex flex-wrap items-center justify-between gap-2 border-b border-paper-ink/10 pb-2">
              <h3 className="font-display text-xs font-bold uppercase tracking-[0.2em] text-paper-ink/50">
                Cache trace
              </h3>
              <span className="pill text-paper-ink/60">
                {result.hitCount} hits · {result.missCount} misses
              </span>
            </div>
            <ol className="space-y-3">
              {result.results.map((r, i) => (
                <li
                  key={i}
                  className={`border-l-2 pl-4 ${r.hit ? "border-emerald-500/40" : "border-paper-ink/20"}`}
                >
                  <div className="mb-1 flex flex-wrap items-center justify-between gap-2 font-display text-xs uppercase tracking-wide text-paper-ink/40">
                    <span>{r.hit ? "Cache hit" : "Cache miss (added to cache)"}</span>
                    <span>similarity {r.similarity.toFixed(3)}</span>
                  </div>
                  <p className="text-sm leading-relaxed text-paper-ink/80">{r.query}</p>
                  {r.hit && r.matchedQuery && (
                    <p className="mt-1 text-xs italic text-paper-ink/50">Matched: “{r.matchedQuery}”</p>
                  )}
                </li>
              ))}
            </ol>
          </div>
        )}
      </div>

      <TextbookPage eyebrow="Chapter 6" title="Semantic Caching" pageNumber="Page 6">
        <p>
          Chapter 1 put a real number on every request to a hosted model. The cheapest possible
          request is one that never has to be made at all, and a <strong>cache</strong> is the
          standard way to avoid making it. A plain cache only helps when a new request's text
          matches a previous one exactly, character for character. Real user traffic rarely
          cooperates: two people asking "What is the Model Context Protocol?" and "Can you explain
          MCP to me?" are asking the same question, but no exact-match cache would ever notice.
        </p>

        <h2 className="font-display text-lg font-bold text-paper-ink">
          <span className="text-brand-600">6.1</span> Matching by Meaning, Not by Characters
        </h2>
        <p>
          A <strong>semantic cache</strong> fixes this by keying on meaning instead of exact text:
          each incoming query is embedded (the same technique from Chapter 3) and compared by
          cosine similarity against every embedding already sitting in the cache. If the closest
          match clears a similarity threshold, it's treated as the same question and the cached
          result is reused; the model is never called at all. If nothing clears the threshold, the
          query is a genuine miss, gets embedded and is added to the cache for future queries to
          match against.
        </p>
        <p>
          Try the sample query stream above: the second query is a paraphrase of the first, but
          their real embeddings typically land only around 0.4&ndash;0.5 cosine similarity, well
          short of the 0.85 default, so it registers as a miss. That's a genuine, measured property
          of short, differently-worded questions like these, not a shortcut this demo is taking:
          the embeddings here are real, but two people phrasing the same question differently still
          don't land as close together in vector space as intuition might suggest. The fourth query,
          an exact repeat of the first, hits immediately at similarity 1.0. Lower the threshold to
          somewhere around 0.4&ndash;0.5 and rerun to see the paraphrase get caught too.
        </p>

        <Analogy>
          A plain cache is a librarian who only recognizes a book by its exact title typed
          correctly. A semantic cache is a librarian who recognizes what you're actually asking
          for, even if you phrase it differently each time: "the crown recovery book," "that
          fantasy quest thing," "the one with Elowen in it," and hands you the same book each time
          without needing to hear the exact same words twice.
        </Analogy>

        <h2 className="font-display text-lg font-bold text-paper-ink">
          <span className="text-brand-600">6.2</span> The Threshold Is a Real Trade-off
        </h2>
        <p>
          Set the threshold too low, and unrelated questions start getting the same cached answer:
          a correctness problem, not just an efficiency one. Set it too high, and near-duplicate
          questions stop matching, and the cache barely saves anything. There's no universally
          correct value; production systems tune it against real traffic and measured accuracy loss,
          which is precisely the kind of measurement Chapter 7 covers next.
        </p>

        <Sources
          items={[
            {
              label: "Cosine similarity, Wikipedia (the same similarity measure Chapter 3's retrieval uses)",
              href: "https://en.wikipedia.org/wiki/Cosine_similarity",
            },
            {
              label: "Anthropic, official Claude API pricing, including prompt-caching discount rates",
              href: "https://platform.claude.com/docs/en/about-claude/pricing",
            },
          ]}
        />
      </TextbookPage>
    </div>
  );
}
