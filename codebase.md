# Gruve AI Vibe Coding Demo — Codebase Guide

A small full-stack application built to demonstrate, in working code, every concept listed in
Gruve's **AI Vibe Coding Engineer** job posting:

| Job posting concept | Where it lives in this repo |
|---|---|
| Large Language Models (LLMs) | `backend/src/llm/` — Anthropic Claude integration + prompt templates |
| Retrieval-Augmented Generation (RAG) | `backend/src/rag/` + `/rag` page |
| Prompt engineering | `backend/src/prompts/systemPrompts.ts` |
| AI agents & tool use | `backend/src/agent/` + `/agent` page |
| Model Context Protocol (MCP) | `mcp-server/` (a real MCP server) + `backend/src/agent/mcpClient.ts` (a real MCP client) |
| Vector databases & embeddings | `backend/src/rag/vectorStore.ts` (real pgvector + HNSW index), `backend/src/rag/embeddingsClient.ts` |
| Python | `python-service/` (FastAPI embeddings microservice) |
| JavaScript/TypeScript, Node.js | `backend/`, `mcp-server/` |
| React/Next.js | `frontend/` |
| REST APIs & microservices architecture | Express API in `backend/`, FastAPI service in `python-service/`, communicating over HTTP |
| Docker | a `Dockerfile` per service + root `docker-compose.yml` |
| Git/GitHub | plain git repo, `.gitignore` provided (run `git init` if you want version control) |

The app runs **with or without** an Anthropic API key. Without one, every request still flows
through the real pipeline (routing, prompt templates, retrieval, tool-calling) — only the final
model call is replaced by a deterministic mock, always labeled `[MOCK MODE]` in the UI so it's
never mistaken for a live answer.

---

## 1. Directory structure

```
gruve-app/
├── codebase.md                    # this file
├── deployment.md                  # how to deploy this app to AWS / Azure / GCP
├── package.json                   # root orchestration scripts (npm run dev, npm run stop, etc.)
├── docker-compose.yml             # wires postgres (pgvector), python-service, backend, frontend together
├── .env.example                   # copy to .env and fill in what you have
├── .gitignore
├── scripts/
│   ├── dev.js                     # npm run dev — runs all services, auto-cleans up on exit/Ctrl+C
│   └── stop-all.js                # npm run stop — kills every service npm run dev starts
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
│       ├── prompts/
│       │   └── systemPrompts.ts   # versioned prompt templates (chat/RAG/agent)
│       ├── llm/
│       │   ├── types.ts           # provider-agnostic LLM client interface
│       │   ├── anthropicClient.ts # real Claude implementation
│       │   ├── mockLLM.ts         # offline deterministic stand-in
│       │   └── index.ts           # picks real vs. mock based on config
│       ├── rag/
│       │   ├── chunker.ts         # splits markdown into overlapping chunks
│       │   ├── embeddingsClient.ts# calls python-service, falls back to local hashing embedding
│       │   ├── vectorStore.ts     # Postgres + pgvector store, HNSW-indexed cosine search
│       │   └── seedDocuments.ts   # loads knowledge-base/*.md into the vector store
│       ├── agent/
│       │   ├── tools.ts           # local tools: calculator, search_knowledge_base
│       │   ├── mcpClient.ts       # MCP client — spawns & talks to mcp-server/
│       │   └── agentLoop.ts       # the think → act → observe → answer loop
│       ├── routes/
│       │   ├── chat.route.ts      # POST /api/chat
│       │   ├── rag.route.ts       # POST /api/rag/query
│       │   └── agent.route.ts     # POST /api/agent/run
│       └── utils/
│           └── errors.ts          # extracts a real, user-facing message from thrown errors
│
├── mcp-server/                    # standalone Model Context Protocol server
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
│       └── index.ts               # exposes get_current_time, get_weather, list_job_concepts
│
├── python-service/                # Python + FastAPI embeddings microservice
│   ├── requirements.txt
│   ├── Dockerfile
│   ├── package.json               # npm script shims so root `npm run dev` can launch it too
│   └── app/
│       ├── main.py                # FastAPI app: GET /health, POST /embed
│       └── embeddings.py          # deterministic hashing embedding (swappable for a real model)
│
└── frontend/                      # Next.js 14 (App Router) + TypeScript + Tailwind
    ├── package.json
    ├── next.config.js
    ├── tailwind.config.ts
    ├── Dockerfile
    ├── lib/
    │   └── api.ts                 # typed fetch wrappers around the backend REST API
    ├── components/
    │   ├── NavBar.tsx
    │   ├── ConceptCard.tsx
    │   ├── ChatWindow.tsx
    │   ├── SourceCitation.tsx
    │   └── AgentTrace.tsx
    └── app/
        ├── layout.tsx             # shared shell (nav + page container)
        ├── globals.css            # Tailwind + shared utility classes
        ├── page.tsx                # landing page — concept overview
        ├── chat/page.tsx           # LLM chat demo
        ├── rag/page.tsx            # RAG demo
        └── agent/page.tsx          # AI agent + MCP demo
```

