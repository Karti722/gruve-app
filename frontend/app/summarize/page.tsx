"use client";

import { useState } from "react";
import { summarizeText, type SummarizeResponse } from "@/lib/api";
import { TextbookPage } from "@/components/TextbookPage";
import { Analogy } from "@/components/Analogy";
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
  const [result, setResult] = useState<SummarizeResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function runSummarize(inputText: string, count: number) {
    if (!inputText.trim() || loading) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const response = await summarizeText(inputText, count);
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
              runSummarize(text, sentenceCount);
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
                Sentences to extract
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
                      runSummarize(sample.text, sentenceCount);
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

        {loading && <p className="text-sm italic text-paper-ink/40">Ranking sentences…</p>}
        {error && <p className="text-sm text-red-600">Error: {error}</p>}

        {result && (
          <div className="space-y-4">
            <div className="card">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2 border-b border-paper-ink/10 pb-2">
                <h3 className="font-display text-xs font-bold uppercase tracking-[0.2em] text-paper-ink/50">
                  Summary
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

      <TextbookPage eyebrow="Chapter 5" title="Automatic Text Summarization" pageNumber="Page 5">
        <p>
          Long documents are slow to read, and not every sentence in one carries equal weight:
          most of a document's meaning tends to be concentrated in a handful of central sentences,
          surrounded by supporting detail, examples and asides. Skimming a full document just to
          find its main point doesn't scale once there are hundreds of documents to get through,
          which is the same problem retrieval in Chapter 3 solves for finding documents in the
          first place. This chapter is about condensing a single one, once you're already looking
          at it.
        </p>

        <p>
          Summarization comes in two families. <strong>Abstractive</strong> summarization asks a
          language model to write a new, shorter version of a text in its own words, the same
          generation mechanism from Chapter 2, given a document instead of a question.{" "}
          <strong>Extractive</strong> summarization takes a different approach: instead of
          generating new text, it selects a handful of the document's own sentences, verbatim, and
          presents them in their original order as the summary. Nothing is paraphrased or invented:
          every word in the output already existed in the input, which makes an extractive summary
          far easier to trust: there's no way for it to introduce a claim the source document never
          made.
        </p>

        <p>
          The demo above uses a specific extractive method called <strong>TextRank</strong>, which
          scores every sentence in a document by how well-connected it is to the rest of the
          document's ideas, then keeps only the highest-scoring ones. Each sentence is converted
          into an embedding, the same technique from Chapter 3, and compared against every other
          sentence using cosine similarity, producing a similarity score for every pair. That turns
          the document into a graph: sentences are nodes, and their pairwise similarity is the
          strength of the edge connecting them. A short, iterative calculation then spreads
          "importance" across that graph: a sentence earns a high score not by being long or first,
          but by being similar to many other sentences, the same way a web page earns a high
          PageRank score by being linked to from many other important pages rather than by anything
          on the page itself.
        </p>

        <Analogy>
          Imagine everyone who has read the document is asked, independently, which other sentence
          best supports what they just said. TextRank counts those "votes", but a vote from a
          sentence that itself received a lot of votes counts for more than a vote from a sentence
          nobody else pointed to, the same recursive idea PageRank uses for links between web pages.
          After a few rounds of re-counting with that weighting, the sentences with the most (and
          most credible) support rise to the top.
        </Analogy>

        <p>
          Above, paste in a paragraph or two of your own writing, or try one of the samples, and
          choose how many sentences to extract. The result shows exactly which sentences were
          selected and their individual scores, so you can see why the algorithm chose them, the
          same kind of transparency Chapter 3's citations and Chapter 4's reasoning trace already
          gave you for retrieval and tool use.
        </p>

        <h2 className="font-display text-lg font-bold text-paper-ink">
          <span className="text-brand-600">5.1</span> Two Smaller, Older Techniques
        </h2>
        <p>
          Alongside the summary, two much older and simpler techniques run over the same text.
          <strong> Keyword extraction</strong> counts how often each word appears after common
          function words like "the" and "of" are filtered out; the surviving high-frequency words
          are a decent guess at what a passage is actually about. It's the "term frequency" half of
          TF-IDF, a term-weighting idea from information retrieval that predates embeddings by
          decades, included here to show that not every useful text technique needs a model at all.
        </p>
        <p>
          <strong>Readability scoring</strong> answers a different question: not what the text is
          about, but how hard it is to read. The Flesch-Kincaid formulas turn three simple counts
          (words, sentences and syllables per word) into an estimated U.S. school grade level.
          Longer sentences and longer words push the score up; shorter ones bring it down. Run it on
          both the original text and the extracted summary, and you can see a concrete side effect
          of extractive summarization: because TextRank tends to favor central, self-contained
          sentences, the summary's grade level is often lower than the original's, even though not a
          single word was rewritten to simplify it.
        </p>

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
          ]}
        />
      </TextbookPage>
    </div>
  );
}
