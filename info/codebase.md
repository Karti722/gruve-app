# AI Nexus: Codebase Guide

**AI Nexus** is a small full-stack application built to demonstrate, in working code, the core
concepts behind modern AI engineering: not slides, not a tutorial, a real running system. It's
meant to work for two audiences at once: engineers evaluating the implementation, and newcomers
who want to see how LLMs, RAG, agents, MCP and the applied engineering around them actually fit
together by using them directly.

| Concept | Where it lives in this repo |
|---|---|
| Large Language Models (LLMs) | `backend/src/llm/`: Anthropic Claude integration + prompt templates |
| Retrieval-Augmented Generation (RAG) | `backend/src/rag/` + `/rag` page |
| Prompt engineering | `backend/src/prompts/systemPrompts.ts` |
| AI agents & tool use | `backend/src/agent/` + `/agent` page |
| Model Context Protocol (MCP) | `mcp-server/` (a real MCP server) + `backend/src/agent/mcpClient.ts` (a real MCP client) |
| Vector databases & embeddings | `backend/src/rag/vectorStore.ts` (real pgvector + HNSW index), `backend/src/rag/embeddingsClient.ts` → `python-service/app/embeddings.py` (real Voyage AI embeddings) |
| Automatic summarization | `backend/src/routes/summarize.route.ts`, a toggle between abstractive (a real Claude call) and extractive (`python-service/app/summarizer.py`, TextRank) + `/summarize` page |
| Tokenization & cost estimation | `backend/src/routes/tokenizer.route.ts` (real Claude token count via the Anthropic API) + `/tokenizer` page |
| Semantic caching | `python-service/app/semantic_cache.py` + `/cache` page |
| Evaluating AI outputs | `python-service/app/eval.py` + `/eval` page |
| Python | `python-service/` (FastAPI microservice; see section 1 for what it does and why) |
| JavaScript/TypeScript, Node.js | `backend/`, `mcp-server/` |
| React/Next.js | `frontend/` |
| REST APIs & microservices architecture | Express API in `backend/`, FastAPI service in `python-service/`, communicating over HTTP |
| Docker | a `Dockerfile` per service + root `docker-compose.yml` |
| Git/GitHub | tracked in git with a full commit history and a GitHub remote; `.gitignore` provided |

The app runs **with or without** an Anthropic API key. Without one, every request still flows
through the real pipeline (routing, prompt templates, retrieval, tool-calling); only the final
model call is replaced by a deterministic mock, always labeled `[MOCK MODE]` in the UI so it's
never mistaken for a live answer.

---

## 1. Why split it this way: Next.js app + Node orchestrator + Python microservice

This app is three services, not one, and not an arbitrary three: each boundary exists for a
specific reason, and the split is itself one of the concepts the app teaches (see the
Microservices glossary entry and Chapter 9).

**What the Next.js app is for.** It renders pages and nothing else. There is no business logic in
`frontend/`: no prompts, no retrieval logic, no algorithm implementations, not even light data
transformation beyond typed fetch wrappers in `lib/api.ts`. Every "Try it yourself" section is a
thin form: collect input, `POST` it to the backend, render whatever JSON comes back. This is
deliberate, not an oversight: it means the entire user-facing surface can be reasoned about,
tested and redesigned (this app went through several full visual redesigns; see Chapter 10)
without touching a single line of the logic it's displaying.

**What the Node/Express backend is for.** It's the orchestrator: the one place that knows what a
"chat request" or an "agent run" actually means. Every prompt template lives here
(`src/prompts/systemPrompts.ts`), the agent's think-act-observe loop lives here
(`src/agent/agentLoop.ts`) and it's the only service that talks to the Anthropic API and to the
MCP tool server. It's written in Node/TypeScript rather than Python for a concrete reason, not just
convention: Anthropic's SDK, the MCP SDK and this app's own frontend are all TypeScript, so keeping
the orchestration layer in the same language as the tools it coordinates avoids a second
serialization boundary between "the code that talks to Claude" and "the code that talks to MCP."

**What the Python microservice is for (and, as importantly, what it isn't for).** It does not
orchestrate anything, hold conversation state, call the LLM or know what a "chat" or "agent" is.
Every one of its endpoints is a pure function's worth of responsibility: text in, a number or a
small structured result out: `/embed` (text → vector), `/summarize` (text → ranked sentences +
keywords + readability, the extractive path only), `/tokenize` (text → tokens + cost estimate),
`/cache-sim` (a list of queries → hit/miss trace), `/evaluate` (two strings → similarity scores).
None of them need to know about any other endpoint, which is exactly the property that makes them
safe to group into one small service instead of five. Summarization's *other* mode, abstractive,
deliberately isn't here at all: it's a real Claude call, which means it belongs with the rest of
the LLM-calling orchestration in the Node backend (`summarize.route.ts` calls `llmClient` directly
for that mode), not with this service's dependency-free, no-model-call algorithms.

**Why a separate service at all, instead of writing all of this directly in the Node backend?**
Two reasons, one practical and one pedagogical. Practically, Python is where the ecosystem for this
kind of text/ML-adjacent processing actually lives: even though this app deliberately avoids heavy
dependencies (no downloaded models, no GPU), the moment any of these features needed something like
`numpy`, `scikit-learn` or a real embeddings model, that upgrade is a one-file change inside
`python-service/`, not a rewrite. Pedagogically, this is exactly the shape real applied-AI teams use
in production: a product/orchestration backend in whatever language the rest of the product is
built in, and a Python service (sometimes owned by a separate ML/data team entirely) for anything
that benefits from that ecosystem; see Chapter 8 for real companies running this same split at
much larger scale.

**Why not the opposite: put everything in Python, including the orchestration?** Because the
orchestrator's job (routing between the LLM, retrieval and tools; holding the agent loop; managing
prompts) is fundamentally about *coordinating* other services, and this app's other services (the
Anthropic SDK, the MCP client/server) are already TypeScript. Splitting orchestration into Python
would mean either duplicating that tooling in a second language or adding a network hop just to
call back into Node, for no benefit. The Python service earns its place by doing self-contained
work Node has no particular advantage at; it doesn't earn a role coordinating everything else.

