import Link from "next/link";
import { ConceptCard } from "@/components/ConceptCard";

const CONCEPTS = [
  {
    title: "LLM Chat",
    description:
      "Multi-turn chat backed by the Anthropic Messages API, with a versioned system prompt and clean REST separation between frontend and backend.",
    tags: ["LLMs", "Prompt engineering", "REST API"],
  },
  {
    title: "Retrieval-Augmented Generation",
    description:
      "Ask a question and watch it get embedded, matched against a vector store via cosine similarity, and answered with numbered citations back to source passages.",
    tags: ["RAG", "Vector search", "Embeddings"],
  },
  {
    title: "AI Agents + Tool Use",
    description:
      "A ReAct-style loop where the model chooses to call a calculator, search the knowledge base, or reach for external tools — with every step of its reasoning shown.",
    tags: ["AI agents", "Tool calling", "Orchestration"],
  },
  {
    title: "Model Context Protocol",
    description:
      "A standalone MCP server (its own OS process) exposes tools over stdio JSON-RPC; the agent connects as an MCP client, exactly like Claude Desktop or Claude Code would.",
    tags: ["MCP", "Protocols", "Interop"],
  },
  {
    title: "Polyglot Microservices",
    description:
      "A Python/FastAPI service generates text embeddings and is called over HTTP by the Node.js backend — independent language, independent deploy, independent scale.",
    tags: ["Python", "Microservices", "FastAPI"],
  },
  {
    title: "Full-Stack + Containers",
    description:
      "Next.js/React frontend, Express/TypeScript API, and a Python service, each with their own Dockerfile and wired together with docker-compose.",
    tags: ["Next.js", "Docker", "TypeScript"],
  },
];

export default function HomePage() {
  return (
    <div className="space-y-12">
      <section className="space-y-4">
        <p className="pill inline-block">Gruve · AI Vibe Coding Engineer — concept demo</p>
        <h1 className="text-4xl font-bold tracking-tight text-white">
          One small full-stack app, every concept from the job posting.
        </h1>
        <p className="max-w-2xl text-white/70">
          This app is a working demonstration of LLM integration, RAG, prompt engineering, AI
          agents, MCP servers, vector embeddings, and a polyglot microservices architecture —
          shipped as a real Next.js + Express + FastAPI codebase, not slides. Explore each concept
          live using the nav above.
        </p>
        <div className="flex flex-wrap gap-3 pt-2">
          <Link href="/chat" className="btn-primary">
            Try the chat demo →
          </Link>
          <Link
            href="/agent"
            className="rounded-lg border border-white/15 px-4 py-2 font-medium text-white/80 transition hover:bg-white/5"
          >
            Watch an agent think
          </Link>
        </div>
      </section>

      <section className="grid gap-5 sm:grid-cols-2">
        {CONCEPTS.map((concept) => (
          <ConceptCard key={concept.title} {...concept} />
        ))}
      </section>

      <section className="card">
        <h2 className="mb-2 text-lg font-semibold text-white">Runs with or without an API key</h2>
        <p className="text-sm leading-relaxed text-white/70">
          Set <code className="rounded bg-white/10 px-1.5 py-0.5">ANTHROPIC_API_KEY</code> in your{" "}
          <code className="rounded bg-white/10 px-1.5 py-0.5">.env</code> for real Claude
          responses. Leave it blank and the backend automatically falls back to a deterministic
          mock LLM — every request, response shape, tool call, and citation still flows through
          the real pipeline; only the model call itself is canned, and it's always labeled{" "}
          <span className="text-white/90">[MOCK MODE]</span> so it's never mistaken for a live
          answer.
        </p>
      </section>
    </div>
  );
}
