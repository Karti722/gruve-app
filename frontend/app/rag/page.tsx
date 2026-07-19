"use client";

import { useState } from "react";
import { queryRag, type RagSource } from "@/lib/api";
import { SourceCitation } from "@/components/SourceCitation";
import { KnowledgeBaseBrowser } from "@/components/KnowledgeBaseBrowser";
import { Analogy } from "@/components/Analogy";
import { TextbookPage } from "@/components/TextbookPage";
import { Sources } from "@/components/Sources";

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
    <div className="space-y-10">
      <div className="space-y-3">
        <h2 className="font-display text-xs font-bold uppercase tracking-[0.2em] text-paper-ink/50">
          Try it yourself
        </h2>

        <div className="card space-y-4">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              runQuery(question);
            }}
            className="flex flex-col gap-2 sm:flex-row"
          >
            <input
              className="input"
              placeholder="Ask about LLMs, RAG, agents, MCP, vector DBs…"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              disabled={loading}
            />
            <button
              type="submit"
              className="btn-primary shrink-0"
              disabled={loading || !question.trim()}
            >
              Ask
            </button>
          </form>

          <div>
            <p className="font-display text-xs font-bold uppercase tracking-wide text-paper-ink/40">
              Try asking
            </p>
            <ol className="mt-2 space-y-1.5 text-sm">
              {SAMPLE_QUESTIONS.map((q, i) => (
                <li key={q}>
                  <button
                    onClick={() => {
                      setQuestion(q);
                      runQuery(q);
                    }}
                    className="text-left leading-relaxed text-paper-ink/70 underline decoration-paper-ink/25 decoration-dotted underline-offset-4 transition hover:text-brand-700 hover:decoration-brand-500"
                    type="button"
                  >
                    {i + 1}. {q}
                  </button>
                </li>
              ))}
            </ol>
          </div>
        </div>

        {loading && <p className="text-sm italic text-paper-ink/40">Searching for relevant passages…</p>}
        {error && <p className="text-sm text-red-600">Error: {error}</p>}

        {answer && (
          <div className="space-y-4">
            <div className="card">
              <div className="mb-2 flex items-center justify-between border-b border-paper-ink/10 pb-2">
                <h3 className="font-display text-xs font-bold uppercase tracking-[0.2em] text-paper-ink/50">
                  Answer
                </h3>
                {mockMode !== null && (
                  <span className={`pill ${mockMode ? "text-amber-700" : "text-emerald-700"}`}>
                    {mockMode ? "MOCK MODE" : "LIVE · Anthropic"}
                  </span>
                )}
              </div>
              <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-paper-ink/90">
                {answer}
              </p>
            </div>

            <div className="space-y-4">
              <h3 className="font-display text-xs font-bold uppercase tracking-[0.2em] text-paper-ink/50">
                Retrieved sources
              </h3>
              {sources.map((s) => (
                <SourceCitation key={s.citation} source={s} />
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="space-y-3">
        <h2 className="font-display text-xs font-bold uppercase tracking-[0.2em] text-paper-ink/50">
          Read the source material
        </h2>
        <KnowledgeBaseBrowser />
      </div>

      <TextbookPage
        eyebrow="Chapter 3"
        title="Retrieval-Augmented Generation (RAG)"
        pageNumber="Page 3"
      >
        <p>
          A language model's knowledge is frozen at whatever point its training data was collected,
          and it has no built-in way to consult anything outside that data. This creates two related
          problems: it cannot answer accurately about information that didn't exist at training
          time, or that was never public in the first place, and when asked about something it
          doesn't actually know, it tends to produce a confident, fluent-sounding answer anyway, a
          failure mode usually called hallucination, since the model isn't lying so much as filling
          a gap the only way it knows how.
        </p>

        <p>
          Retrieval-Augmented Generation, or RAG, addresses this by splitting the task into two
          stages instead of relying on the model alone. A <em>retrieval</em> stage first searches a
          separate collection of documents for the passages most relevant to the question being
          asked. A <em>generation</em> stage then hands those retrieved passages to the language
          model as part of its instructions, alongside the original question, and asks it to answer
          using only that supplied material. The model is no longer answering purely from memory;
          it's reading source material at the moment it responds, the same way a person might check
          a reference before answering rather than guessing.
        </p>

        <p>
          The retrieval stage itself works through embeddings. An embedding is a list of numbers
          that represents the meaning of a piece of text as a position in a high-dimensional space,
          produced by a model trained so that texts with similar meaning end up positioned close
          together, and unrelated texts end up far apart. Every passage in the document collection
          is converted into an embedding once, ahead of time, and stored. When a question arrives,
          it's converted into an embedding the same way, and the system finds the passages whose
          embeddings sit closest to the question's, typically using cosine similarity, a measure
          of how closely two of these positions point in the same direction. The closest matches are
          the passages judged most relevant.
        </p>

        <Analogy>
          Think of an embedding as a coordinate on a map, except the map represents meaning instead
          of geography. Passages about closely related ideas land near each other on this map, and
          unrelated passages land far apart, the same way two towns close together on an ordinary
          map tend to be a short drive apart, while towns on opposite coasts aren't. Searching by
          embedding is like asking "what's nearby?" instead of demanding an exact-word match.
        </Analogy>

        <p>
          The demo above only has a few dozen passages to search, few enough that comparing a
          question's embedding directly against every stored one is instant either way. Real
          systems often store millions or billions of embeddings, where checking every single one
          for every question stops being practical. Production vector databases handle this with an
          approximate index, most commonly one called <strong>HNSW</strong> (Hierarchical Navigable
          Small World), which arranges embeddings into a graph structured so a search only has to
          follow a handful of connections to land near the true closest matches, rather than
          visiting every stored embedding directly. That trades a small, usually unnoticeable amount
          of accuracy for a very large speed gain at scale, exactly the trade-off Chapter 8 shows a
          real company making, and exactly the index this tutorial's own vector database actually
          runs, covered in more detail in Chapter 9.
        </p>

        <p>
          Finally, the model is instructed to answer strictly from the retrieved passages and to
          cite which passage supports each part of its answer, so instead of taking the response on
          faith, you can check exactly where each claim came from. That's what you should have just
          seen above: the answer itself, and the numbered source passages underneath it that were
          retrieved to produce that answer.
        </p>

        <Sources
          items={[
            {
              label: "Mikolov et al., \"Efficient Estimation of Word Representations in Vector Space\" (2013): the word2vec paper that popularized dense text embeddings",
              href: "https://arxiv.org/abs/1301.3781",
            },
            {
              label: "Lewis et al., \"Retrieval-Augmented Generation for Knowledge-Intensive NLP Tasks\" (2020): the paper that coined \"RAG\"",
              href: "https://arxiv.org/abs/2005.11401",
            },
            {
              label: "Malkov & Yashunin, \"Efficient and Robust Approximate Nearest Neighbor Search Using HNSW Graphs\" (2016)",
              href: "https://arxiv.org/abs/1603.09320",
            },
            {
              label: "pgvector: the open-source Postgres extension that implements this in a real, production vector database",
              href: "https://github.com/pgvector/pgvector",
            },
          ]}
        />
      </TextbookPage>
    </div>
  );
}