**What this buys the app in practice:** each service can be built, tested, restarted and deployed
independently (see `deployment.md`: `python-service` is never even publicly exposed in production,
since only the backend needs to reach it); a crash or slowdown in text-processing code can't take
down chat or the agent loop, and vice versa; and the whole thing is a genuine, runnable example of
the "polyglot microservices" pattern this app also has a glossary entry and a dedicated architecture
chapter for, rather than an in-name-only label on what's actually a single monolith.

---

## 2. Tech stack choices, and what else was considered

None of these were the only reasonable choice. Each one below was picked over specific,
named alternatives for a specific reason, and each has a real trade-off, not just an upside.

**Frontend: Next.js (App Router) + React + TypeScript + Tailwind CSS.** Considered instead: plain
Vite + React, Remix, SvelteKit/Vue or a server-rendered template engine. Next's file-based routing
maps 1:1 onto this app's chapter structure: every chapter is one folder, so adding, removing or
reordering a chapter (this guide has done all three) is a mechanical change to the filesystem and a
couple of ordered lists, not a routing-config edit. It also ships a production build story (static
prerendering per route; see the route table any `npm run build` prints) with no extra tooling
assembled by hand, unlike bare Vite + React. The trade-off: App Router brings real complexity
(Server/Client Component boundaries, a `"use client"` directive on every interactive page) that
this app barely uses: every page is a client component fetching from the browser, the same shape
a plain SPA would have, so a meaningful slice of what Next.js offers (server data-fetching,
streaming) goes unused here. Tailwind, over CSS Modules or a component library like MUI, because
the "printed textbook" identity (custom `paper`, `paper-ink`, `brand-*` tokens in
`tailwind.config.ts`) can be defined once and composed directly in JSX, useful given this app's
visual design has been fully rebuilt from scratch more than once (see Chapter 10).

**Orchestrator: Node.js + Express + TypeScript.** Considered instead: Python (FastAPI/Django/
Flask) for the whole backend, a heavier Node framework (NestJS) or a different language (Go). The
deciding factor is covered in section 1: Anthropic's SDK, the MCP SDK and the frontend are all
TypeScript, so the layer that has to speak to all three benefits from being in that same language,
with no serialization boundary at every hop. Express specifically, over NestJS, because this
backend's routing needs are simple (validate input, call a module, return JSON) and don't need
NestJS's dependency-injection/decorator machinery, which pays for itself in larger codebases more
than it would here. The trade-off: Express gives almost nothing for free: no built-in validation,
no OpenAPI generation, none of FastAPI's automatic typing from Pydantic models. Every route here
hand-writes its own type guard rather than leaning on a validation library, which is fine at this
app's route count but wouldn't stay clean at ten times the size without adding something like
`zod`.

**Microservice: Python + FastAPI.** Considered instead: implementing the same algorithms in
TypeScript inside the Node backend, or Flask/Django instead of FastAPI. The full reasoning is in
section 1: Python is where this class of tooling actually lives, even in a version of this app
that deliberately doesn't pull in any of it yet. FastAPI specifically, over Flask, for its
built-in Pydantic request/response validation and automatic OpenAPI docs (served at the running
service's `/docs`): every endpoint added to this service (`/tokenize`, `/cache-sim`, `/evaluate`
included) got a validated, typed contract for free just by declaring a `BaseModel`, with no
separate validation code written by hand. The trade-off: a second language means a second
install step, a second set of typing conventions and a real network hop with real failure modes
(see `embeddingsClient.ts`, which throws a clear error rather than degrading silently if that hop
fails) where an in-process function call would do if everything were TypeScript; worth it here
because every algorithm this service hosts is naturally self-contained and never needs to share
memory or a transaction with the orchestrator.

**Database: PostgreSQL + pgvector.** Considered instead: a dedicated vector database (Pinecone,
Weaviate, Qdrant, Milvus), an embedded option (Chroma) or an in-memory brute-force scan. pgvector
adds real HNSW-indexed nearest-neighbor search to a database that's otherwise a completely
ordinary, boring, well-understood relational store: no new category of infrastructure to run,
monitor or back up, and it's supported natively or near-natively on every major cloud's managed
Postgres (see `deployment.md`). The trade-off: a dedicated vector database would genuinely
outperform pgvector at extreme scale (billions of vectors) and offers more vector-specific features
out of the box. At this app's actual data volume (a few dozen knowledge-base chunks), that ceiling
is irrelevant, so the simpler, more boring option won; Chapter 8 and `06-vector-databases.md` cover
the general version of this exact trade-off, the one real companies make at a different scale.

**Docker + Docker Compose.** Considered instead: no containerization (a documented local-setup-only
story), or committing to Kubernetes from the start. This app is four independently runnable
services across two runtimes plus Postgres: Compose is the lightest tool that still makes
`docker compose up` reproduce an identical environment on any machine, rather than asking a new
contributor to install Python, Node and Postgres natively and configure all three correctly by
hand. It's also what makes each service's own `Dockerfile` genuinely portable to any container
platform, not just the specific one `deployment.md` documents (Cloud Run): the same image would run
unmodified on any other container host. The trade-off: Kubernetes offers real production primitives
(rolling deploys, autoscaling, self-healing) Compose doesn't have, irrelevant to a single-instance
demo deployment, which is why `deployment.md` documents Cloud Run specifically rather than Kubernetes
at all.

**LLM provider: Anthropic Claude.** Considered instead: OpenAI's API, or a self-hosted open-source
model (Llama, Mistral). This app's `LLMClient` interface (`backend/src/llm/types.ts`) is
deliberately provider-agnostic (`chat()` and `step()` are the entire contract) specifically so
the model is a swappable implementation, not a design constraint baked into every route. Claude was
picked as the concrete implementation partly because MCP's own tool-use shape was modeled by the
same company, keeping Chapter 9's "real MCP, not a simulation" claim consistent end to end.
Switching providers means writing one more file implementing the same interface `anthropicClient.ts`
does; nothing else in the app changes. The trade-off: no self-hosting means real dependence on a
third party's uptime, pricing and rate limits, mitigated entirely by mock mode (see the Notes
section), which is why mock mode is this app's actual default state, not a fallback bolted on
after the fact.

---

## 3. Directory structure

