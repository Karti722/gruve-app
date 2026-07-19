"use client";

import { useState } from "react";
import { summarizeText, type SummarizeMode, type SummarizeResponse } from "@/lib/api";
import { TextbookPage } from "@/components/TextbookPage";
import { Analogy } from "@/components/Analogy";
import { CaseStudy } from "@/components/CaseStudy";
import { Sources } from "@/components/Sources";

const SAMPLES = [
  {
    label: "A paragraph about AI concepts (with a couple of asides)",
    text: "Large language models generate text one token at a time, predicting the most likely next piece of text based on everything written so far. This process is called autoregressive generation. Retrieval-Augmented Generation improves on this by searching a document collection for relevant passages before the model answers. Many people enjoy hiking on weekends as a way to relax outdoors. AI agents extend this further by letting a model call tools, observe the results and decide what to do next in a repeating loop. Coffee is a popular beverage enjoyed by millions of people every morning. The Model Context Protocol standardizes how these tools are discovered and called, so a single integration works across many different applications.",
  },
  {
    label: "A paragraph about the Amazon rainforest",
    text: "The Amazon rainforest produces roughly twenty percent of the world's oxygen and is home to millions of species found nowhere else on Earth. Deforestation for cattle ranching and agriculture has destroyed nearly twenty percent of the forest over the past fifty years. My favorite color has always been blue since I was a child. Scientists warn that continued deforestation could push the rainforest past a tipping point, turning parts of it into dry savanna. Local governments and international organizations have launched programs that pay landowners for keeping forests standing rather than clearing them. I had cereal for breakfast this morning.",
  },
];