---

## 2. File-by-file explanation

### Root
- **`package.json`** — orchestration only. `npm run dev` runs `scripts/dev.js`, which drives
  `concurrently` to boot the backend, frontend, Python service, and MCP server watch-build all at
  once.
- **`docker-compose.yml`** — four containers: `postgres` (Postgres + the pgvector extension,
  backing the RAG vector store), `python-service`, `backend` (which also bundles `mcp-server` into
  its image, since the agent spawns MCP as a child process), and `frontend`.
- **`.env.example`** — every environment variable the app reads, each with an inline comment
  explaining what it's for and what happens if it's left blank.
- **`deployment.md`** — step-by-step guide for deploying this app to AWS (ECS Fargate + RDS),
  Azure (Container Apps + Azure Database for PostgreSQL), or GCP (Cloud Run + Cloud SQL), plus a
  note on the Kubernetes path if you need it instead.
- **`scripts/dev.js`** — powers `npm run dev`. Drives `concurrently` programmatically (rather than
  shelling out to its CLI) specifically so it can run `stop-all.js`'s cleanup automatically when
  `npm run dev` exits or is interrupted — see the "Stopping everything" note in section 4 for the
  reliability caveat on Windows.
- **`scripts/stop-all.js`** — powers `npm run stop` (and is what `dev.js` calls internally on
  exit). Finds and kills anything listening on this app's ports plus any lingering
  mcp-server/dev.js watcher processes, so a half-killed `npm run dev` (common on Windows — see
  section 4) doesn't block the next one from starting.

### `backend/` — the Express REST API
- **`src/config.ts`** — loads `.env` once and exposes a typed `config` object, including the
  `isMockMode` getter that everything else keys off of.
- **`src/prompts/systemPrompts.ts`** — every prompt sent to the LLM lives here, not inline in
  route handlers: `CHAT_SYSTEM_PROMPT` (persona/tone), `buildRagPrompt()` (grounding + citation
  instructions), `AGENT_SYSTEM_PROMPT` (ReAct tool-use instructions), plus a documented few-shot
  example block.
- **`src/llm/`** — `types.ts` defines a provider-agnostic `LLMClient` interface (`chat()` and
  `step()` for agent tool-calling). `anthropicClient.ts` implements it against the real Anthropic
  Messages API (including proper `tool_use`/`tool_result` content-block handling).
  `mockLLM.ts` implements the same interface with deterministic heuristics (regex-based math
  detection, keyword-based tool matching) so the whole app is demoable offline.
  `index.ts` picks one implementation based on `config.isMockMode` — routes never branch on it.
- **`src/rag/`**
  - `chunker.ts` — splits a markdown file into ~600-character overlapping chunks along paragraph
    boundaries.
  - `embeddingsClient.ts` — POSTs text to the Python embedding service; if that service is
    unreachable, transparently falls back to an in-process deterministic hashing embedding (same
    algorithm the Python service itself falls back to), so RAG never hard-fails.
  - `vectorStore.ts` — a real vector database: Postgres + the **pgvector** extension, with a
    `chunks` table (`embedding vector(256)`) and a genuine HNSW ANN index
    (`USING hnsw (embedding vector_cosine_ops)`). Similarity search is pushed down into Postgres
    itself (`ORDER BY embedding <=> $query LIMIT k`) rather than scored by hand in JS. (See
    `06-vector-databases.md` for the general concept this implements.)
  - `seedDocuments.ts` — on first boot, chunks + embeds every file in
    `data/knowledge-base/` and writes it into the vector store; skipped on later restarts.
- **`src/agent/`**
  - `tools.ts` — two local tools: `calculator` (a hand-written recursive-descent arithmetic
    evaluator — deliberately no `eval()`/`Function()`) and `search_knowledge_base` (wraps the RAG
    retrieval as a callable tool).
  - `mcpClient.ts` — a real MCP **client**: spawns `mcp-server/dist/index.js` as a child process
    over stdio, lists its tools, and calls them. Fails soft (falls back to local tools only) if
    the MCP server hasn't been built yet.
  - `agentLoop.ts` — the ReAct loop: ask the LLM for a step, execute a tool if requested, feed the
    result back, repeat (capped at 4 steps), return the full trace plus final answer.
- **`src/routes/`** — thin Express handlers (`chat.route.ts`, `rag.route.ts`, `agent.route.ts`)
  that validate input, call into the modules above, and shape the JSON response. Each catch block
  uses `utils/errors.ts` to surface the real failure reason (e.g. an Anthropic billing error)
  instead of a generic message, so failures are self-explanatory directly in the UI.