```
ai-nexus/
├── README.md                      # start here: what this project is, and a map of the docs below
├── info/
│   ├── codebase.md                # this file: architecture + local setup
│   ├── deployment.md              # how this app was deployed to GCP (Cloud Run + Neon), by hand, for $0/month
│   └── CI-CD.md                   # how deployment.md's redeploy steps got automated with GitHub Actions, and why
├── package.json                   # root orchestration scripts (npm run dev, npm run stop, etc.)
├── docker-compose.yml             # wires postgres (pgvector), python-service, backend, frontend together
├── .env.example                   # copy to .env and fill in what you have
├── .gitignore
├── .github/
│   └── workflows/
│       └── deploy.yml             # info/CI-CD.md's GitHub Actions workflow: build, push, redeploy on push to main
├── scripts/
│   ├── dev.js                     # npm run dev: runs all services, auto-cleans up on exit/Ctrl+C
│   └── stop-all.js                # npm run stop: kills every service npm run dev starts
│
├── backend/                       # Node.js + TypeScript + Express REST API
│   ├── package.json
│   ├── tsconfig.json
│   ├── Dockerfile
│   ├── data/
│   │   ├── knowledge-base/        # markdown docs the RAG pipeline indexes
│   │   │   ├── 01-llms.md
│   │   │   ├── 02-rag.md
│   │   │   ├── 03-prompt-engineering.md
│   │   │   ├── 04-ai-agents.md
│   │   │   ├── 05-mcp.md
│   │   │   ├── 06-vector-databases.md
│   │   │   └── 07-fullstack-and-devtools.md
│   └── src/
│       ├── server.ts              # Express app entrypoint
│       ├── config.ts              # env var loading + mock-mode detection
│       ├── pythonServiceAuth.ts   # attaches a Google ID token to python-service calls when deployed (see info/deployment.md Step 4)
│       ├── prompts/
│       │   └── systemPrompts.ts   # versioned prompt templates (chat/RAG/agent)
│       ├── llm/
│       │   ├── types.ts           # provider-agnostic LLM client interface
│       │   ├── anthropicClient.ts # real Claude implementation
│       │   ├── mockLLM.ts         # offline deterministic stand-in
│       │   └── index.ts           # picks real vs. mock based on config
│       ├── rag/
│       │   ├── chunker.ts         # splits markdown into overlapping chunks
│       │   ├── embeddingsClient.ts# calls python-service for embeddings, throws on failure
│       │   ├── vectorStore.ts     # Postgres + pgvector store, HNSW-indexed cosine search
│       │   └── seedDocuments.ts   # loads knowledge-base/*.md into the vector store
│       ├── agent/
│       │   ├── tools.ts           # local tools: calculator, search_knowledge_base
│       │   ├── mcpClient.ts       # MCP client: spawns & talks to mcp-server/
│       │   └── agentLoop.ts       # the think → act → observe → answer loop
│       ├── summarize/
│       │   └── summarizeClient.ts # calls python-service's /summarize (extractive mode only)
│       ├── cache/
│       │   └── cacheClient.ts     # calls python-service's /cache-sim
│       ├── eval/
│       │   └── evalClient.ts      # calls python-service's /evaluate
│       ├── routes/
│       │   ├── chat.route.ts      # POST /api/chat
│       │   ├── rag.route.ts       # POST /api/rag/query
│       │   ├── agent.route.ts     # POST /api/agent/run
│       │   ├── summarize.route.ts # POST /api/summarize (mode: "abstractive" calls llmClient, "extractive" calls python-service)
│       │   ├── tokenizer.route.ts # POST /api/tokenize (calls Anthropic's real count_tokens API directly)
│       │   ├── cache.route.ts     # POST /api/cache-sim
│       │   └── eval.route.ts      # POST /api/evaluate
│       └── utils/
│           └── errors.ts          # extracts a real, user-facing message from thrown errors
│
├── mcp-server/                    # standalone Model Context Protocol server
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
│       └── index.ts               # exposes get_current_time, get_weather, list_ai_concepts
│
├── python-service/                # Python + FastAPI microservice
│   ├── requirements.txt
│   ├── Dockerfile
│   ├── package.json               # npm script shims so root `npm run dev` can launch it too
│   └── app/
│       ├── main.py                # FastAPI app: /health, /embed, /summarize, /cache-sim, /evaluate
│       ├── embeddings.py          # real Voyage AI embeddings (voyage-4-lite)
│       ├── summarizer.py          # TextRank extractive summarization
│       ├── keywords.py            # term-frequency keyword extraction
│       ├── readability.py         # Flesch / Flesch-Kincaid readability scoring
│       ├── semantic_cache.py      # embedding-similarity cache simulation
│       └── eval.py                # exact-match / ROUGE-L / semantic-similarity eval harness
│
└── frontend/                      # Next.js 14 (App Router) + TypeScript + Tailwind
    ├── package.json
    ├── next.config.js
    ├── tailwind.config.ts
    ├── Dockerfile                 # declares NEXT_PUBLIC_API_BASE_URL as an ARG/ENV so `docker build --build-arg` actually reaches `next build` (see below)
    ├── lib/
    │   └── api.ts                 # typed fetch wrappers around every backend endpoint
    ├── components/
    │   ├── NavBar.tsx
    │   ├── ConceptCard.tsx
    │   ├── ChatWindow.tsx
    │   ├── SourceCitation.tsx
    │   ├── AgentTrace.tsx
    │   ├── WeatherCard.tsx         # rich visual for get_weather's trace result
    │   ├── CalculatorCard.tsx      # rich visual for calculator's trace result
    │   ├── KnowledgeBaseResults.tsx # rich visual for search_knowledge_base's trace result
    │   ├── TextbookPage.tsx
    │   ├── Analogy.tsx
    │   ├── CaseStudy.tsx
    │   ├── Sources.tsx
    │   └── ArchitectureDiagram.tsx
    └── app/
        ├── layout.tsx              # shared shell (nav + page container)
        ├── globals.css             # Tailwind + shared utility classes
        ├── page.tsx                 # landing page: table of contents
        ├── introduction/page.tsx    # front matter: why this guide exists
        ├── tokenizer/page.tsx       # Ch.1: tokenization & cost demo
        ├── chat/page.tsx            # Ch.2: LLM chat demo
        ├── rag/page.tsx             # Ch.3: RAG demo
        ├── agent/page.tsx           # Ch.4: AI agent + MCP demo
        ├── summarize/page.tsx       # Ch.5: toggle between abstractive (Claude) and extractive (TextRank) summarization
        ├── cache/page.tsx           # Ch.6: semantic caching demo
        ├── eval/page.tsx            # Ch.7: AI-output evaluation demo
        ├── enterprise/page.tsx      # Ch.8: real-world case studies
        ├── architecture/page.tsx    # Ch.9: this system's own architecture
        ├── building/page.tsx        # Ch.10: how this tutorial was built
        └── glossary/page.tsx        # reference: every term, linked back to its chapter
```