export default function SummarizePage() {
  const [text, setText] = useState("");
  const [sentenceCount, setSentenceCount] = useState(3);
  const [mode, setMode] = useState<SummarizeMode>("abstractive");
  const [result, setResult] = useState<SummarizeResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function runSummarize(inputText: string, count: number, summarizeMode: SummarizeMode) {
    if (!inputText.trim() || loading) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const response = await summarizeText(inputText, count, summarizeMode);
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
          <div className="flex gap-2 border-b border-paper-ink/10 pb-3">
            {(
              [
                ["abstractive", "Abstractive (LLM)"],
                ["extractive", "Extractive (TextRank)"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setMode(value)}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold uppercase tracking-wide transition ${
                  mode === value
                    ? "bg-brand-600 text-white"
                    : "bg-paper-ink/5 text-paper-ink/60 hover:bg-paper-ink/10"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              runSummarize(text, sentenceCount, mode);
            }}
            className="space-y-3"
          >
            <textarea
              className="input min-h-[9rem] resize-y"
              placeholder="Paste or write a few paragraphs to summarize…"
              value={text}
              onChange={(e) => setText(e.target.value)}
              disabled={loading}
            />
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <label className="flex items-center gap-2 text-sm text-paper-ink/60">
                {mode === "abstractive" ? "Target length (sentences)" : "Sentences to extract"}
                <select
                  className="input w-auto py-1.5"
                  value={sentenceCount}
                  onChange={(e) => setSentenceCount(Number(e.target.value))}
                >
                  {[2, 3, 4, 5].map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="submit"
                className="btn-primary shrink-0"
                disabled={loading || !text.trim()}
              >
                Summarize
              </button>
            </div>
          </form>

          <div>
            <p className="font-display text-xs font-bold uppercase tracking-wide text-paper-ink/40">
              Try a sample
            </p>
            <ol className="mt-2 space-y-1.5 text-sm">
              {SAMPLES.map((sample, i) => (
                <li key={sample.label}>
                  <button
                    type="button"
                    onClick={() => {
                      setText(sample.text);
                      runSummarize(sample.text, sentenceCount, mode);
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

        {loading && (
          <p className="text-sm italic text-paper-ink/40">
            {mode === "abstractive" ? "Asking Claude to summarize…" : "Ranking sentences…"}
          </p>
        )}
        {error && <p className="text-sm text-red-600">Error: {error}</p>}

        {result && result.mode === "abstractive" && (
          <div className="card">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2 border-b border-paper-ink/10 pb-2">
              <h3 className="font-display text-xs font-bold uppercase tracking-[0.2em] text-paper-ink/50">
                Summary (abstractive)
              </h3>
              <span className={`pill ${result.mock ? "text-amber-700" : "text-emerald-700"}`}>
                {result.mock ? "MOCK MODE" : "LIVE · Anthropic"}
              </span>
            </div>
            <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-paper-ink/90">
              {result.summary}
            </p>
          </div>
        )}

        {result && result.mode === "extractive" && (
          <div className="space-y-4">
            <div className="card">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2 border-b border-paper-ink/10 pb-2">
                <h3 className="font-display text-xs font-bold uppercase tracking-[0.2em] text-paper-ink/50">
                  Summary (extractive)
                </h3>
                <span className="pill text-paper-ink/60">
                  {result.sentences.length} of {result.totalSentences} sentences
                </span>
              </div>
              <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-paper-ink/90">
                {result.sentences.map((s) => s.text).join(" ")}
              </p>
            </div>

            {result.keywords.length > 0 && (
              <div className="card">
                <h3 className="mb-2 font-display text-xs font-bold uppercase tracking-[0.2em] text-paper-ink/50">
                  Keywords
                </h3>
                <div className="flex flex-wrap gap-2">
                  {result.keywords.map((k) => (
                    <span key={k} className="pill text-paper-ink/70">
                      {k}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="card">
              <h3 className="mb-3 font-display text-xs font-bold uppercase tracking-[0.2em] text-paper-ink/50">
                Readability, before and after
              </h3>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {(
                  [
                    ["Original text", result.originalReadability],
                    ["Summary", result.summaryReadability],
                  ] as const
                ).map(([label, r]) => (
                  <div key={label} className="border-l-2 border-brand-500/30 pl-4">
                    <p className="font-display text-xs uppercase tracking-wide text-paper-ink/40">{label}</p>
                    <p className="mt-1 text-sm text-paper-ink/80">
                      Grade level <span className="font-semibold">{r.fleschKincaidGrade}</span>
                    </p>
                    <p className="text-sm text-paper-ink/60">
                      Reading ease {r.fleschReadingEase} · {r.wordCount} words · {r.sentenceCount} sentences
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {result.sentences.length > 0 && (
              <div className="space-y-4">
                <h3 className="font-display text-xs font-bold uppercase tracking-[0.2em] text-paper-ink/50">
                  Selected sentences
                </h3>
                <ol className="space-y-4">
                  {result.sentences.map((s) => (
                    <li key={s.index} className="border-l-2 border-brand-500/30 pl-4">
                      <div className="mb-1 flex items-center justify-between font-display text-xs uppercase tracking-wide text-paper-ink/40">
                        <span>Sentence {s.index + 1}</span>
                        <span>score {s.score.toFixed(3)}</span>
                      </div>
                      <p className="text-sm italic leading-relaxed text-paper-ink/70">{s.text}</p>
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </div>
        )}
      </div>

      <TextbookPage
        eyebrow="Chapter 5"
        title="Automatic Text Summarization"
        pageNumber="Page 5"
        prevPage={{ href: "/agent", label: "Chapter 4: AI Agents and Tool Use" }}
        nextPage={{ href: "/cache", label: "Chapter 6: Semantic Caching" }}
      >
        <p>
          Long documents are slow to read, and not every sentence in one carries equal weight:
          most of a document's meaning tends to be concentrated in a handful of central sentences,
          surrounded by supporting detail, examples and asides. Skimming a full document just to
          find its main point doesn't scale once there are hundreds of documents to get through,
          which is the same problem retrieval in Chapter 3 solves for finding documents in the
          first place. This chapter is about condensing a single one, once you're already looking
          at it.
        </p>

        <h2 className="font-display text-lg font-bold text-paper-ink">
          <span className="text-brand-600">5.1</span> Two Families of Summarization
        </h2>
        <p>
          Summarization comes in two families, and the toggle above switches between working
          examples of both. <strong>Extractive</strong> summarization selects a handful of the
          document's own sentences, verbatim, and presents them in their original order as the
          summary: nothing is paraphrased or invented, which makes it far easier to trust, since
          there's no way for it to introduce a claim the source document never made, but it can
          only ever rearrange sentences that already exist. <strong>Abstractive</strong>{" "}
          summarization asks a language model to write a new, shorter version of a text in its own
          words, the same generation mechanism from Chapter 2, given a document instead of a
          question: it can compress across sentences, merge related ideas and use its own phrasing,
          at the cost of a real model call and the small chance it paraphrases something in a way
          the source didn't quite mean.
        </p>

        <h2 className="font-display text-lg font-bold text-paper-ink">
          <span className="text-brand-600">5.2</span> How Each Mode Works
        </h2>
        <p>
          <strong>Abstractive</strong> mode simply hands your text to a language model with an
          instruction to paraphrase it in roughly your target length, without copying sentences
          verbatim or adding claims the source doesn't make, the same generation step Chapter 2
          uses for chat. If a live model connection isn't available, the tool clearly labels its
          reply as a placeholder rather than a real paraphrase, since a genuine paraphrase requires
          an actual model call to produce. <strong>Extractive</strong> mode instead uses{" "}
          <strong>TextRank</strong>, a graph-based ranking algorithm: each sentence is embedded
          (the same technique from Chapter 3) and compared against every other sentence with
          cosine similarity, turning the document into a graph where a sentence's score depends on
          how well-connected it is to the rest of the document's ideas, the same random-walk idea
          behind PageRank, applied to sentences instead of web pages. Unlike abstractive mode, this
          runs for free, with no model call involved at all.
        </p>

        <Analogy>
          Extractive summarization is highlighting the most important sentences in a textbook with
          a marker: quick, free, and every highlighted word is guaranteed to be exactly what the
          author wrote. Abstractive summarization is asking a well-read friend to explain the
          chapter back to you in their own words: often clearer and more compact, but now it's
          their understanding, and their time, standing between you and the source, not the source
          itself.
        </Analogy>

        <h2 className="font-display text-lg font-bold text-paper-ink">
          <span className="text-brand-600">5.3</span> Two Smaller, Older Techniques
        </h2>
        <p>
          Extractive mode also runs two much older and simpler techniques over the same text.{" "}
          <strong>Keyword extraction</strong> counts how often each word appears after common
          function words like "the" and "of" are filtered out; the surviving high-frequency words
          are a decent guess at what a passage is actually about. It's the "term frequency" half of
          TF-IDF, a term-weighting idea from information retrieval that predates embeddings by
          decades, included here to show that not every useful text technique needs a model at all.
        </p>
        <p>
          <strong>Readability scoring</strong> answers a different question: not what the text is
          about, but how hard it is to read. The Flesch-Kincaid formulas turn three simple counts
          (words, sentences and syllables per word) into an estimated U.S. school grade level.
          Run it on both the original text and either mode's summary and compare: extractive
          summaries often score a lower (easier) grade level than the original, purely because
          TextRank tends to favor shorter, self-contained sentences, even though not a single word
          was rewritten to simplify it, while an abstractive summary's grade level depends entirely
          on how the model chose to phrase its paraphrase.
        </p>

        <h2 className="font-display text-lg font-bold text-paper-ink">
          <span className="text-brand-600">5.4</span> Why Not Just Always Use the LLM?
        </h2>
        <p>
          Given a capable model is already one prompt away, it's worth asking why extractive
          methods are still used in production systems at all, instead of every summarizer just
          calling an LLM. Two practical reasons: cost and verifiability. An abstractive call bills
          real tokens on every request, the same way Chapter 1's tokenizer counts and Chapter 2's
          chat does, while TextRank's embedding-similarity pass, like Chapter 3's retrieval or
          Chapter 6's cache, runs for free. And because an extractive summary only ever rearranges
          the source's own sentences, it can never introduce a claim the document didn't make,
          exactly the hallucination risk Chapter 2 covers, a much stronger trust guarantee than any
          abstractive rewrite can offer. Reach for extractive when the source needs to be quoted
          exactly or cost matters at scale; reach for abstractive when a compact, readable
          paraphrase matters more than either.
        </p>

        <CaseStudy company="Law Firm Document Review">
          <p>
            A law firm reviewing thousands of pages of discovery documents needs both modes for
            different reasons. Paralegals doing an initial pass use <strong>extractive</strong>{" "}
            summaries to triage which documents are worth a closer look: every sentence shown is
            quoted exactly from the source, so nothing can be misattributed to a document during
            an initial skim, and running it over thousands of pages costs nothing per page. Once a
            document is flagged as relevant, an attorney asks for an <strong>abstractive</strong>{" "}
            summary instead, trading a small per-call cost for a compact, readable overview that
            merges related clauses together, something no amount of sentence-selecting can do,
            before reading the full document firsthand.
          </p>
        </CaseStudy>

        <Sources
          items={[
            {
              label: "Mihalcea & Tarau, \"TextRank: Bringing Order into Text\" (2004)",
              href: "https://aclanthology.org/W04-3252/",
            },
            {
              label: "Brin & Page, \"The Anatomy of a Large-Scale Hypertextual Web Search Engine\" (1998): the original PageRank paper TextRank adapts",
              href: "http://infolab.stanford.edu/pub/papers/google.pdf",
            },
            {
              label: "Spärck Jones, \"A Statistical Interpretation of Term Specificity and Its Application in Retrieval\" (1972)",
              href: "https://www.emeraldinsight.com/doi/10.1108/eb026526",
            },
            {
              label: "Kincaid et al., \"Derivation of New Readability Formulas ... for Navy Enlisted Personnel\" (1975): defines the Flesch-Kincaid Grade Level formula",
              href: "https://apps.dtic.mil/sti/tr/pdf/ADA006655.pdf",
            },
            {
              label:
                "See et al., \"Get To The Point: Summarization with Pointer-Generator Networks\" (2017): a widely cited neural abstractive summarization approach",
              href: "https://arxiv.org/abs/1704.04368",
            },
          ]}
        />
      </TextbookPage>
    </div>
  );
}