- **`src/utils/errors.ts`** — pulls the specific message out of Anthropic API errors (or falls back
  to a normal `Error.message`) so route error responses explain what actually went wrong.
- **`src/server.ts`** — wires up Express, CORS, JSON body parsing, seeds the knowledge base on
  boot, and starts listening.
- **`data/knowledge-base/*.md`** — the actual content the RAG pipeline indexes: short explainer
  docs about LLMs, RAG, prompt engineering, AI agents, MCP, vector databases, and full-stack
  architecture — i.e., the same concepts this app demonstrates, written up as its own test corpus.

### `mcp-server/` — a standalone MCP server
A separate Node process, deliberately decoupled from the Express backend, speaking the Model
Context Protocol's JSON-RPC framing over stdio — exactly how it would plug into Claude Desktop or
Claude Code. It uses the SDK's low-level `Server` API with plain JSON-Schema tool definitions
(the same schema shape Anthropic's tool-use API expects) and exposes three tools:
`get_current_time`, `get_weather` (mock data, deterministic per city), and `list_job_concepts`.

### `python-service/` — the Python microservice
A minimal FastAPI app with one real endpoint, `POST /embed`, that turns text into embedding
vectors using a dependency-free deterministic hashing scheme (`app/embeddings.py`) — no model
download required. The file's docstring shows exactly how to swap in a real
`sentence-transformers` model or an OpenAI embeddings call without touching any other service.

### `frontend/` — the Next.js app
- **`lib/api.ts`** — typed fetch wrappers for the three backend endpoints; the only place that
  knows the backend's URL/shape.
- **`components/`** — `ChatWindow` (stateful chat UI), `SourceCitation` (a RAG result card),
  `AgentTrace` (renders the agent's tool_call/tool_result/final steps as a timeline),
  `ConceptCard` + `NavBar` (landing page and navigation).
- **`app/`** — one route per demo: `/` (concept overview), `/chat`, `/rag`, `/agent`.

---

## 3. Setup

### Prerequisites
- **Node.js 20+** and npm
- **Python 3.10+** and pip
- **Docker + Docker Compose** — required even for local (non-containerized) dev now: the RAG
  vector store is real Postgres + pgvector, and the Docker image is the supported way to get that
  running. (If you already run Postgres with pgvector natively, you can point `POSTGRES_URL` at
  that instead and skip Docker entirely.)
- An **Anthropic API key** (optional — [console.anthropic.com](https://console.anthropic.com/)).
  Without one, the app runs in mock mode automatically.

### Install
```bash
# from the repo root
cp .env.example .env          # then edit .env if you have an Anthropic key
npm run install:all           # installs root, backend, frontend, mcp-server npm deps + python deps
```
(`install:all` runs `pip install -r python-service/requirements.txt`, which needs `python`/`pip`
on your `PATH`. It also runs `npm install` at the repo root, which is what makes `concurrently`
— and therefore `npm run dev` — available.)

### Build the MCP server once
The agent's MCP-tool mode spawns a **compiled** MCP server, so build it once after installing:
```bash
npm run build:mcp
```
(Rerun this any time you change `mcp-server/src/index.ts`.)

---

## 4. Running it

### Step 0 — start the vector database (required for Options A and B)
```bash
npm run db:up
```
Starts just the `postgres` (pgvector) container in the background — `docker compose up -d
postgres`. The backend connects to it at `localhost:5433` (see `POSTGRES_URL` in `.env`; port
5433, not 5432, so it won't clash with a Postgres you might already have running locally). Data
persists in a Docker volume, so you only need to do this once per work session — it stays up
across backend restarts and even reboots (until you `npm run db:down` or `docker compose down`).
If you skip this, the backend will crash on startup with a Postgres connection error, since RAG
seeding needs the database immediately.

### Option A — everything at once (recommended for local dev)
```bash
npm run dev
```
This starts, in parallel: the Express backend (`:4000`), the Next.js frontend (`:3000`), the
Python embeddings service (`:8001`), and an mcp-server watch-build. Open **http://localhost:3000**.

### Option B — one service at a time
```bash
npm run dev:backend     # Express API on :4000
npm run dev:frontend    # Next.js on :3000
npm run dev:python      # FastAPI on :8001
npm run build --prefix mcp-server   # compile the MCP server (agent spawns it on demand)
```

### Option C — Docker Compose (includes the database — no separate `db:up` step needed)
```bash
docker compose up --build
```
Brings up `postgres` (pgvector, :5433), `python-service` (:8001), `backend` (:4000, with the MCP
server built into its image), and `frontend` (:3000). Set `ANTHROPIC_API_KEY` in your shell or a
root `.env` before running to get live Claude responses instead of mock mode.

### Stopping everything (Options A / B)
Press **Ctrl+C** in the terminal running `npm run dev`. As of `scripts/dev.js`, this should now
clean up after itself automatically: `concurrently`'s own SIGINT handling settles `dev.js`'s
`result` promise, which triggers the exact same cleanup as `npm run stop` before the process
exits — so in the common case, Ctrl+C alone is enough.

The honest caveat: Windows process trees (`npm` → `cmd.exe` → `node` → `tsx`/`next`/`uvicorn`,
each nested a layer deeper) don't always propagate a kill signal all the way down, and this was
directly observed during development — orphaned processes have shown up after both a plain
Ctrl+C-style interrupt and, less surprisingly, a hard/forced kill (e.g. closing the terminal
window, or a supervisor tool killing the process without giving it a chance to run its exit
handler). So treat Ctrl+C as "probably enough," not "guaranteed," and run this after, regardless:
```bash
npm run stop
```
`npm run stop` (`scripts/stop-all.js` — the same script `dev.js` calls internally) finds and kills
anything actually listening on this app's ports (3000, 3001, 4000, 8001) plus any lingering
mcp-server/`dev.js` watcher processes, so the next `npm run dev` doesn't fail with an
address-already-in-use error. It only ever kills processes it confirms are `node`/`python` — if
something else is unexpectedly holding one of those ports, it's skipped and logged rather than
killed. Safe to run any time (including when nothing is running, or right after a Ctrl+C that
already cleaned up fine) and safe to run multiple times in a row.

Note: `npm run stop` deliberately does **not** touch the `postgres` container — that's a
long-lived data service, not a dev server, so it's left running across `npm run dev` sessions.
Stop it explicitly with `npm run db:down` when you're done working. (Options A/B only — stop the
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
| `python -m uvicorn app.main:app --reload --port 8001` (run from `python-service/`) | Run the embeddings service directly |
| `docker exec gruve-postgres psql -U gruve -d gruve_vectors` | Open a `psql` shell directly against the vector store |

---

## 5. Demo — what you'll see when you run it

**Landing page (`/`)** — a dark, purple-accented overview page: a headline ("One small full-stack
app, every concept from the job posting"), two CTA buttons ("Try the chat demo", "Watch an agent
think"), a 2×3 grid of concept cards (LLM Chat, RAG, AI Agents + Tool Use, Model Context Protocol,
Polyglot Microservices, Full-Stack + Containers) each with a short description and topic pills,
and a callout card explaining the mock-mode fallback.

**LLM Chat (`/chat`)** — a chat window with a message history, an input box, and a "MOCK MODE" /
"LIVE · Anthropic" badge in the corner that reflects the backend's actual mode. Type a message and
your bubble appears on the right, the assistant's reply on the left — a live back-and-forth
conversation with real multi-turn history sent on every request.

**RAG (`/rag`)** — a question box with three clickable sample questions. Ask something like *"What
is the Model Context Protocol?"* and you'll see an **Answer** card (with the same mock/live badge)
followed by a **Retrieved sources** list: numbered citation cards (`[1]`, `[2]`, …) each showing
the source markdown file, a cosine-similarity score (computed by pgvector's HNSW index, not
hand-rolled JS), and the exact retrieved passage — so you can see precisely what grounded the
answer.

**AI Agent + MCP (`/agent`)** — a prompt box, an "Include tools from the MCP server" checkbox, and
three one-click sample prompts:
- *"What's 18% of 240?"* → the agent calls the **calculator** tool and shows the exact expression
  and result.
- *"What is the Model Context Protocol?"* → the agent calls **search_knowledge_base** and shows
  the retrieved passages it used.
- *"What's the weather in Austin?"* (with MCP enabled) → the agent calls **get_weather**, a tool
  that lives entirely inside the separate `mcp-server/` process, reached over the real MCP
  protocol — proving the integration is real, not simulated.

Each run renders a **Reasoning trace**: a numbered list of steps, each tagged `tool call` /
`tool result` / `final answer`, showing the tool name, its JSON input, its raw output, and finally
the agent's answer — the full think → act → observe → answer loop made visible.

---

## 6. Notes

- **Mock mode is not a lesser demo — it's the default one.** Every route, prompt template,
  retrieval step, and tool call is real; only the final LLM call is canned (and always prefixed
  `[MOCK MODE]`). This means anyone can clone the repo and see the entire architecture work with
  zero API cost or setup friction.
- **Never commit your `.env`.** It's already gitignored; `.env.example` is the only file meant to
  be checked in.
- **The vector store is real Postgres + pgvector**, with a genuine HNSW ANN index — not an
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