---

## 4. File-by-file explanation

### Root
- **`README.md`**: the entry point for anyone landing on this repo: what AI Nexus is, at a glance,
  and a map pointing to `info/codebase.md`, `info/deployment.md` and `info/CI-CD.md` for everything
  else.
- **`package.json`**: orchestration only. `npm run dev` runs `scripts/dev.js`, which drives
  `concurrently` to boot the backend, frontend, Python service and MCP server watch-build all at
  once.
- **`docker-compose.yml`**: four containers: `postgres` (Postgres + the pgvector extension,
  backing the RAG vector store), `python-service`, `backend` (which also bundles `mcp-server` into
  its image, since the agent spawns MCP as a child process) and `frontend`.
- **`.env.example`**: every environment variable the app reads, each with an inline comment
  explaining what it's for and what happens if it's left blank.
- **`scripts/dev.js`**: powers `npm run dev`. Drives `concurrently` programmatically (rather than
  shelling out to its CLI) specifically so it can run `stop-all.js`'s cleanup automatically when
  `npm run dev` exits or is interrupted; see the "Stopping everything" note in section 6 for the
  reliability caveat on Windows.
- **`scripts/stop-all.js`**: powers `npm run stop` (and is what `dev.js` calls internally on
  exit). Finds and kills anything listening on this app's ports plus any lingering
  mcp-server/dev.js watcher processes, so a half-killed `npm run dev` (common on Windows; see
  section 6) doesn't block the next one from starting.

