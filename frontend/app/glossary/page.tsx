import { TextbookPage } from "@/components/TextbookPage";

const TERMS = [
  {
    term: "Agent",
    definition:
      "An AI system wrapped in a loop that lets it take actions — calling a tool, reading the result, and deciding what to do next — rather than only producing one reply. See Chapter 3.",
    source: { label: "Yao et al., \"ReAct\" (2022)", href: "https://arxiv.org/abs/2210.03629" },
  },
  {
    term: "API",
    definition:
      "A defined way for two programs to talk to each other over a network without either needing to know how the other is built internally. See Chapter 5.",
  },
  {
    term: "Cosine Similarity",
    definition:
      "A way of measuring how closely two embeddings point in the same direction, used to find the passages most relevant to a question. See Chapter 2.",
    source: { label: "Cosine similarity — Wikipedia", href: "https://en.wikipedia.org/wiki/Cosine_similarity" },
  },
  {
    term: "Embedding",
    definition:
      "A list of numbers representing the meaning of a piece of text, positioned so that similar meanings end up close together. See Chapter 2.",
    source: {
      label: "Mikolov et al., \"Efficient Estimation of Word Representations in Vector Space\" (2013)",
      href: "https://arxiv.org/abs/1301.3781",
    },
  },
  {
    term: "Fine-Tuning",
    definition:
      "Further training an existing model on a smaller, specific dataset so it adapts to a narrower task — a different approach from RAG, which leaves the model unchanged and supplies context at answer time instead.",
    source: {
      label: "Fine-tuning (deep learning) — Wikipedia",
      href: "https://en.wikipedia.org/wiki/Fine-tuning_(deep_learning)",
    },
  },
  {
    term: "Hallucination",
    definition:
      "A confident, fluent-sounding answer that is factually wrong, produced when a model is asked about something outside both its training and its current context. See Chapter 1.",
    source: {
      label: "Ji et al., \"Survey of Hallucination in Natural Language Generation\" (2022)",
      href: "https://arxiv.org/abs/2202.03629",
    },
  },
  {
    term: "HNSW",
    definition:
      "Hierarchical Navigable Small World — an indexing structure that lets a vector database skip most of its stored data and still find near-perfect matches quickly. See Chapter 5.",
    source: {
      label: "Malkov & Yashunin, \"Efficient and Robust Approximate Nearest Neighbor Search Using HNSW Graphs\" (2016)",
      href: "https://arxiv.org/abs/1603.09320",
    },
  },
  {
    term: "MCP (Model Context Protocol)",
    definition:
      "An open standard that lets any AI application discover and call tools exposed by any external service, without a custom integration for every pairing. See Chapter 3.",
    source: {
      label: "Anthropic, \"Introducing the Model Context Protocol\" (2024)",
      href: "https://www.anthropic.com/news/model-context-protocol",
    },
  },
  {
    term: "Microservices",
    definition:
      "An architecture that splits an application into small, independent programs, each with one job, communicating over the network instead of sharing internal state. See Chapter 5.",
  },
  {
    term: "ReAct",
    definition:
      "Short for \"reason and act\" — the think, act, observe, repeat cycle an agent follows: decide what's needed, call a tool, read the result, and decide again. See Chapter 3.",
    source: { label: "Yao et al., \"ReAct\" (2022)", href: "https://arxiv.org/abs/2210.03629" },
  },
  {
    term: "Retrieval-Augmented Generation (RAG)",
    definition:
      "A technique that searches a document collection for relevant passages and supplies them to a language model before it answers, instead of relying on the model's memory alone. See Chapter 2.",
    source: {
      label: "Lewis et al., \"Retrieval-Augmented Generation for Knowledge-Intensive NLP Tasks\" (2020)",
      href: "https://arxiv.org/abs/2005.11401",
    },
  },
  {
    term: "Token",
    definition:
      "A small piece of text — often a whole word or a few characters — that is the basic unit a language model reads and generates, one at a time. See Chapter 1.",
    source: {
      label: "Vaswani et al., \"Attention Is All You Need\" (2017)",
      href: "https://arxiv.org/abs/1706.03762",
    },
  },
  {
    term: "Tool",
    definition:
      "A defined capability — a calculator, a search function, a request to another system — that an agent is allowed to call, along with a description of what it does and what input it expects. See Chapter 3.",
    source: { label: "Yao et al., \"ReAct\" (2022)", href: "https://arxiv.org/abs/2210.03629" },
  },
  {
    term: "Vector Database",
    definition:
      "A database built to store embeddings and quickly find the ones most similar to a given query, typically using an approximate index like HNSW at scale. See Chapters 2, 4, and 5.",
    source: {
      label: "pgvector — open-source vector search for Postgres",
      href: "https://github.com/pgvector/pgvector",
    },
  },
];

export default function GlossaryPage() {
  return (
    <div className="space-y-10">
      <TextbookPage eyebrow="Reference" title="Glossary of Key Terms" pageNumber="Glossary">
        <p>
          Every term introduced across the six chapters of this tutorial, gathered in one place.
          Each entry links back to the chapter where it's explained in full, and to a real source
          where one exists.
        </p>

        <dl className="space-y-5 border-t border-paper-ink/10 pt-6">
          {TERMS.map(({ term, definition, source }) => (
            <div key={term}>
              <dt className="font-display text-base font-bold text-paper-ink">{term}</dt>
              <dd className="mt-1 text-[15.5px] leading-relaxed text-paper-ink/80">{definition}</dd>
              {source && (
                <a
                  href={source.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1 inline-block text-xs text-paper-ink/50 underline decoration-paper-ink/25 underline-offset-4 transition hover:text-brand-700 hover:decoration-brand-500"
                >
                  Source: {source.label}
                </a>
              )}
            </div>
          ))}
        </dl>
      </TextbookPage>
    </div>
  );
}
