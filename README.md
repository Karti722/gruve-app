# AI Nexus

**An interactive, full-stack tutorial that teaches core AI engineering concepts by letting you use
real, working implementations of them, not slides and not a sandboxed toy.**

[![Deploy to Cloud Run](https://github.com/Karti722/ai-nexus/actions/workflows/deploy.yml/badge.svg)](https://github.com/Karti722/ai-nexus/actions/workflows/deploy.yml)

<!--
Once deployed (see info/deployment.md), replace this line with the real URL, e.g.:
**Live demo:** https://ai-nexus.app
-->

---

## What this is

AI Nexus is a textbook-styled web app: ten chapters plus an introduction and a glossary, each
covering one core concept in modern applied AI engineering (large language models, retrieval-
augmented generation, prompt engineering, AI agents, the Model Context Protocol, vector databases,
summarization, semantic caching, output evaluation) and each backed by a genuinely working demo of
that concept, not a mockup. Ask the chat page a question and a real Claude API call answers it.
Ask the RAG page something and it actually retrieves from a real pgvector-backed Postgres
database. Ask the agent to check the weather and it calls a real weather API through a real MCP
tool server. Chapters 8, 9 and 10 then zoom out: real companies running these same patterns in
production, a full architectural tour of the system serving these pages, and the story of how the
whole thing was actually built.

It's built for two audiences at once: engineers who want to see a real, inspectable
implementation of these concepts end to end, and newcomers who want to learn them hands-on instead
of from a slide deck.

## Documentation

Everything beyond this page lives in **[`info/`](./info)**:

| File | What it covers |
|---|---|
| **[`info/codebase.md`](./info/codebase.md)** | The codebase's architecture: why it's split into four services the way it is, every tech-stack choice and its trade-offs, a file-by-file explanation of the whole repo, and how to set it up and run it on your own machine. |
| **[`info/deployment.md`](./info/deployment.md)** | The exact steps to deploy this app: Google Cloud Run + a free Neon Postgres instance, for a genuine $0/month, written as a complete walkthrough from a blank starting point (no cloud account, nothing installed). |
| **[`info/CI-CD.md`](./info/CI-CD.md)** | The GitHub Actions approach taken to automate that deployment, and why: Workload Identity Federation instead of a downloadable service account key, what gets rebuilt and redeployed on every push to `main`, and how to set it up yourself. |

If you're trying to decide where to start: `info/codebase.md` if you want to run this locally or
understand how it's built, `info/deployment.md` if you want to put your own copy on the internet,
`info/CI-CD.md` only after that's done and confirmed working.

## Quick start (local)

```bash
git clone https://github.com/Karti722/ai-nexus.git
cd ai-nexus
cp .env.example .env        # optional: add a real ANTHROPIC_API_KEY, otherwise it runs in mock mode
npm run install:all
npm run db:up                # starts the pgvector-enabled Postgres container
npm run dev                  # starts backend, frontend, python-service and the MCP server
```

Open `http://localhost:3000`. Full prerequisites, what each command actually does, and every
other way to run this (Docker Compose, one service at a time) are in `info/codebase.md`.

## Tech stack

React/Next.js (TypeScript) frontend · Node.js/Express (TypeScript) API orchestrator · Python/FastAPI
microservice · PostgreSQL + pgvector · a standalone Model Context Protocol server · Anthropic Claude
(chat/RAG/agent/tokenization) · Voyage AI (embeddings) · WeatherAPI.com (the agent's one real
external tool) · Docker + Docker Compose · designed to deploy on Google Cloud Run, with GitHub
Actions automating it (see `info/deployment.md` and `info/CI-CD.md`).

`info/codebase.md` section 2 explains why each of these was chosen over the alternatives that were
actually considered, not just what was picked.

## Project structure

```
ai-nexus/
├── README.md            # you are here
├── info/                 # codebase.md, deployment.md, CI-CD.md
├── frontend/              # Next.js app — the ten chapters + glossary
├── backend/               # Express API — orchestrates everything below
├── python-service/         # FastAPI — embeddings, summarization, caching, eval
├── mcp-server/              # standalone Model Context Protocol server
├── docker-compose.yml
└── .github/workflows/        # the CI/CD pipeline info/CI-CD.md sets up
```

The full, annotated version of this tree, with every file's purpose explained, is section 3 of
`info/codebase.md`.

## Status

A personal project, built end to end (including this README) through an extended, ongoing
collaboration between a person and an AI coding assistant — Chapter 10 of the app itself
(`/building`) tells that story in detail, including the real bugs found along the way, not just
the parts that went smoothly.

## License

No license file is included yet, so all rights are reserved by default. If you'd like to reuse any
of this, open an issue, or add a `LICENSE` file (MIT is a reasonable default for a project like
this) if you want the terms to be explicit.