### `info/`: everything beyond "what is this" and "how do I run it"
- **`codebase.md`**: this file, architecture and local setup.
- **`deployment.md`**: step-by-step guide for how this app was deployed to GCP (Cloud Run + a free
  [Neon](https://neon.tech)-hosted `pgvector` Postgres instance) for a genuine **$0/month**, from a
  completely blank starting point, no cloud account or tooling installed yet. Ends by pointing at
  `CI-CD.md` for automating future redeploys, rather than documenting that by hand itself.
- **`CI-CD.md`**: automates the redeploy steps `deployment.md` would otherwise have you run by hand,
  via a GitHub Actions workflow (`.github/workflows/deploy.yml`) that rebuilds, pushes and redeploys
  on every push to `main`, authenticating via Workload Identity Federation rather than a
  downloadable service account key. Explicitly requires `deployment.md` to already be fully done
  and confirmed working first: this file has no steps of its own for creating the underlying Cloud
  Run services, secrets or database, only for automating redeploys onto ones that already exist.

### `backend/`: the Express REST API (the orchestrator, see section 1)
- **`src/config.ts`**: loads `.env` once and exposes a typed `config` object, including the
  `isMockMode` getter that everything else keys off of, and `frontendUrls` (parsed from the
  comma-separated `FRONTEND_URL` env var) that scopes the CORS policy in `server.ts`.
- **`src/prompts/systemPrompts.ts`**: every prompt sent to the LLM lives here, not inline in
  route handlers: `CHAT_SYSTEM_PROMPT` (persona/tone), `buildRagPrompt()` (grounding + citation
  instructions), `AGENT_SYSTEM_PROMPT` (ReAct tool-use instructions), plus a documented few-shot
  example block.
- **`src/llm/`**: `types.ts` defines a provider-agnostic `LLMClient` interface (`chat()` and
  `step()` for agent tool-calling). `anthropicClient.ts` implements it against the real Anthropic
  Messages API (including proper `tool_use`/`tool_result` content-block handling).
  `mockLLM.ts` implements the same interface with deterministic heuristics (regex-based math
  detection, keyword-based tool matching) so the whole app is demoable offline.
  `index.ts` picks one implementation based on `config.isMockMode`; routes never branch on it.
- **`src/rag/`**
  - `chunker.ts`: splits a markdown file into ~600-character overlapping chunks along paragraph
    boundaries.
  - `embeddingsClient.ts`: POSTs text to the Python service's `/embed`, retrying up to 5 times on
    a 1-second delay before giving up, since `npm run dev` starts `backend` and `python-service`
    concurrently and the very first embedding call (the knowledge-base seed at startup) can easily
    race `python-service`'s own boot; that's an ordinary timing race, not a real outage, worth
    riding out. Beyond that, it throws a clear error rather than silently degrading. An earlier
    version transparently fell back to a second, in-process hashing embedding, which was removed:
    a transient failure during `seedDocuments.ts`'s one-time seed could otherwise have permanently
    embedded the whole knowledge base with a different, less accurate algorithm than every later
    live query uses, a silent retrieval-quality bug rather than a visible, fixable error. (That
    in-process hashing embedding no longer exists at all, even on the Python side: `embeddings.py`
    now calls a real Voyage AI model, see `python-service/` below.)
  - `vectorStore.ts`: a real vector database (Postgres + the **pgvector** extension), with a
    `chunks` table (`embedding vector(1024)`), a genuine HNSW ANN index
    (`USING hnsw (embedding vector_cosine_ops)`) and a `UNIQUE (source, text)` index enforced at
    the database level: `seedKnowledgeBaseIfEmpty`'s "check if empty, then insert" is a
    check-then-act race that two concurrently-starting backend processes could both pass, both
    then seeding the full knowledge base and silently duplicating every chunk (this actually
    happened once during development); `addChunk`'s insert uses `ON CONFLICT (source, text) DO
    NOTHING` so a repeat seed attempt is now a harmless no-op instead of duplicate rows. Similarity
    search is pushed down into Postgres itself (`ORDER BY embedding <=> $query LIMIT k`) rather
    than scored by hand in JS. (See
    `06-vector-databases.md` for the general concept this implements.) The `Pool` explicitly sets
    `ssl` (disabled only for a `localhost` connection string) and a 10-second
    `connectionTimeoutMillis`: Neon requires TLS and `pg` doesn't reliably auto-enable it from a
    bare `?sslmode=require` query string alone, and with no timeout set a stalled handshake would
    hang forever, silently blocking the app from ever starting (found live, deploying to Cloud Run
    for the first time, see `deployment.md`).
  - `seedDocuments.ts`: on first boot, chunks + embeds every file in
    `data/knowledge-base/` and writes it into the vector store; skipped on later restarts.
- **`src/agent/`**
  - `tools.ts`: two local tools: `calculator` (a hand-written recursive-descent arithmetic
    evaluator, deliberately no `eval()`/`Function()`) and `search_knowledge_base` (wraps the RAG
    retrieval as a callable tool).
  - `mcpClient.ts`: a real MCP **client**: spawns `mcp-server/dist/index.js` as a child process
    over stdio, lists its tools and calls them. Fails soft (falls back to local tools only) if
    the MCP server hasn't been built yet.
  - `agentLoop.ts`: the ReAct loop: ask the LLM for a step, execute a tool if requested, feed the
    result back, repeat (capped at 4 steps), return the full trace plus final answer.
- **`src/summarize/summarizeClient.ts`**, **`src/cache/cacheClient.ts`**, **`src/eval/evalClient.ts`**:
  one thin client per Python-service endpoint, all following the same shape as
  `embeddingsClient.ts`'s HTTP call: POST, translate the Python service's `snake_case` JSON into
  the rest of the app's `camelCase` convention, throw a clear error on failure. `summarizeClient.ts`
  only covers the *extractive* mode; abstractive mode has no client here at all, since
  `summarize.route.ts` calls `llmClient` directly for that mode, the same as chat/RAG/agent.
  Tokenization has no client here either, and no Python-service counterpart anymore:
  `tokenizer.route.ts` calls Anthropic's own token-counting endpoint directly (see section 1 and
  the `python-service/` section below for why it moved out of Python entirely). None of the
  Python-service clients, embeddings included, have an in-process fallback: each is a feature
  nothing else in the app depends on (or, for embeddings, one where a silent fallback risked
  corrupting the seeded vector store), so a clear error is preferable to a silently degraded
  response. All four clients also attach `pythonServiceAuth.ts`'s headers to every request: deployed
  `python-service` is a private Cloud Run service (`--no-allow-unauthenticated`, see `deployment.md`
  Step 4), so calls to it need a Google-signed ID token, not just the
  `run.invoker` IAM grant `deployment.md` already sets up (that only authorizes the caller, it
  doesn't itself attach proof of identity to a request). `pythonServiceAuth.ts` fetches that token
  from Cloud Run's own metadata server automatically, no configuration needed, and returns no
  headers at all for local dev or Docker Compose, neither of which puts any auth in front of
  `python-service` (matched by the deployed URL's `.run.app` domain specifically, rather than by
  blacklisting `localhost`, which would miss Docker Compose's own internal hostname,
  `http://python-service:8001`). This was another bug found live, deploying to Cloud Run for the
  first time (see `deployment.md`): the `run.invoker` grant alone silently wasn't enough,
  `python-service` correctly refused every unauthenticated call, masked as an ordinary-looking
  `404` rather than a `403`, specifically so an unauthorized caller can't tell the service exists.
- **`src/routes/`**: thin Express handlers that validate input, call into the modules above and
  shape the JSON response. Each catch block uses `utils/errors.ts` to surface the real failure
  reason (e.g. an Anthropic billing error) instead of a generic message, so failures are
  self-explanatory directly in the UI.
- **`src/utils/errors.ts`**: pulls the specific message out of Anthropic API errors (or falls back
  to a normal `Error.message`) so route error responses explain what actually went wrong.
- **`src/server.ts`**: wires up Express, CORS (scoped to `config.frontendUrls`, not wide open;
  see `.env.example`'s `FRONTEND_URL`), JSON body parsing, seeds the knowledge base on boot and
  starts listening.
- **`data/knowledge-base/*.md`**: the actual content the RAG pipeline indexes: short explainer
  docs about LLMs, RAG, prompt engineering, AI agents, MCP, vector databases and full-stack
  architecture, i.e., the same concepts this app demonstrates, written up as its own test corpus.

### `mcp-server/`: a standalone MCP server
A separate Node process, deliberately decoupled from the Express backend, speaking the Model
Context Protocol's JSON-RPC framing over stdio, exactly how it would plug into Claude Desktop or
Claude Code. It uses the SDK's low-level `Server` API with plain JSON-Schema tool definitions
(the same schema shape Anthropic's tool-use API expects) and exposes three tools:
`get_current_time`, `get_weather` (a real call to WeatherAPI.com, requires `MCP_WEATHER_API_KEY`)
and `list_ai_concepts`. Unlike a missing `VOYAGE_API_KEY`, a missing/invalid
`MCP_WEATHER_API_KEY` doesn't take down this whole process: `get_weather` returns a clear MCP
tool error (`isError: true`) for that one call, while `get_current_time` and `list_ai_concepts`,
which share this same server process and don't need the key at all, keep working regardless.
Since `mcpClient.ts` spawns this server as a child process, and Node's stdio transport does
**not** forward the parent's environment by default (only a small safe allowlist, e.g. `PATH`),
`mcpClient.ts` explicitly passes `{ ...process.env }` when constructing the transport, otherwise
`MCP_WEATHER_API_KEY` would never reach this process no matter how correctly it's set on the
backend.

### `python-service/`: the Python microservice (see section 1 for why it exists as its own service)
A FastAPI app with five endpoints. Only `/health` needs nothing but
`pip install -r requirements.txt`; every other endpoint requires a real `VOYAGE_API_KEY`, not just
`/embed`: `/summarize` (TextRank's sentence-similarity pass), `/cache-sim` and `/evaluate` all call
into `embeddings.py` too. In practice the requirement is even stricter than "per endpoint": since
`embeddings.py` constructs its Voyage client eagerly at module-import time
(`voyageai.Client(api_key=os.environ["VOYAGE_API_KEY"])`), a missing key crashes this whole service
at startup, before any endpoint, `/health` included, is reachable at all.
- **`GET /health`**: liveness check.
- **`POST /embed`** (`embeddings.py`): calls Voyage AI's real embedding API (`voyage-4-lite`,
  requested at a fixed 1024-dimension output to match this app's pgvector column width), passing
  through Voyage's documented "document" vs "query" `input_type` distinction for better retrieval
  quality: `seedDocuments.ts` embeds knowledge-base chunks as `"document"`, live questions
  (`rag.route.ts`, `tools.ts`) as `"query"`. This replaced an earlier from-scratch deterministic
  hashing ("bag of words") embedding, a real, historically-legitimate technique refined with
  stopword filtering and a domain-acronym expansion table, but one that could never capture true
  synonymy the way a real trained model does; all of that machinery is gone along with it. There
  is deliberately no offline fallback: a fabricated embedding would silently corrupt the vector
  store, so this fails loudly (at import time, since the client is constructed eagerly) if
  `VOYAGE_API_KEY` is missing, rather than degrading quietly.
- **`POST /summarize`** (`summarizer.py`, `keywords.py`, `readability.py`): real TextRank
  extractive summarization (a graph/PageRank-style ranking over the sentences' own embeddings),
  plus term-frequency keyword extraction and Flesch/Flesch-Kincaid readability scoring for both the
  original text and the generated summary. This is the extractive half of Chapter 5's toggle; the
  abstractive half is a Claude call living entirely in the Node backend, not here. The similarity
  graph explicitly zeroes each sentence's similarity with itself before ranking: cosine similarity
  of a sentence against itself is always 1.0, which otherwise creates a self-loop letting a
  genuinely irrelevant, disconnected sentence settle at the uninformative uniform 1/n score instead
  of ranking low, exactly the bug this once had; a fully-disconnected sentence's rank is
  redistributed uniformly across the graph instead (the standard PageRank fix for dangling nodes).
- **`POST /cache-sim`** (`semantic_cache.py`): replays a list of queries against an in-memory
  cache keyed by embedding cosine similarity rather than exact text match, reporting which queries
  would have hit an existing cache entry.
- **`POST /evaluate`** (`eval.py`): scores a candidate answer against a reference using exact
  match, a ROUGE-L longest-common-subsequence overlap score and embedding-based semantic
  similarity.

Every one of these four call sites embeds all of its texts in a single batched `embed_batch()`
call rather than one Voyage request per text (per sentence in `summarizer.py`, per query in
`semantic_cache.py`, per candidate/reference pair in `eval.py`, per knowledge-base file in
`seedDocuments.ts`). This isn't just an efficiency nicety: Voyage's free tier defaults to 3
requests/minute until a payment method is on file, so the original one-request-per-text version of
each of these genuinely failed under real use (seeding 7 files, summarizing a multi-sentence
document, or replaying more than 3 cache queries would all blow through the cap partway through).

`python-service` also doesn't load the repo-root `.env` on its own the way the Node services do:
`scripts/dev.js` spawns it via `concurrently` with no `.env` passthrough, so `main.py` explicitly
calls `load_dotenv()` (pointed at the repo root) before importing `embeddings.py`, which reads
`VOYAGE_API_KEY` at import time. Every other env var this service reads had a fallback default
that happened to already match `.env`'s value, which is why this gap stayed invisible until
`VOYAGE_API_KEY`, deliberately built with no fallback, surfaced it.

Tokenization is not one of these anymore either: `backend/src/routes/tokenizer.route.ts` calls
Anthropic's own token-counting endpoint directly for an exact count, since an earlier from-scratch
BPE tokenizer here, while a real algorithm, never matched Claude's actual token boundaries, which
meant the "cost to run this on claude-sonnet-5" figure shown next to it was never quite right for
the model it named.

Every remaining from-scratch algorithm here (TextRank, keyword extraction, readability scoring,
the semantic cache's threshold logic, the eval metric) is honestly scaled down from its production
equivalent rather than faked; see each module's docstring for exactly what it's a real, smaller
version of, and the citation to the original technique. Embeddings and tokenization are the two
exceptions: both now call a real hosted model directly instead of approximating one.

### `frontend/`: the Next.js app (the interface, see section 1)
- **`lib/api.ts`**: typed fetch wrappers for every backend endpoint; the only place that knows
  the backend's URL/shape. No logic beyond request/response typing lives here. Its
  `API_BASE_URL` reads `process.env.NEXT_PUBLIC_API_BASE_URL`, falling back to
  `http://localhost:4000` if unset. Next.js inlines `NEXT_PUBLIC_*` vars into the client JS bundle
  at build time, not read at runtime, which only works if that variable is actually present in the
  environment `next build` runs in. A Docker `--build-arg` alone doesn't do that: it has to be
  declared with `ARG` and promoted to `ENV` inside the Dockerfile first (now fixed, see
  `Dockerfile` above), or it's silently ignored and every deployed page quietly falls back to
  `localhost:4000`, unreachable from a real visitor's browser, which is exactly what happened the
  first time this app was deployed to Cloud Run (every feature failed identically, all baked-in
  requests pointing at the same wrong, unreachable address, see `deployment.md`).
- **`components/`**: `ChatWindow` (stateful chat UI), `SourceCitation` (a RAG result card),
  `AgentTrace` (renders the agent's tool_call/tool_result/final steps as a timeline), which for
  `tool_result` steps parses each of the three tools' own plain-text output into a dedicated richer
  visual — `WeatherCard` (real WeatherAPI.com data, an emoji icon and a "LIVE" pill), `CalculatorCard`
  (the expression and exact result, an "EXACT" pill, deliberately not "LIVE" since it's a real local
  computation, not an external call) and `KnowledgeBaseResults` (reuses `SourceCitation`'s own visual
  language, a "REAL" pill, since it wraps the same retrieval RAG uses) — falling back to the original
  plain text whenever a tool's output doesn't match its expected shape (an error message, say), so a
  parse miss never hides real information. Also `ConceptCard` + `NavBar` (landing page and
  navigation) and the shared "textbook" vocabulary used by every chapter page: `TextbookPage` (the
  printed-page shell: eyebrow, title, page number, plus an optional `prevPage`/`nextPage` link
  rendered below the footer on every one of the twelve pages that uses it, in the same
  Introduction → Chapter 1 → ... → Chapter 10 → Glossary order the homepage's own table of contents
  lists them in; each end of that sequence simply omits the prop it doesn't have rather than
  rendering a dead link), `Analogy` and `CaseStudy` (left-border callout boxes), `Sources` (a
  citation list) and `ArchitectureDiagram` (Chapter 9's system diagram).
- **`app/`**: one route per chapter (see the directory tree above for the full chapter-to-route
  mapping), plus `/` (the table of contents), `/introduction` (front matter: why this guide
  exists, ahead of Chapter 1) and `/glossary` (every term, cross-linked to its chapter).

---

## 5. Setup

### Prerequisites
- **Node.js 20+** and npm
- **Python 3.10+** and pip
- **Docker + Docker Compose**: required even for local (non-containerized) dev now: the RAG
  vector store is real Postgres + pgvector, and the Docker image is the supported way to get that
  running. (If you already run Postgres with pgvector natively, you can point `POSTGRES_URL` at
  that instead and skip Docker entirely.)
- An **Anthropic API key** (optional; [console.anthropic.com](https://console.anthropic.com/)).
  Without one, the app runs in mock mode automatically.

### Install
```bash
# from the repo root
cp .env.example .env          # then edit .env if you have an Anthropic key
npm run install:all           # installs root, backend, frontend, mcp-server npm deps + python deps
```
(`install:all` runs `pip install -r python-service/requirements.txt`, which needs `python`/`pip`
on your `PATH`. It also runs `npm install` at the repo root, which is what makes `concurrently`
(and therefore `npm run dev`) available.) Every algorithm this service implements itself (TextRank,
keyword extraction, readability, the semantic cache, the eval metric) still uses the Python
standard library only, by design (see section 1); `requirements.txt`'s two non-framework
dependencies, `voyageai` (the real embedding calls) and `python-dotenv` (loading the repo-root
`.env` locally, since this service doesn't get one passed down the way the Node services do), are
there to call a real hosted model and read its key, not to implement an algorithm.

### Build the MCP server once
The agent's MCP-tool mode spawns a **compiled** MCP server, so build it once after installing:
```bash
npm run build:mcp
```
(Rerun this any time you change `mcp-server/src/index.ts`.)

---

## 6. Running it

### Step 0: start the vector database (required for Options A and B)
```bash
npm run db:up
```
Starts just the `postgres` (pgvector) container in the background: `docker compose up -d
postgres`. The backend connects to it at `localhost:5433` (see `POSTGRES_URL` in `.env`; port
5433, not 5432, so it won't clash with a Postgres you might already have running locally). Data
persists in a Docker volume, so you only need to do this once per work session; it stays up
across backend restarts and even reboots (until you `npm run db:down` or `docker compose down`).
If you skip this, the backend will crash on startup with a Postgres connection error, since RAG
seeding needs the database immediately.

### Option A: everything at once (recommended for local dev)
```bash
npm run dev
```
This starts, in parallel: the Express backend (`:4000`), the Next.js frontend (`:3000`), the
Python service (`:8001`) and an mcp-server watch-build. Open **http://localhost:3000**.

### Option B: one service at a time
```bash
npm run dev:backend     # Express API on :4000
npm run dev:frontend    # Next.js on :3000
npm run dev:python      # FastAPI on :8001
npm run build --prefix mcp-server   # compile the MCP server (agent spawns it on demand)
```

### Option C: Docker Compose (includes the database, no separate `db:up` step needed)
```bash
docker compose up --build
```
Brings up `postgres` (pgvector, :5433), `python-service` (:8001), `backend` (:4000, with the MCP
server built into its image) and `frontend` (:3000). Set `ANTHROPIC_API_KEY` in your shell or a
root `.env` before running to get live Claude responses instead of mock mode.

### Stopping everything (Options A / B)
Press **Ctrl+C** once in the terminal running `npm run dev`. `scripts/dev.js` handles `SIGINT`
directly, rather than only reacting once `concurrently`'s own `result` promise settles: on
Windows, each of the four spawned services runs through its own `cmd.exe` wrapper, and Ctrl+C
delivers `CTRL_C_EVENT` to every one of them at once, so every wrapper independently pops up its
own "Terminate batch job (Y/N)?" prompt and blocks on it. `result` only resolves once every child
has actually exited, which never happened on its own since nothing answered those prompts, which
used to mean a single Ctrl+C would hang until you pressed it again and typed `Y`. Handling `SIGINT`
directly instead forces the exact same cleanup `npm run stop` does immediately on the first press,
via `taskkill /F`, which doesn't care that a process is sitting at an interactive prompt, so
there's nothing left to answer.

The honest caveat: Windows process trees (`npm` → `cmd.exe` → `node` → `tsx`/`next`/`uvicorn`,
each nested a layer deeper) don't always propagate a kill signal all the way down, and orphaned
processes have shown up after a hard/forced kill (e.g. closing the terminal window, or a
supervisor tool killing the process without giving it a chance to run its exit handler). A single
Ctrl+C in the terminal `npm run dev` actually owns is the case this fix targets; if you ever stop
it some other way, run this after, just in case:
```bash
npm run stop
```
`npm run stop` (`scripts/stop-all.js`, the same script `dev.js` calls internally) finds and kills
anything actually listening on this app's ports (3000, 3001, 4000, 8001) plus any lingering
mcp-server/`dev.js` watcher processes, so the next `npm run dev` doesn't fail with an
address-already-in-use error. It only ever kills processes it confirms are `node`/`python`; if
something else is unexpectedly holding one of those ports, it's skipped and logged rather than
killed. Safe to run any time (including when nothing is running, or right after a Ctrl+C that
already cleaned up fine) and safe to run multiple times in a row.

Note: `npm run stop` deliberately does **not** touch the `postgres` container: that's a
long-lived data service, not a dev server, so it's left running across `npm run dev` sessions.
Stop it explicitly with `npm run db:down` when you're done working. (Options A/B only; stop the
Docker Compose path with `docker compose down`, which stops everything including the database.)

### Individual commands worth knowing
| Command | What it does |
|---|---|
| `npm run db:up` | Start just the pgvector Postgres container (`docker compose up -d postgres`) |
| `npm run db:down` | Stop the pgvector Postgres container |
| `npm run typecheck --prefix backend` | Type-check the API without emitting files |
| `npm run build --prefix backend` | Compile backend TypeScript to `backend/dist` |
| `npm run build --prefix frontend` | Production Next.js build |
| `npm run build --prefix mcp-server` | Compile the MCP server |
| `python -m uvicorn app.main:app --reload --port 8001` (run from `python-service/`) | Run the Python service directly |
| `docker exec ai-nexus-postgres psql -U nexus -d nexus_vectors` | Open a `psql` shell directly against the vector store |

---

## 7. Demo: what you'll see when you run it

**Landing page (`/`)**: a printed-textbook-styled table of contents listing the introduction, all
ten chapters and the glossary, each linking straight to its page.

**Introduction (`/introduction`)**: front matter, not a numbered chapter: why this guide exists,
the gap between what universities teach and what applied AI engineering actually looks like in
practice and what a reader should expect to get out of working through it.

**Chapter 1: Tokenization and the Cost of a Request (`/tokenizer`)**: type text and get back the
exact token count Anthropic's own API reports for it, plus an estimated dollar cost at published
per-model rates.

**Chapter 2: LLM Chat (`/chat`)**: a chat window with a message history, an input box and a
"MOCK MODE" / "LIVE · Anthropic" badge in the corner that reflects the backend's actual mode. Type
a message and your bubble appears on the right, the assistant's reply on the left: a live
back-and-forth conversation with real multi-turn history sent on every request.

**Chapter 3: RAG (`/rag`)**: a question box with clickable sample questions. Ask something like
*"What is the Model Context Protocol?"* and you'll see an **Answer** card followed by a
**Retrieved sources** list: numbered citation cards each showing the source markdown file, a
cosine-similarity score (computed by pgvector's HNSW index, not hand-rolled JS) and the exact
retrieved passage.

**Chapter 4: AI Agent + MCP (`/agent`)**: a prompt box, an "Include tools from the MCP server"
checkbox and one-click sample prompts that trigger the calculator tool, the knowledge-base search
tool or (with MCP enabled) the weather tool living entirely inside the separate `mcp-server/`
process. Each run renders a **Reasoning trace**: every tool call, its input, its result and the
final answer: the full think → act → observe → answer loop made visible.

**Chapter 5: Automatic Text Summarization (`/summarize`)**: paste in a paragraph and toggle between
two real, working modes. Abstractive drops the text into a prompt asking Claude to paraphrase it
in its own words, the same chat-completion path Chapter 2 uses. Extractive runs TextRank, scoring
every sentence and returning the top-ranked ones in original order, alongside extracted keywords
and a before/after Flesch-Kincaid readability comparison, with no model call at all.

**Chapter 6: Semantic Caching (`/cache`)**: paste a list of queries, one per line, including a
paraphrase and an exact repeat; watch each one get replayed against an in-memory cache keyed by
embedding similarity, with a hit/miss trace showing exactly why.

**Chapter 7: Evaluating AI Outputs (`/eval`)**: enter a candidate answer and a reference answer;
see it scored by exact match, ROUGE-L overlap and semantic similarity, combined into one
composite score.

**Chapter 8: These Concepts in the Real World (`/enterprise`)**: real companies (Klarna, Morgan
Stanley, Spotify, GitHub, Goldman Sachs, the Linux Foundation) and their published numbers, one
case study per core concept from Chapters 2–4.

**Chapter 9: The System Behind This Tutorial (`/architecture`)**: a behind-the-scenes tour of
this very system, including a diagram of how the four services talk to each other.

**Chapter 10: How This Tutorial Was Built (`/building`)**: the story of how an AI coding
assistant and a person built this app together, iteration by iteration.

**Glossary (`/glossary`)**: every term introduced across all ten chapters, each linked back to
where it's explained and, where one exists, to a real primary source.

---

## 8. Notes

- **Mock mode is not a lesser demo; it's the default one.** Every route, prompt template,
  retrieval step and tool call is real; only the final LLM call is canned (and always prefixed
  `[MOCK MODE]`). This means anyone can clone the repo and see the entire architecture work with
  zero API cost or setup friction.
- **Never commit your `.env`.** It's already gitignored; `.env.example` is the only file meant to
  be checked in.
- **The vector store is real Postgres + pgvector**, with a genuine HNSW ANN index, not an
  in-memory or hand-rolled similarity scan. At this knowledge-base's scale (a few dozen chunks) an
  exact scan would've been fast enough too, but pgvector was chosen anyway since it's the more
  common production pattern and the migration cost from "exact scan in JS" was low (see
  `backend/data/knowledge-base/06-vector-databases.md` for the general tradeoff). Postgres runs in
  its own Docker container (`npm run db:up`), separate from the app's own dev servers, so it isn't
  affected by `npm run stop`.
- **Known trade-off:** `frontend/package.json` pins Next.js to the latest `14.2.x` patch rather
  than jumping to Next 16, since the remaining advisories in that line (image-optimization DoS,
  websocket SSRF, i18n middleware bypass) affect features this demo doesn't use, and a major
  version bump wasn't worth the churn for a demo repo.
- **The backend's CORS policy is scoped, not wide open.** `FRONTEND_URL` (comma-separated for
  multiple origins) controls which origin(s) may call the API from a browser; it defaults to
  `http://localhost:3000` locally, but **must** be set to the frontend's real public URL in
  deployment (see `deployment.md`'s "backend ↔ frontend URL is circular" note), otherwise any
  other website's JS could call the deployed backend and spend your Anthropic API budget.
- **The Python service's remaining from-scratch algorithms are honestly scaled down, not faked.**
  The TextRank summarizer, its keyword extraction and its readability scoring are all real
  implementations of real algorithms, just run on far less data than a production system would
  use, exactly as each module's docstring explains, and none of them call out to a hosted model.
  Embeddings (`/embed`) used to be in this category too, a from-scratch hashing scheme, until it
  was replaced with a real call to Voyage AI: unlike the tokenizer swap below, this wasn't about
  fixing a wrong number, the hashing scheme was honestly labeled as approximate, it was about
  giving RAG, the semantic cache and TextRank itself a real embedding space instead of an
  approximate one. Tokenization (Chapter 1) was replaced the same way, calling Anthropic's real
  token-counting API directly, because its old from-scratch BPE version had a correctness problem
  the embeddings swap didn't: it displayed a "cost to run this on claude-sonnet-5" figure computed
  from a token count that wasn't actually claude-sonnet-5's. Chapter 5's *abstractive*
  summarization mode remains the one deliberate real-model-call exception living in this service's
  conceptual territory but not its actual code, in the Node backend instead, precisely so this
  distinction stays clean: see Chapter 5's own prose for why extractive and abstractive
  summarization are a genuinely different cost/trust trade-off, not one being strictly better than
  the other.
