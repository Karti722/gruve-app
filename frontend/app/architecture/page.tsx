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
          built the way it is. Understanding this isn't required to have used any of the demos — but
          if you're curious what a real, working version of these ideas looks like end to end, this
          is that tour.
        </p>

        <h2 className="font-display text-lg font-bold text-paper-ink">
          <span className="text-brand-600">9.1</span> Four Small Programs, Not One Big One
        </h2>
        <p>
          This tutorial isn't a single program. It's four small ones, each responsible for exactly
          one job, running independently and talking to each other over the network — the same
          reasoning behind the "why microservices exist" idea from real-world software architecture:
          each piece can be built, understood, and changed on its own, as long as everyone agrees on
          how they talk to each other.
        </p>

        <ArchitectureDiagram />

        <h2 className="font-display text-lg font-bold text-paper-ink">
          <span className="text-brand-600">9.2</span> The Interface
        </h2>
        <p>
          This is the part you're reading right now — the pages, the text, the forms you type into.
          It's built with React (a library for building interactive interfaces out of small, reusable
          pieces) and Next.js (a framework built on top of React that handles routing between pages
          and renders them efficiently). Its job stops at the browser: it never talks to a database
          or to an AI model directly. Every time a page needs something — a chat reply, a search
          result, an agent's answer — it sends a plain request to the orchestrator described next and
          renders whatever comes back.
        </p>
        <p>
          Concretely, that's what each chapter's "Try it yourself" section is doing: the LLM Chat
          page sends your message and conversation history; the RAG page sends your question and
          renders back an answer plus its cited sources; the Agent page sends your prompt and renders
          the step-by-step trace it gets back.
        </p>

        <h2 className="font-display text-lg font-bold text-paper-ink">
          <span className="text-brand-600">9.3</span> The Orchestrator
        </h2>
        <p>
          Sitting behind the interface is an API server — a program whose only job is to receive
          requests and decide what should happen next. It's written in TypeScript (a version of
          JavaScript that catches a category of bugs before the program ever runs) on Node.js (a
          runtime that lets that language run outside a browser, on a server), using a framework
          called Express to handle incoming web requests.
        </p>
        <p>
          Every instruction this tutorial ever sends to an AI model — the persona for plain chat, the
          "answer only from these passages" rule for RAG, the tool-use instructions for the agent —
          lives in one place inside this server, rather than being scattered across the code. That's
          a real prompt-engineering practice in its own right: keeping every prompt centralized and
          versioned makes it possible to tune the system's behavior in one spot instead of hunting
          for it.
        </p>

        <h2 className="font-display text-lg font-bold text-paper-ink">
          <span className="text-brand-600">9.4</span> Grounding Answers
        </h2>
        <p>
          The RAG chapter's vector database is real: PostgreSQL (a general-purpose database) with an
          extension called pgvector enabled, which adds a genuine nearest-neighbor search index — the
          same HNSW-style index described conceptually in Chapter 3, not a hand-rolled substitute.
        </p>
        <p>
          Turning text into the embeddings that database stores is handled by a separate, small
          Python service, using a framework called FastAPI. That same service does most of this
          tutorial's text processing beyond the chat itself: Chapter 5's summarization ranks
          sentences using the exact same embeddings, and Chapter 1's tokenizer along with Chapters
          6 and 7's cache and evaluator all live there too, alongside RAG's embeddings — grouping
          them together because they're all "text in, numbers or structured data out" utilities a
          model orchestrator calls into, not because they share a single algorithm. Keeping this
          concern separate from the orchestrator is deliberate: Python is where most machine-learning
          tooling lives, so isolating it into its own service means it can use whatever tools that
          ecosystem offers without pulling the rest of the system into Python along with it — the
          same "different languages for different jobs" reasoning any polyglot system uses.
        </p>

        <h2 className="font-display text-lg font-bold text-paper-ink">
          <span className="text-brand-600">9.5</span> Taking Action
        </h2>
        <p>
          The tool server from Chapter 4 is not a simulated feature living inside the orchestrator —
          it's a genuinely separate program, started independently, speaking the Model Context
          Protocol over the exact same kind of connection a real MCP-compatible application would
          use. When the agent "reaches for a tool served over MCP," it is actually doing that, not
          calling a function that merely resembles it.
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
          sharing internal state — the same shape the real companies in Chapter 8 run at a much
          larger scale, just small enough here to read in one sitting.
        </p>

        <Sources
          items={[
            {
              label: "pgvector — the Postgres extension actually running this tutorial's vector database",
              href: "https://github.com/pgvector/pgvector",
            },
            {
              label: "Malkov & Yashunin, \"Efficient and Robust Approximate Nearest Neighbor Search Using HNSW Graphs\" (2016)",
              href: "https://arxiv.org/abs/1603.09320",
            },
            {
              label: "Model Context Protocol — official specification and documentation",
              href: "https://modelcontextprotocol.io",
            },
          ]}
        />
      </TextbookPage>
    </div>
  );
}
