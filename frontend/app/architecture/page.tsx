import { TextbookPage } from "@/components/TextbookPage";
import { Analogy } from "@/components/Analogy";
import { ArchitectureDiagram } from "@/components/ArchitectureDiagram";
import { Sources } from "@/components/Sources";

export default function ArchitecturePage() {
  return (
    <div className="space-y-10">
      <TextbookPage eyebrow="Chapter 9" title="The System Behind This Tutorial" pageNumber="Page 9">
        <p>
          Every chapter so far has explained a concept and then let you try it. This chapter turns
          the lens on the tutorial itself: what's actually running behind these pages, and why it's
          built the way it is. Understanding this isn't required to have used any of the demos, but
          if you're curious what a real, working version of these ideas looks like end to end, this
          is that tour.
        </p>

        <h2 className="font-display text-lg font-bold text-paper-ink">
          <span className="text-brand-600">9.1</span> Four Small Programs, Not One Big One
        </h2>
        <p>
          This tutorial isn't a single program. It's four small ones, each responsible for exactly
          one job, running independently and talking to each other over the network, the same
          reasoning behind the "why microservices exist" idea from real-world software architecture:
          each piece can be built, understood and changed on its own, as long as everyone agrees on
          how they talk to each other.
        </p>
        <p>
          Concretely: a Next.js frontend, an Express backend written in TypeScript, a FastAPI
          service written in Python and a standalone Node process speaking MCP. Locally, a single
          command (<code>npm run dev</code>, from the repo root) starts all four at once and shuts
          them all down together on Ctrl-C; in production (Chapter 9.6 below) they run as three
          independently deployed containers, since the fourth, the MCP tool server, is spawned as a
          child process by the backend rather than reached over the network. Each service also owns
          its own dependencies and its own <code>Dockerfile</code>, so upgrading, say, the Python
          service's FastAPI version never touches the frontend's Next.js version or vice versa.
        </p>

        <ArchitectureDiagram />

        <h2 className="font-display text-lg font-bold text-paper-ink">
          <span className="text-brand-600">9.2</span> The Interface
        </h2>
        <p>
          This is the part you're reading right now: the pages, the text, the forms you type into.
          It's built with React (a library for building interactive interfaces out of small, reusable
          pieces) and Next.js (a framework built on top of React that handles routing between pages
          and renders them efficiently). Its job stops at the browser: it never talks to a database
          or to an AI model directly. Every time a page needs something (a chat reply, a search
          result, an agent's answer) it sends a plain request to the orchestrator described next and
          renders whatever comes back.
        </p>
        <p>
          Concretely, that's what each chapter's "Try it yourself" section is doing: the LLM Chat
          page sends your message and conversation history; the RAG page sends your question and
          renders back an answer plus its cited sources; the Agent page sends your prompt and renders
          the step-by-step trace it gets back.
        </p>
        <p>
          Next.js's "App Router" means each chapter is, quite literally, its own file: this page
          lives at <code>frontend/app/architecture/page.tsx</code>, and the URL you're reading it at
          right now is derived directly from that file's folder name, no separate routing
          configuration to keep in sync. Every one of those pages calls through a single shared
          module, <code>frontend/lib/api.ts</code>, which is the only place in the entire frontend
          that knows the backend's address or the exact shape of its JSON; a chapter's page component
          never constructs a request by hand. That's the same "one seam, not scattered calls"
          reasoning behind the backend centralizing its prompts in 9.3 below, just applied one layer
          up.
        </p>

        <h2 className="font-display text-lg font-bold text-paper-ink">
          <span className="text-brand-600">9.3</span> The Orchestrator
        </h2>
        <p>
          Sitting behind the interface is an API server: a program whose only job is to receive
          requests and decide what should happen next. It's written in TypeScript (a version of
          JavaScript that catches a category of bugs before the program ever runs) on Node.js (a
          runtime that lets that language run outside a browser, on a server), using a framework
          called Express to handle incoming web requests.
        </p>
        <p>
          Every instruction this tutorial ever sends to an AI model (the persona for plain chat, the
          "answer only from these passages" rule for RAG, the tool-use instructions for the agent)
          lives in one place inside this server, in a single file,
          <code>backend/src/prompts/systemPrompts.ts</code>, rather than being scattered across the
          code. That's a real prompt-engineering practice in its own right: keeping every prompt
          centralized and versioned makes it possible to tune the system's behavior in one spot
          instead of hunting for it.
        </p>
        <p>
          Every route also runs against one of two interchangeable implementations behind a single
          shared interface: a real one that calls Anthropic's Claude API, and a mock one that returns
          deterministic, clearly-labeled canned responses (built with simple regex-based math
          detection and keyword matching, not a real model at all). Which one gets used is decided
          once, in one place, by whether a real <code>ANTHROPIC_API_KEY</code> is configured; no
          individual route ever branches on that itself. That's what makes the "runs with or without
          an API key" claim from the very first page literally true rather than aspirational: the
          mock implementation isn't a simplified demo mode bolted on afterward, it satisfies the
          exact same interface the real one does, so every route, prompt template, retrieval step
          and tool call still runs for real regardless of which one answers at the very end.
        </p>

        <h2 className="font-display text-lg font-bold text-paper-ink">
          <span className="text-brand-600">9.4</span> Grounding Answers
        </h2>
        <p>
          The RAG chapter's vector database is real: PostgreSQL (a general-purpose database) with an
          extension called pgvector enabled, which adds a genuine nearest-neighbor search index, the
          same HNSW-style index described conceptually in Chapter 3, not a hand-rolled substitute.
          Concretely, the knowledge base this tutorial retrieves from is seven markdown files (one
          per major concept this site teaches), split into roughly 600-character overlapping chunks
          along paragraph boundaries, producing a few dozen chunks total, each stored as a
          1024-dimensional vector. That's genuinely small as vector databases go, and an exact,
          unindexed scan over that many rows would have been fast enough on its own; pgvector's HNSW
          index was still the right choice, over an in-memory or hand-rolled scan, because it's the
          pattern a production system at real scale would actually reach for, and this tutorial is
          meant to show that pattern honestly rather than a simplified stand-in for it.
        </p>
        <p>
          Turning text into those embeddings is handled by a separate, small Python service, using a
          framework called FastAPI, which calls Voyage AI's real embedding model (<code>voyage-4-lite</code>)
          rather than computing embeddings itself. That same service does most of this tutorial's
          text processing beyond the chat itself: Chapter 5's summarization ranks sentences using
          those exact same embeddings, and Chapters 6 and 7's cache and evaluator live there too,
          alongside RAG's embeddings, grouping them together because they're all "text in, numbers or
          structured data out" utilities a model orchestrator calls into, not because they share a
          single algorithm. Chapter 1's tokenizer is the one exception: it lives in the orchestrator
          itself, since counting tokens means asking Claude directly, the same AI model the
          orchestrator already talks to for everything else, not a job for this Python service at
          all. Keeping the embeddings/summarization/caching/eval concern separate from the
          orchestrator is deliberate: Python is where most machine-learning tooling lives, so
          isolating it into its own service means it can use whatever tools that ecosystem offers
          without pulling the rest of the system into Python along with it, the same "different
          languages for different jobs" reasoning any polyglot system uses.
        </p>
        <p>
          One more deliberate asymmetry: the chat, RAG-generation and abstractive-summarization
          model calls all have that mock fallback from 9.3 above, but embeddings never do. If the
          Python service starts without a real Voyage key configured, it doesn't quietly serve
          approximate results, it refuses to start at all, since its embeddings client is constructed
          the moment the service boots, not lazily on first use. The reasoning is asymmetric on
          purpose: a canned chat reply is obviously a canned chat reply, clearly labeled and
          harmless, but a fabricated embedding would look completely normal while silently
          corrupting every future search against the vector store it got written into. Failing loudly
          at startup is a deliberate trade against failing quietly later.
        </p>

        <h2 className="font-display text-lg font-bold text-paper-ink">
          <span className="text-brand-600">9.5</span> Taking Action
        </h2>
        <p>
          The tool server from Chapter 4 is not a simulated feature living inside the orchestrator;
          it's a genuinely separate program, started independently, speaking the Model Context
          Protocol over the exact same kind of connection a real MCP-compatible application would
          use. When the agent "reaches for a tool served over MCP," it is actually doing that, not
          calling a function that merely resembles it.
        </p>
        <p>
          Concretely, the orchestrator spawns the MCP server as a child process and talks to it over
          stdio (the same standard-input/standard-output channel a command-line program reads and
          writes through), exchanging the JSON-RPC messages the protocol defines: first asking it to
          list its tools, then calling whichever one the model asks for. That server currently
          exposes three: <code>get_current_time</code>, <code>get_weather</code> (a real call to
          WeatherAPI.com, not simulated) and <code>list_ai_concepts</code>. If that MCP server hasn't
          been built yet, or fails to start, the agent doesn't error out: it falls back to a small set
          of tools defined locally in the orchestrator instead (a calculator and a knowledge-base
          search), a soft failure deliberately chosen since a tutorial demo breaking outright over an
          unrelated build step would be a worse experience than it silently running one integration
          lighter for that session.
        </p>
        <p>
          Spawning a child process doesn't automatically hand it the parent's environment variables,
          a genuinely easy detail to miss: Node's stdio transport for MCP only forwards a small, safe
          allowlist (things like <code>PATH</code>) unless told otherwise, so the orchestrator has to
          explicitly forward its own environment to the MCP server it spawns, or the weather tool's
          API key would never actually reach it no matter how correctly it's set on the orchestrator
          itself. This is the same class of "it's configured correctly, but nothing actually passes
          it through" gap as the local `.env`-loading fix Chapter 10 describes for the Python service,
          just one layer further down the process tree.
        </p>

        <Analogy>
          Think of the orchestrator as a project manager who never does specialist work personally.
          Ask it a question that needs a document search, and it phones the research department (the
          vector database). Ask it to do something in the outside world, and it phones the
          field team (the tool server) instead of trying to do the job itself. The manager's real
          skill is knowing who to call and combining what comes back into one coherent answer.
        </Analogy>

        <p>
          Four small programs, one job each, talking over well-defined connections instead of
          sharing internal state, the same shape the real companies in Chapter 8 run at a much
          larger scale, just small enough here to read in one sitting.
        </p>

        <h2 className="font-display text-lg font-bold text-paper-ink">
          <span className="text-brand-600">9.6</span> From a Laptop to the Real Internet
        </h2>
        <p>
          Everything above describes how these pieces talk to each other; deploying them means
          deciding who else is allowed to reach them at all. The frontend and the backend each get a
          genuine public web address, since a browser has to reach the frontend and the frontend has
          to reach the backend. The Python embeddings service and the Postgres database do not:
          they're deliberately given no public address whatsoever, reachable only from the backend,
          the same "the browser never talks to the database directly" boundary from 9.2, just drawn
          again one layer down and enforced by the cloud host itself rather than merely by convention.
          Concretely, on the specific hosting path this tutorial documents (Google Cloud Run), that
          means an explicit IAM policy binding naming the backend's own service identity as the only
          caller the Python service will accept a request from, not just an unpublished address
          nobody happens to know.
        </p>
        <p>
          Secrets follow the same tightening: locally, API keys sit in a single plaintext
          <code>.env</code> file, gitignored so it never reaches version control. Deployed, that file
          doesn't exist at all; the Anthropic and Voyage keys and the Postgres connection string live
          in Secret Manager instead and are injected directly into each container's environment at
          startup, so a real credential is never typed into a Dockerfile, a build log or a deploy
          command in the first place.
        </p>
        <p>
          The other deliberate choice is cost. Every piece of this specific hosting path, Cloud Run's
          free tier, Voyage's free embedding tokens and a free-tier managed Postgres instance, was
          picked specifically so a fully working, publicly reachable deployment costs $0/month before
          you've sent it a single real request. Even the Anthropic key from 9.3 is optional here: skip
          it during deployment and the live, public version of this app runs in the exact same mock
          mode the local version does, rather than failing to deploy at all. Adding a real key doesn't
          change the hosting bill; it adds Anthropic's own small, separate pay-as-you-go usage cost for
          whatever you actually ask the deployed app, the one cost in this entire system that scales
          with real traffic rather than staying fixed at zero.
        </p>

        <Sources
          items={[
            {
              label: "The actual source code for this entire system, everything described above included",
              href: "https://github.com/Karti722/ai-nexus",
            },
            {
              label: "pgvector, the Postgres extension actually running this tutorial's vector database",
              href: "https://github.com/pgvector/pgvector",
            },
            {
              label: "Malkov & Yashunin, \"Efficient and Robust Approximate Nearest Neighbor Search Using HNSW Graphs\" (2016)",
              href: "https://arxiv.org/abs/1603.09320",
            },
            {
              label: "Model Context Protocol, official specification and documentation",
              href: "https://modelcontextprotocol.io",
            },
            {
              label: "Google Cloud Run documentation (the deployment target described in 9.6)",
              href: "https://docs.cloud.google.com/run/docs",
            },
          ]}
        />
      </TextbookPage>
    </div>
  );
}
