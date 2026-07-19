"use client";

import { useState } from "react";
import { tokenizeText, type TokenizeResponse } from "@/lib/api";
import { TextbookPage } from "@/components/TextbookPage";
import { Analogy } from "@/components/Analogy";
import { Sources } from "@/components/Sources";

const SAMPLES = [
  "Retrieval-augmented generation grounds a model's answer in real, retrieved passages instead of relying on memory alone.",
  "supercalifragilisticexpialidocious, a made-up word most tokenizers were never directly trained on.",
];

export default function TokenizerPage() {
  const [text, setText] = useState("");
  const [result, setResult] = useState<TokenizeResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function runTokenize(inputText: string) {
    if (!inputText.trim() || loading) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const response = await tokenizeText(inputText);
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
              runTokenize(text);
            }}
            className="space-y-3"
          >
            <textarea
              className="input min-h-[7rem] resize-y"
              placeholder="Type or paste text to count tokens for…"
              value={text}
              onChange={(e) => setText(e.target.value)}
              disabled={loading}
            />
            <div className="flex justify-end">
              <button type="submit" className="btn-primary shrink-0" disabled={loading || !text.trim()}>
                Count Tokens
              </button>
            </div>
          </form>

          <div>
            <p className="font-display text-xs font-bold uppercase tracking-wide text-paper-ink/40">
              Try a sample
            </p>
            <ol className="mt-2 space-y-1.5 text-sm">
              {SAMPLES.map((sample, i) => (
                <li key={sample}>
                  <button
                    type="button"
                    onClick={() => {
                      setText(sample);
                      runTokenize(sample);
                    }}
                    className="text-left leading-relaxed text-paper-ink/70 underline decoration-paper-ink/25 decoration-dotted underline-offset-4 transition hover:text-brand-700 hover:decoration-brand-500"
                  >
                    {i + 1}. {sample}
                  </button>
                </li>
              ))}
            </ol>
          </div>
        </div>

        {loading && <p className="text-sm italic text-paper-ink/40">Asking Claude for an exact count…</p>}
        {error && <p className="text-sm text-red-600">Error: {error}</p>}

        {result && (
          <div className="space-y-4">
            <div className="card">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-display text-xs font-bold uppercase tracking-[0.2em] text-paper-ink/50">
                  Exact Token Count
                </h3>
                <span className="pill text-emerald-700">LIVE · Anthropic</span>
              </div>
              <p className="mt-2 text-2xl font-semibold text-paper-ink">{result.tokenCount} tokens</p>
            </div>

            <div className="card">
              <h3 className="mb-3 font-display text-xs font-bold uppercase tracking-[0.2em] text-paper-ink/50">
                Estimated cost, this request, by model
              </h3>
              <ul className="space-y-2">
                {result.costEstimates.map((c) => (
                  <li
                    key={c.model}
                    className="flex flex-wrap items-baseline justify-between gap-2 border-l-2 border-brand-500/30 pl-4 text-sm"
                  >
                    <span className="font-display text-paper-ink/80">{c.model}</span>
                    <span className="text-paper-ink/60">
                      ${c.inputCostUsd.toFixed(6)} at ${c.inputRatePerMillion.toFixed(2)}/M input tokens
                      (${c.outputRatePerMillion.toFixed(2)}/M output)
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </div>

      <TextbookPage eyebrow="Chapter 1" title="Tokenization and the Cost of a Request" pageNumber="Page 1">
        <p>
          Before a model can predict anything, whatever you type has to be converted into a form it
          can actually read. This tutorial starts here, one level below the conversation itself: how
          text becomes the individual pieces, <strong>tokens</strong>, a model processes one at a
          time, and, since every hosted model bills per token rather than per character or word, what
          a request built out of them actually costs. Chapter 2 picks up right where this leaves off:
          an actual conversation with a model, generated one of these tokens at a time.
        </p>

        <h2 className="font-display text-lg font-bold text-paper-ink">
          <span className="text-brand-600">1.1</span> Byte-Pair Encoding
        </h2>
        <p>
          Every modern LLM tokenizer, including the ones behind GPT and Claude, is a variant of{" "}
          <strong>byte-pair encoding (BPE)</strong>. The algorithm starts from individual characters
          and repeatedly merges whichever adjacent pair of symbols occurs most often across a
          training corpus into a new symbol, generation after generation. Common words end up
          collapsing into a single token; words the tokenizer never saw during training (a typo,
          a made-up word, a rare technical term) fall back to smaller, still-meaningful pieces
          instead of one unhelpful "unknown word" marker.
        </p>
        <p>
          No provider publishes the exact vocabulary their production tokenizer learned this way,
          so there's no way to train a small local copy and expect its token boundaries to line up
          with a real model's. The demo above sidesteps that entirely: instead of approximating,
          it asks Claude directly for the exact count of whichever text you enter, the same count
          that model would actually bill for.
        </p>

        <Analogy>
          Approximating tokenization from scratch is like guessing how many puzzle pieces a box
          contains by cutting your own cardboard into similar-sized shapes: a reasonable estimate,
          but never the real count. Asking the actual manufacturer for the count on the box is the
          only way to know for certain, which is exactly what this chapter's demo does.
        </Analogy>

        <h2 className="font-display text-lg font-bold text-paper-ink">
          <span className="text-brand-600">1.2</span> Turning Tokens into Dollars
        </h2>
        <p>
          Once text is tokenized, cost is just arithmetic: providers publish a price per million
          tokens, separately for input (what you send) and output (what the model generates), and
          output is typically priced several times higher than input. At real, published rates, a
          single short request costs a fraction of a cent, but that number stops being trivial the
          moment a feature is handling thousands of requests a day, which is exactly the "cost
          optimization" concern Chapters 6 and 7 pick up next: how to spend fewer tokens without
          spending less accuracy.
        </p>

        <Sources
          items={[
            {
              label: "Sennrich, Haddow & Birch, \"Neural Machine Translation of Rare Words with Subword Units\" (2015): the paper that adapted BPE to language tokenization",
              href: "https://arxiv.org/abs/1508.07909",
            },
            {
              label: "Anthropic: token counting API reference (the exact endpoint this chapter's demo calls)",
              href: "https://platform.claude.com/docs/en/api/messages-count-tokens",
            },
            {
              label: "Anthropic: official Claude API pricing (current rates cited above)",
              href: "https://platform.claude.com/docs/en/about-claude/pricing",
            },
          ]}
        />
      </TextbookPage>
    </div>
  );
}
