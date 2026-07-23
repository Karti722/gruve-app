# Deploying AI Nexus (Free)

This guide walks you through deploying AI Nexus to **Google Cloud (GCP)** for **$0/month**, from
a completely blank starting point: no cloud account, nothing installed. It assumes you're on
**Windows** and running every command in **PowerShell**. Follow the numbered steps in order;
don't skip ahead, and run only **one command at a time**, even where a step needs several in a
row.

There are exactly two places any instruction below happens, never a third:

1. **Your local PowerShell terminal** — specifically **PowerShell**, not Command Prompt
   (`cmd.exe`) and not Cloud Shell. Open it from the Start menu (type `powershell` and hit Enter;
   the icon is dark blue). Every command below uses PowerShell-only syntax, the backtick (`` ` ``)
   line-continuations and `$variable = ...` assignments throughout this guide don't work in
   `cmd.exe` at all, so it has to be PowerShell specifically. Run the CLI tools (`gcloud`/`docker`)
   you install onto your own machine in Step 0 from this same window, sitting in the root folder
   of your local copy of this repository (the folder that directly contains
   `docker-compose.yml`), the whole way through.
2. **Your browser** — for creating accounts, clicking through the Cloud Console's setup pages,
   and, at the very end, actually visiting your deployed site.

Every step below is tagged with exactly one of these two, right under its heading, so you always
know where to be before you start typing.

**You never `cd` into a different folder anywhere in this guide.** Every terminal command below,
including the `docker build` ones that mention `frontend/Dockerfile` or `python-service/Dockerfile`,
runs from that same `ai-nexus` root folder you land in after Step 3 of "Before you start". Where
you see a bare folder name like `frontend` or `python-service` at the end of a `docker build`
command, that's an argument telling Docker which subfolder to use as that particular build's
context, not an instruction to move into it; you stay put in `ai-nexus/` the entire time.

**Keep the same PowerShell window open from Step 0 through the end.** Several steps save a value
(a URL, a project number) into a PowerShell variable, like `$backendUrl`, so a later step can
reuse it automatically instead of you having to copy/paste it by hand. Those variables only exist
for as long as that PowerShell window stays open. If you close it partway through, that's fine,
just re-run the one-line command shown next to each variable to fetch that value again before
continuing.

**About the placeholders in the commands below**, e.g. `YOUR_PROJECT_ID`: this guide deliberately
avoids the `<placeholder>` angle-bracket style you may have seen in other tutorials. A bare `<`
character actually causes PowerShell to fail with `The '<' operator is reserved for future use`
if it's typed outside quotes, so every placeholder here instead looks like `YOUR_PROJECT_ID`,
plain capitalized words with no brackets. Wherever you see one, replace the whole word with your
own real value before running the command.

**Docker Desktop on Windows needs its WSL2 backend turned on** (this is the default in current
Docker Desktop versions, nothing you need to configure by hand, just don't turn it off if the
installer asks). If `docker --version` in Step 1 below fails or hangs, open Docker Desktop itself
first and wait for its whale icon in the system tray to show "Docker Desktop is running" before
retrying.

### Technology versions this guide targets

Every command and image tag below matches what's actually pinned in this repo right now. If you
change a version in `package.json`, `requirements.txt` or a `Dockerfile`, update the matching
value here too so the two never drift apart.

| Component | Version | Pinned in |
|---|---|---|
| Node.js (backend, frontend, mcp-server) | 20 (Alpine base image) | `backend/Dockerfile`, `frontend/Dockerfile`, `mcp-server/Dockerfile` (`node:20-alpine`) |
| TypeScript | 5.6.x | `backend/package.json`, `frontend/package.json`, `mcp-server/package.json` |
| Next.js | 14.2.35 (exact, not a range) | `frontend/package.json` |
| React | 18.3.x | `frontend/package.json` |
| Express | 4.21.x | `backend/package.json` |
| Anthropic SDK | 0.32.x | `backend/package.json` |
| MCP SDK | 1.19.x | `backend/package.json`, `mcp-server/package.json` |
| Python (python-service) | 3.12 (slim base image) | `python-service/Dockerfile` (`python:3.12-slim`) |
| FastAPI | 0.115.0 (exact) | `python-service/requirements.txt` |
| Uvicorn | 0.30.6 (exact) | `python-service/requirements.txt` |
| Pydantic | 2.9.2 (exact) | `python-service/requirements.txt` |
| voyageai (Voyage AI embeddings SDK) | 0.5.0 (exact) | `python-service/requirements.txt` |
| python-dotenv | 1.0.1 (exact) | `python-service/requirements.txt` |
| PostgreSQL | 16 | `docker-compose.yml`'s `postgres` service (`pgvector/pgvector:pg16`) |
| pgvector extension | bundled with the `pgvector/pgvector:pg16` image | same |

The `gcloud` CLI's own version isn't pinned anywhere in this repo, install whatever the newest
release is from Step 0's link below, it's backward-compatible enough that this guide doesn't
depend on a specific CLI version.

**As of this writing**, Neon defaults brand-new projects to **PostgreSQL 18**, not 16, but lets
you pick any version from 14 through 18 at project-creation time; `pgvector` works the same way
on all of them. Step 1 below tells you where to pick 16 explicitly if you'd rather exactly match
the version this repo runs locally; either way, it's a one-click choice in Neon's
project-creation screen, not a command.

---

## Before you start

1. **(Your browser, to download; your local terminal, to confirm)** Install Docker Desktop:
   [docker.com/products/docker-desktop](https://www.docker.com/products/docker-desktop/). Accept
   the default WSL2-backend option during install. After installing, open PowerShell and confirm
   it worked:
   ```powershell
   docker --version
   ```
2. **(Your browser)** Install Git, if you don't already have it:
   [git-scm.com/downloads](https://git-scm.com/downloads).
3. **(Your local terminal, starting directory doesn't matter yet)** `ai-nexus/` doesn't exist on
   your machine until this command creates it, so run this one from wherever you keep projects,
   e.g. `C:\Users\YOU\Documents` or your Desktop, PowerShell's default starting folder is fine too:
   ```powershell
   git clone YOUR_REPO_URL
   ```
   This creates a new `ai-nexus` folder inside wherever you ran that command. Move into it now:
   ```powershell
   cd ai-nexus
   ```
   This is the **root** of the project, not a subfolder inside it, one level up from `backend/`,
   `frontend/`, `python-service/` and `mcp-server/`, which all sit alongside each other inside it.
   Confirm you're in the right place, this should list `docker-compose.yml` along with those four
   folders:
   ```powershell
   dir
   ```
   **From this point on, every single command in this entire guide is run from inside this exact
   root folder, `ai-nexus/` itself, never one of the subfolders you just saw listed, with no
   exceptions.** Whatever folder `cd ai-nexus` just put you in, that's it, for every remaining
   step.
4. **(Your browser)** Get an API key at [console.anthropic.com](https://console.anthropic.com/).
   This guide sets the deployed app up with a real key so it gives real Claude responses, not the
   canned `[MOCK MODE]` replies you'd get without one, see "About mock mode" right below for what
   that fallback looks like if you ever want to skip the key later. Save the key somewhere, it
   starts with `sk-ant-`, you'll store it as a secret in Step 3.
5. **(Your browser)** Get an API key at [dashboard.voyageai.com](https://dashboard.voyageai.com/)
   (free, no credit card, 200 million free tokens on the model this guide uses). Unlike the
   Anthropic key above, **this one is required, not optional**: RAG, semantic caching and
   extractive summarization all embed text through this key with no offline fallback, so the app
   won't come up correctly without it. Save the key somewhere, you'll store it as a secret in
   Step 3. **Also add a payment method on Voyage's billing page while you're there**, even though
   the 200 million free tokens still apply either way: without one, the account is capped at 3
   requests/minute, low enough that concurrent visitors to a real, deployed site can hit it and see
   errors, a real failure mode observed directly building this app, not a hypothetical. Adding a
   payment method removes the cap; your existing key keeps working unchanged, no new key needed.
6. **(Your browser)** Get an API key at [weatherapi.com](https://www.weatherapi.com/) (free,
   100,000 calls/month, no credit card) for the agent's `get_weather` tool (Chapter 4). This one is
   optional the same way the Anthropic key is, not required the way the Voyage key is: skip it and
   the app still deploys and works completely, the `get_weather` tool specifically just returns a
   clear error instead of a real forecast when called, since `get_current_time` and
   `list_ai_concepts` share the same MCP tool server and don't need this key at all. Save the key
   somewhere, you'll store it as a secret in Step 3 if you want it.

### What you're deploying

Four pieces, mirroring `docker-compose.yml`. The names on the left match the repo's own folder
names (and everything `codebase.md` calls them); the "Cloud Run service name" column is what you'll
actually type into every `gcloud run deploy`/`describe`/`update`/`delete` command below, and what
ends up as the prefix of each public URL (e.g. `https://ai-nexus-abcd1234-uc.a.run.app`), chosen
deliberately unlike the generic folder names, since the frontend's is the one visitors actually see:

| Service | Cloud Run service name | What it is | Who can reach it |
|---|---|---|---|
| `frontend` | **`ai-nexus`** | The Next.js website, what you open in a browser | **Public** |
| `backend` | **`ai-nexus-backend`** | The Express API the frontend and any API client talks to | **Public** |
| `python-service` | **`ai-nexus-python`** | A FastAPI microservice doing embeddings (via a real Voyage AI call), extractive summarization, caching and evaluation | **Internal only**, just `backend` talks to it |
| `postgres` | *(not on Cloud Run at all, see Step 1)* | A managed Postgres database with the `pgvector` extension | **Internal only**, just `backend` talks to it |

The Docker **image** names inside Artifact Registry (`.../ai-nexus/backend:latest`,
`.../ai-nexus/frontend:latest`, `.../ai-nexus/python-service:latest`, set in Step 2) deliberately
stay the plain folder names and don't change to match: an image name and the Cloud Run service
name deployed from it are two independent things, and there's no reason to rename the former just
because the latter changed.

Because the frontend needs to know the backend's web address before it's built, and the backend
needs to know the frontend's address to allow it to make calls, you deploy in this order:
**backend and python-service first, then frontend, then a final one-line update back on the
backend.**

### Do you need to set up the Postgres database yourself? No

You never manually create tables, run migrations, or seed data, this guide doesn't have a step
for it because there isn't one. The backend does all of it itself, automatically, the moment it
successfully connects to Postgres:
- `vectorStore.ts`'s `ensureReady()` creates the `pgvector` extension, the `chunks` table and its
  search index, if they don't already exist.
- `seedDocuments.ts` then checks if that table is empty and, if so, reads the knowledge-base
  files baked into the backend's image, chunks and embeds them, and inserts them. If the table
  already has data (e.g. you're redeploying, not deploying for the first time), it logs that it's
  skipping the seed and moves on, it never duplicates data.

This is exactly what Step 7's log check confirms, seeing it connect and either seed or skip is
how you know the database side worked, with nothing else for you to do.

### About mock mode (and why this guide doesn't use it)

If you never set an `ANTHROPIC_API_KEY`, the deployed app still works completely: every feature
runs for real except the very last step of each AI answer, which returns a canned,
clearly-labeled `[MOCK MODE]` response instead of a real Claude reply. That fallback exists so
hosting can stay $0 with nothing metered even without a key, but since Step 4 of "Before you
start" above has you get a real key, this guide wires it in as a secret in Step 3 and the app
gives real Claude responses from the moment it's deployed. The only cost this adds is Anthropic's
own small pay-as-you-go usage pricing for whatever you actually ask the deployed app, that's a
usage cost from Anthropic, not a hosting cost, and it's separate from the $0/month cloud-hosting
total the rest of this guide is about. If you'd rather not have that usage cost, skip Step 4 and
the `anthropic-api-key` secret in Step 3, and the app falls back to mock mode automatically.

**This does not extend to `VOYAGE_API_KEY`.** Mock mode only ever covers the final step of
generating an LLM *answer*; embeddings have no equivalent fallback, since a fabricated embedding
would silently corrupt the vector store rather than just produce a labeled placeholder reply. RAG,
the semantic cache, extractive summarization and the eval harness all depend on real embeddings
(not just the RAG page's own `/embed` calls), so Step 5 of "Before you start" and the
`voyage-api-key` secret in Step 3 are not optional the way the Anthropic key is; skipping them
doesn't just disable RAG, it means `python-service` fails to even start, since its embeddings
client is constructed at process startup, not lazily on first use.

**`MCP_WEATHER_API_KEY` (Step 6 of "Before you start") is optional the same way the Anthropic key
is**, not required the way the Voyage key is: skip it and the app deploys and works completely,
`get_current_time` and `list_ai_concepts` don't need it at all, and `get_weather` specifically
returns a clear error instead of a real forecast when called, rather than the whole app, or even
the whole agent, failing.

### The two web addresses that depend on each other

This guide hits the same two-pass shape:

1. Deploy `backend` first. It's fine that nothing has told it the frontend's address yet, nothing
   is calling it yet either.
2. Build and deploy `frontend`, telling it the backend's now-known web address.
3. Go back and update `backend` with the frontend's now-known web address (a quick config update,
   no rebuilding).

The steps below are numbered to match this exactly, and each captures the address it needs into a
PowerShell variable automatically, so you're never asked to copy/paste a URL by hand.

### Environment variables you'll set, and the URLs behind them

Every `.env` variable this app reads (`backend/src/config.ts`, `python-service/app/main.py`,
`frontend/lib/api.ts`, and `mcp-server/src/index.ts` via the environment `backend` forwards to it)
still applies in production, just pointed at real cloud URLs instead of `localhost`. Here's every
one, what it's for, and an illustrative example value, using `ai-nexus.app`-style names instead of
`localhost` so it's obvious which URL is which:

| Variable | Set on | Example value | Where the real value comes from |
|---|---|---|---|
| `NEXT_PUBLIC_API_BASE_URL` | `frontend`, **build-time** | `https://api.ai-nexus.app` | `backend`'s public URL, captured automatically in Step 4 |
| `FRONTEND_URL` | `backend` | `https://ai-nexus.app` | `frontend`'s public URL, captured automatically in Step 6 |
| `PYTHON_EMBEDDING_SERVICE_URL` | `backend` | the internal URL Cloud Run prints | `python-service`'s internal address, captured automatically in Step 4 |
| `POSTGRES_URL` | `backend` | `postgresql://nexus:REAL_PASSWORD@ep-cool-forest-123456.us-east-2.aws.neon.tech/nexus_vectors?sslmode=require` | the Neon connection string from Step 1 |
| `ANTHROPIC_API_KEY` | `backend` | `sk-ant-api03-REAL_KEY_FROM_CONSOLE` | [console.anthropic.com](https://console.anthropic.com/), from Step 4 of "Before you start"; omit for mock mode instead, see "About mock mode" above |
| `ANTHROPIC_MODEL` | `backend` | `claude-sonnet-5` | fixed, already this repo's default |
| `PORT` | `backend` | `4000` | fixed, matches `backend/Dockerfile` |
| `MCP_WEATHER_API_KEY` | `backend` | `REAL_KEY_FROM_WEATHERAPI` | [weatherapi.com](https://www.weatherapi.com/), from Step 6 of "Before you start"; optional, omit for a clear per-call error on `get_weather` only, see above |
| `VOYAGE_API_KEY` | `python-service` | `pa-REAL_KEY_FROM_DASHBOARD` | [dashboard.voyageai.com](https://dashboard.voyageai.com/), from Step 5 of "Before you start"; **required**, no mock-mode equivalent, see above |
| `EMBEDDING_SERVICE_PORT` | `python-service` | `8001` | fixed, matches `python-service/Dockerfile` |
| `MCP_SERVER_ENTRY` | *(not set at all in deployment)* | — | `backend/Dockerfile` already bakes in the correct absolute container path (`/app/mcp-server/dist/index.js`); this variable only exists for local dev, where the path is relative instead |

**Eleven variables total in `.env.example`; every one is accounted for above**, either with a real
value you provide, a value captured automatically, or an explicit "not set in deployment" note.
None are silently skipped: `ANTHROPIC_MODEL`, `PORT` and `EMBEDDING_SERVICE_PORT` all show up in the
table with "fixed" values because the code's own default already matches what deployment needs, not
because they were forgotten, and the step-by-step commands below call out, at the point each one
would apply, exactly which variables that specific command is setting and which it deliberately
isn't.

Put together, a fully filled-in production `.env` (illustrative values, not real ones, and not a
file you actually create, see the note below) looks like:
```text
ANTHROPIC_API_KEY=sk-ant-api03-REAL_KEY_FROM_CONSOLE
ANTHROPIC_MODEL=claude-sonnet-5
PORT=4000
FRONTEND_URL=https://ai-nexus.app
PYTHON_EMBEDDING_SERVICE_URL=http://python-service:8001
MCP_WEATHER_API_KEY=REAL_KEY_FROM_WEATHERAPI
POSTGRES_URL=postgresql://nexus:REAL_PASSWORD@ep-cool-forest-123456.us-east-2.aws.neon.tech/nexus_vectors?sslmode=require
VOYAGE_API_KEY=pa-REAL_KEY_FROM_DASHBOARD
EMBEDDING_SERVICE_PORT=8001
NEXT_PUBLIC_API_BASE_URL=https://api.ai-nexus.app
```
**Two important catches:**
- Cloud Run doesn't give you a truly custom domain like `https://ai-nexus.app` for free by default,
  it hands you an auto-generated address instead. Naming the Cloud Run service itself `ai-nexus`
  (see "What you're deploying" above) gets you something close for free, e.g.
  `https://ai-nexus-abcd1234-uc.a.run.app`, since that name is exactly what Cloud Run prefixes the
  address with; it's still not the bare `ai-nexus.app` with nothing else appended, though. That
  auto-generated address is what actually gets used in the steps below, captured straight into a
  variable, and it costs nothing. Getting the truly bare domain means buying one and mapping it
  afterward, which is optional, isn't part of this $0 guide, and is covered on its own in Step 8,
  after the frontend actually exists to map a domain onto.
- This guide never has you create an actual `.env` file. In production, Cloud Run injects these as
  real process environment variables/secrets directly onto the container (that's what the
  `--set-env-vars`/`--set-secrets` flags in the commands below do); the block above exists purely
  so you can see every value in one place, not as a file to create by hand.

---

## Deploying to Google Cloud (GCP): Cloud Run + Neon

**What gets created:** a free Postgres database on Neon, a container image registry (Artifact
Registry), and three running services on Cloud Run (`ai-nexus-backend`, `ai-nexus-python`,
`ai-nexus`, see "What you're deploying" above for how those map to this repo's folders).
Cloud Run's standing free tier (2,000,000 requests and ~180,000 vCPU-seconds a month) comfortably
covers demo/personal traffic, Voyage AI's 200-million-free-token allowance comfortably covers this
app's entire realistic embedding usage, and WeatherAPI's free tier (100,000 calls/month, if you
set it up at all) comfortably covers this app's entire realistic weather-tool usage too, so this
whole path is still $0/month.

### Step 0: Create a Google Cloud account and install its CLI

1. **(Your browser)** Go to [cloud.google.com](https://cloud.google.com/) and sign up (a credit
   card is required for identity verification, but you will not be charged as long as usage stays
   inside the free tier this guide uses).
2. **(Your browser, same Cloud Console site)** Create a project (or use one Google creates for you
   by default), then note its **Project ID** (shown on the Cloud Console dashboard, not the same
   as the project *name*). This is your `YOUR_PROJECT_ID` for every command below.
3. **(Your browser, to download)** Install the Google Cloud CLI:
   [cloud.google.com/sdk/docs/install](https://cloud.google.com/sdk/docs/install). The Windows
   installer adds `gcloud` to PowerShell automatically; close and reopen PowerShell after
   installing so it picks up the new command.
Items 4, 5, 6 and 8 below don't actually care which folder you're in, `gcloud auth`/`gcloud
config` store their state per-user, not per-folder. Stay in the `ai-nexus` root folder anyway (that's
where you already are after "Before you start"), it's one less thing to think about, and it's
where you need to be starting with Step 2 regardless.

4. **(Your local terminal, in the `ai-nexus` root folder)** Log in. This opens a browser window just
   to confirm the login, then control returns to PowerShell:
   ```powershell
   gcloud auth login
   ```
5. **(Your local terminal, in the `ai-nexus` root folder)** Select your project:
   ```powershell
   gcloud config set project YOUR_PROJECT_ID
   ```
6. **(Your local terminal, in the `ai-nexus` root folder)** Confirm it took effect, this should print
   back `YOUR_PROJECT_ID`:
   ```powershell
   gcloud config get-value project
   ```
7. **(Your browser, back in the Cloud Console)** Turn on billing for the project (required by
   Google even for free-tier usage): go to **Billing** in the left sidebar and link a billing
   account to this project.
8. **(Your local terminal, in the `ai-nexus` root folder)** Turn on the three Google APIs this guide
   uses (this is one single command, with three API names as its arguments):
   ```powershell
   gcloud services enable run.googleapis.com artifactregistry.googleapis.com secretmanager.googleapis.com
   ```

Every command below uses the region `us-central1` and the `YOUR_PROJECT_ID` you noted in step 2;
swap in your own region consistently if you'd rather use a different one, just keep it the same in
every command.

### Step 1: Create your free Postgres database (Neon)

**Where: Your browser.**

Go to [console.neon.tech](https://console.neon.tech), sign up (no credit card needed), and click
**New Project**. Pick a region close to `us-central1`. Neon defaults new projects to PostgreSQL
18, if you'd rather match this repo's local Postgres 16 exactly, pick **16** from the version
dropdown on this same screen, `pgvector` works identically either way. Once it's created, open the
**Connect to your branch** panel and make sure **Connection pooling** is toggled on before copying
the connection string, it looks like:
```text
postgresql://<user>:<password>@<endpoint>-pooler.neon.tech/<dbname>?sslmode=require
```
The `-pooler` in the hostname is not optional here: `backend` opens its own connection pool
(`vectorStore.ts`, up to 10 connections by default) independently in every Cloud Run instance, and
Cloud Run can scale `backend` out to several instances under real concurrent traffic. Without
pooling, all of those instances compete for Neon's much smaller direct-connection ceiling, and a
real burst of simultaneous users can exhaust it; with pooling, Neon's own proxy (PgBouncer) shares
a much larger effective capacity across all of them. This was verified live: 25 concurrent requests
against a database-backed endpoint succeeded cleanly on the pooled connection string after
switching from the direct one.

Save this somewhere; it's your `POSTGRES_URL` and you'll paste the whole thing, as-is, into a
command in Step 3. No extra setup needed here, the app itself creates the `pgvector` extension and
its tables the first time it connects.

### Step 2: Build and push the container images

**Where: Your local terminal, in the `ai-nexus` root folder.**

1. Create the image registry:
   ```powershell
   gcloud artifacts repositories create ai-nexus --repository-format=docker --location=us-central1
   ```
2. Authenticate Docker against it:
   ```powershell
   gcloud auth configure-docker us-central1-docker.pkg.dev
   ```
3. Build the backend image. Replace `YOUR_PROJECT_ID` with the Project ID from Step 0. Note the
   last argument is `.` (the repo root), not `backend`, because the backend needs the sibling
   `mcp-server/` folder alongside it:
   ```powershell
   docker build -f backend/Dockerfile -t us-central1-docker.pkg.dev/YOUR_PROJECT_ID/ai-nexus/backend:latest .
   ```
4. Build the python-service image:
   ```powershell
   docker build -f python-service/Dockerfile -t us-central1-docker.pkg.dev/YOUR_PROJECT_ID/ai-nexus/python-service:latest python-service
   ```
5. Push the backend image:
   ```powershell
   docker push us-central1-docker.pkg.dev/YOUR_PROJECT_ID/ai-nexus/backend:latest
   ```
6. Push the python-service image:
   ```powershell
   docker push us-central1-docker.pkg.dev/YOUR_PROJECT_ID/ai-nexus/python-service:latest
   ```

### Step 3: Store your database connection string and API key as secrets

**Where: Your local terminal, in the `ai-nexus` root folder.**

`gcloud secrets create` reads its value from a file, not typed inline, so write each one to a
small temporary file first, create the secret, then delete the file. You're creating up to four
secrets here: `postgres-url` (from Step 1), `anthropic-api-key` (from Step 4 of "Before you
start"), `voyage-api-key` (from Step 5) and `mcp-weather-api-key` (from Step 6, optional).

1. Write your real Neon connection string into a temporary file. `-NoNewline` matters here,
   without it PowerShell would add a trailing line break onto the end of your connection string,
   which some tools mis-parse:
   ```powershell
   Set-Content -Path secret.txt -Value 'PASTE_YOUR_REAL_NEON_CONNECTION_STRING_HERE' -NoNewline
   ```
2. Create the `postgres-url` secret from that file:
   ```powershell
   gcloud secrets create postgres-url --data-file=secret.txt
   ```
3. Overwrite the temporary file with your real Anthropic API key, reusing the same filename:
   ```powershell
   Set-Content -Path secret.txt -Value 'PASTE_YOUR_REAL_ANTHROPIC_API_KEY_HERE' -NoNewline
   ```
4. Create the `anthropic-api-key` secret from it:
   ```powershell
   gcloud secrets create anthropic-api-key --data-file=secret.txt
   ```
5. Overwrite the temporary file again with your real Voyage API key:
   ```powershell
   Set-Content -Path secret.txt -Value 'PASTE_YOUR_REAL_VOYAGE_API_KEY_HERE' -NoNewline
   ```
6. Create the `voyage-api-key` secret from it. Unlike the Anthropic key, **this one cannot be
   skipped**, see "About mock mode" above:
   ```powershell
   gcloud secrets create voyage-api-key --data-file=secret.txt
   ```
7. If you got a WeatherAPI key in Step 6 of "Before you start", overwrite the temporary file with
   it and create a fourth secret. Skip this step entirely if you didn't:
   ```powershell
   Set-Content -Path secret.txt -Value 'PASTE_YOUR_REAL_WEATHERAPI_KEY_HERE' -NoNewline
   gcloud secrets create mcp-weather-api-key --data-file=secret.txt
   ```
8. Delete the temporary file, every value you created a secret for is already stored in Secret
   Manager now:
   ```powershell
   Remove-Item secret.txt
   ```
9. Cloud Run's default service account can't read Secret Manager secrets until you explicitly
   grant it permission, without this, every `gcloud run deploy` in Step 4 that references one of
   these secrets fails with a `Permission denied on secret` error. Save your project number into a
   variable, then grant access:
   ```powershell
   $projectNumber = gcloud projects describe YOUR_PROJECT_ID --format='value(projectNumber)'
   gcloud projects add-iam-policy-binding YOUR_PROJECT_ID `
     --member="serviceAccount:$projectNumber-compute@developer.gserviceaccount.com" `
     --role="roles/secretmanager.secretAccessor"
   ```
   This grants read access to every secret in the project, simplest option for a single-owner
   project like this one; a production setup with multiple services and stricter isolation would
   instead grant this role per-secret.

If you decided to skip the Anthropic key and use mock mode instead (see above), just skip steps 3
and 4 here, and skip `ANTHROPIC_API_KEY` in Step 4's `--set-secrets` flag below too. Steps 5 and 6
(the Voyage key) are not skippable the same way; RAG, the semantic cache and extractive
summarization all fail without it. Step 7 (the WeatherAPI key) is skippable the same way the
Anthropic key is: skip it, and drop `MCP_WEATHER_API_KEY=mcp-weather-api-key:latest` from Step 4's
`--set-secrets` flag too. Step 9 (the Secret Manager permission grant) is never skippable, it's
required regardless of which of the optional secrets above you created.

### Step 4: Deploy the backend and python-service

**Where: Your local terminal, in the `ai-nexus` root folder.**

1. Deploy `python-service` first (`backend` needs to know its address), naming the Cloud Run
   service `ai-nexus-python` (see "What you're deploying" above). This is where the
   `voyage-api-key` secret from Step 3 goes, not on `backend`, since `python-service` is what
   actually calls Voyage AI:
   ```powershell
   gcloud run deploy ai-nexus-python `
     --image us-central1-docker.pkg.dev/YOUR_PROJECT_ID/ai-nexus/python-service:latest `
     --region us-central1 --no-allow-unauthenticated `
     --port 8001 `
     --set-secrets VOYAGE_API_KEY=voyage-api-key:latest
   ```
   The only environment variable this service needs is the one secret above.
   `EMBEDDING_SERVICE_PORT` from `.env.example` deliberately isn't set here: it only matters for
   running `python-service` locally outside Docker; the deployed image's own `Dockerfile` hardcodes
   `--port 8001` directly in its startup command, so there's nothing for this variable to configure
   in the container at all. Deliberately no `--ingress internal` here: that flag restricts inbound
   traffic to genuinely VPC-internal routing (a Serverless VPC Connector or similar), which neither
   service has set up, an earlier version of this guide included it, which made `backend` unable to
   reach `python-service` at all (silently, as a `404`, indistinguishable from an auth failure). The
   `--no-allow-unauthenticated` flag by itself, combined with the IAM grant and the ID token
   `backend` attaches to every request (both a few steps down), is already the actual security
   boundary: a public URL that's still cryptographically locked to only authorized callers.
2. Save its address into a variable, so you don't have to copy/paste it by hand:
   ```powershell
   $pythonServiceUrl = gcloud run services describe ai-nexus-python --region us-central1 --format 'value(status.url)'
   ```
3. Deploy `backend`, naming the Cloud Run service `ai-nexus-backend`, using that saved address and
   the secrets from Step 3:
   ```powershell
   gcloud run deploy ai-nexus-backend `
     --image us-central1-docker.pkg.dev/YOUR_PROJECT_ID/ai-nexus/backend:latest `
     --region us-central1 --allow-unauthenticated --port 4000 `
     --set-env-vars "PYTHON_EMBEDDING_SERVICE_URL=$pythonServiceUrl" `
     --set-secrets "POSTGRES_URL=postgres-url:latest,ANTHROPIC_API_KEY=anthropic-api-key:latest,MCP_WEATHER_API_KEY=mcp-weather-api-key:latest"
   ```
   `--set-secrets` is quoted here for the same reason `--set-env-vars` above it is: on Windows,
   `gcloud` is actually `gcloud.cmd`, a batch-file wrapper around a Python process, and an unquoted
   value containing both commas and `=` can get corrupted passing through that extra layer,
   `gcloud` crashing with a `ValueError` about an "Invalid secret spec" that's missing a key or has
   commas turned into spaces is exactly what that corruption looks like. A single secret with no
   comma (`python-service`'s `--set-secrets` above) isn't affected, only multi-secret,
   comma-joined values are. `PORT` deliberately isn't in `--set-env-vars`: Cloud Run treats it as a
   reserved name it sets automatically from the `--port` flag right before it, and rejects a deploy
   that also tries to set it explicitly.
   (If you skipped the Anthropic key and are using mock mode instead, drop
   `,ANTHROPIC_API_KEY=anthropic-api-key:latest` from the `--set-secrets` value above. If you
   skipped the WeatherAPI key, drop `,MCP_WEATHER_API_KEY=mcp-weather-api-key:latest` the same
   way; either can be dropped independently of the other.)

   That's five of `backend`'s six `.env.example` variables handled (`PORT`,
   `PYTHON_EMBEDDING_SERVICE_URL`, `POSTGRES_URL`, `ANTHROPIC_API_KEY`, `MCP_WEATHER_API_KEY`); the
   sixth, `FRONTEND_URL`, isn't set yet on purpose, since the frontend doesn't have an address to
   give it until Step 5 exists, that's exactly what Step 6 comes back to add. Two more
   `backend`-read variables from `.env.example` never show up in any `gcloud` command at all:
   `ANTHROPIC_MODEL` (its default in `backend/src/config.ts`, `claude-sonnet-5`, already matches
   what this guide uses, so there's nothing to override unless you specifically want a different
   model) and `MCP_SERVER_ENTRY` (`backend/Dockerfile` already bakes in the correct absolute
   container path for it, so setting it here would just be overriding a value that's already
   right).
4. `backend` also needs explicit permission to call `python-service` (Cloud Run requires this
   even for two services in the same project). This grant alone only authorizes the call, `backend`
   also has to actually attach a Google-signed ID token proving its identity to every request, which
   is what `backend/src/pythonServiceAuth.ts` does automatically (fetched from Cloud Run's metadata
   server, no configuration needed here), skipping itself entirely for local dev and Docker
   Compose, where `python-service` isn't behind this auth at all. First save your project's number
   into a variable:
   ```powershell
   $projectNumber = gcloud projects describe YOUR_PROJECT_ID --format='value(projectNumber)'
   ```
5. Then grant the permission:
   ```powershell
   gcloud run services add-iam-policy-binding ai-nexus-python `
     --region us-central1 `
     --member="serviceAccount:$projectNumber-compute@developer.gserviceaccount.com" `
     --role="roles/run.invoker"
   ```
   If `backend` can already reach `python-service` without this (check with `gcloud run services
   get-iam-policy ai-nexus-python --region us-central1`, e.g. after deploying `backend` in step 4
   below), it's very likely because the default compute service account also holds the
   project-wide `roles/editor` role, a role broad enough to include `run.routes.invoke` on every
   Cloud Run service in the project, granted automatically by Google on many projects and visible
   only at the project level (`gcloud projects get-iam-policy YOUR_PROJECT_ID`), not on the
   individual service. Run this step anyway even if that's the case: relying on `Editor`'s broad
   access instead of an explicit, least-privilege grant is bad practice, and plenty of real-world
   GCP setups explicitly turn that automatic grant off, which would break this call silently if
   this step were skipped.
6. Save the backend's own web address, you need it in the next step:
   ```powershell
   $backendUrl = gcloud run services describe ai-nexus-backend --region us-central1 --format 'value(status.url)'
   ```
7. Print it so you can see it, e.g. `https://ai-nexus-backend-abcd1234-uc.a.run.app`:
   ```powershell
   $backendUrl
   ```

### Step 5: Build and deploy the frontend

**Where: Your local terminal, still in the `ai-nexus` root folder, same window as Step 4** (so
`$backendUrl` is still set; if you closed it, re-run the one-line command from the end of Step 4
first). The `frontend` at the end of the `docker build` command below is a build-context argument,
not a folder to `cd` into.

1. Build the frontend image, baking in the backend's address:
   ```powershell
   docker build -f frontend/Dockerfile `
     --build-arg "NEXT_PUBLIC_API_BASE_URL=$backendUrl" `
     -t us-central1-docker.pkg.dev/YOUR_PROJECT_ID/ai-nexus/frontend:latest frontend
   ```
   `NEXT_PUBLIC_API_BASE_URL` is `frontend`'s only `.env.example` variable, and this build-arg is
   the one and only place it's ever set: it's baked into the static JS at build time, not read at
   runtime, which is exactly why the `gcloud run deploy ai-nexus` command in step 3 below has no
   `--set-env-vars` flag at all, unlike `backend`'s deploy command. This only actually works because
   `frontend/Dockerfile` explicitly declares `NEXT_PUBLIC_API_BASE_URL` as an `ARG` and promotes it
   to `ENV` before `npm run build` runs; a bare `--build-arg` on the command line isn't enough by
   itself, and without that Dockerfile plumbing every deployed page silently falls back to
   `http://localhost:4000`, unreachable from a real browser (every feature failing identically is
   the symptom, see `codebase.md`'s `lib/api.ts` section).
2. Push it:
   ```powershell
   docker push us-central1-docker.pkg.dev/YOUR_PROJECT_ID/ai-nexus/frontend:latest
   ```
3. Deploy it, naming the Cloud Run service `ai-nexus` (see "What you're deploying" above) so its
   public URL reads `https://ai-nexus-abcd1234-uc.a.run.app` instead of a generic `frontend-...`
   prefix:
   ```powershell
   gcloud run deploy ai-nexus `
     --image us-central1-docker.pkg.dev/YOUR_PROJECT_ID/ai-nexus/frontend:latest `
     --region us-central1 --allow-unauthenticated --port 3000
   ```

### Step 6: Point the backend at the now-deployed frontend

**Where: Your local terminal, in the `ai-nexus` root folder.**

1. Save the frontend's address into a variable:
   ```powershell
   $frontendUrl = gcloud run services describe ai-nexus --region us-central1 --format 'value(status.url)'
   ```
2. Update the backend with it. This is a config-only update, no image rebuild, it takes effect
   within a few seconds. `--update-env-vars` only adds/changes the one variable named, so it
   doesn't wipe out `PORT`/`PYTHON_EMBEDDING_SERVICE_URL` from Step 4:
   ```powershell
   gcloud run services update ai-nexus-backend `
     --region us-central1 `
     --update-env-vars "FRONTEND_URL=$frontendUrl"
   ```

### Step 7: Confirm it's actually working

**Where: Your local terminal, in the `ai-nexus` root folder**, then **your browser**.

1. Check the backend's logs:
   ```powershell
   gcloud run services logs read ai-nexus-backend --region us-central1 --limit 50
   ```
   Look for a log line confirming it connected to Postgres and finished loading its knowledge
   base (the same lines you'd see locally right after `npm run dev` starts).
2. Open the frontend in your browser, `$frontendUrl` still has the address from Step 6:
   ```powershell
   Start-Process $frontendUrl
   ```
   That address is the link you share; if you want to type it into the browser by hand instead,
   just run `$frontendUrl` on its own to print it.

### Step 8 (optional): Map a custom domain to the frontend

**Where: Your browser** for domain verification, **your local terminal** for the rest.

Skip this entirely if the auto-generated `$frontendUrl` from Step 7 is fine to share as-is; it
already works, is already on HTTPS, and costs nothing. This step is only for replacing it with
something like `ai-nexus.app`. Two real costs before you start: buying the domain itself from a
registrar (Squarespace Domains, Namecheap, Cloudflare, etc., typically $10–20/year), the one part
of this entire guide that isn't free; and this feature is only available in a specific list of
Cloud Run regions, `us-central1` (the region this whole guide uses) among them, so nothing extra
to check there.

1. **(Your browser)** Buy the domain from any registrar, if you don't already own it.
2. **(Your local terminal)** Verify you own it, unless you bought it through Google domains
   directly. This opens a browser tab for Google Search Console's ownership check:
   ```powershell
   gcloud domains verify ai-nexus.app
   ```
   Mapping a subdomain instead (e.g. `www.ai-nexus.app`)? Verify the base domain (`ai-nexus.app`),
   not the subdomain; Google's verification is base-domain-wide.
3. **(Your local terminal)** Create the mapping. This is a `beta` command; `gcloud` will offer to
   install that component automatically the first time if you don't have it yet:
   ```powershell
   gcloud beta run domain-mappings create --service ai-nexus --domain ai-nexus.app --region us-central1
   ```
4. **(Your local terminal)** Get the DNS records Google needs you to add:
   ```powershell
   gcloud beta run domain-mappings describe --domain ai-nexus.app --region us-central1
   ```
   The output includes a `resourceRecords` list: one or more `A`/`AAAA` records for the apex domain
   (`ai-nexus.app` itself, entered as `@` at most registrars) or a `CNAME` record if you mapped a
   subdomain instead.
5. **(Your browser)** Add exactly those records at your registrar's DNS settings page. This part
   genuinely varies by registrar; look for "DNS" or "DNS management," not domain settings generally.
6. Wait. DNS propagation and Google's automatic SSL certificate issuance together usually take
   under 15 minutes, but can take up to 24 hours; `https://ai-nexus.app` simply won't resolve (or
   will show a certificate warning) until both finish. The original `$frontendUrl` from Step 7
   keeps working the entire time and afterward too: mapping a domain adds a second address, it
   doesn't replace the first.

**One catch specific to this app, not a generic Cloud Run one:** the backend's CORS policy
(`FRONTEND_URL`, set in Step 6) only allows the exact origin(s) you told it about. If people start
reaching the frontend at `https://ai-nexus.app` instead of the `.run.app` address, the backend
needs that origin added too, or its own API calls back to `backend` will get blocked by CORS, a
broken-looking app with no obvious error beyond the browser console. `FRONTEND_URL` already accepts
a comma-separated list, so update it to include both rather than replacing one with the other. The
`^;^` prefix below isn't optional here: `--update-env-vars` is a `KEY=VALUE` flag that normally
splits on every comma to find separate variables, so without it, gcloud tries to parse the second
URL as its own `KEY=VALUE` pair and fails with `Bad syntax for dict arg`; `^;^` tells gcloud to
split pairs on `;` instead, leaving the comma inside `FRONTEND_URL`'s own value alone:
```powershell
gcloud run services update ai-nexus-backend --region us-central1 --update-env-vars "^;^FRONTEND_URL=https://ai-nexus.app,https://ai-nexus-abcd1234-uc.a.run.app"
```

---

## Updating the app after you deploy

Deploying this way does **not** wire this repo up to GitHub or Cloud Run in any automatic sense:
`git push` alone never updates the live app, since there's no CI/CD pipeline set up by anything
above. Once everything here is working and confirmed (Step 7), go straight to **`CI-CD.md`** in
this same folder: it picks up exactly where this file leaves off, automating the rebuild-push-
redeploy cycle a code change needs, rather than running it by hand every time.

---

## Good to know

- **`python-service` and `postgres` are never given a public web address**, on purpose, only
  `backend` and `frontend` are reachable from outside.
- **Never put `ANTHROPIC_API_KEY`, `VOYAGE_API_KEY` or `MCP_WEATHER_API_KEY` directly in a
  Dockerfile or commit them to git.** This guide only ever loads any of them from Secret Manager
  at runtime.
- **`VOYAGE_API_KEY` has no mock-mode equivalent.** Unlike the Anthropic key, which degrades to a
  labeled placeholder reply if skipped, embeddings have no offline fallback anywhere in this app:
  RAG, the semantic cache and extractive summarization all fail outright without a real Voyage key.
- **`mcp-server` is never deployed as its own separate step.** It's already compiled into the
  backend's image and started automatically alongside it (`backend/src/agent/mcpClient.ts` spawns
  it as a background process, forwarding its own environment to it so `MCP_WEATHER_API_KEY` and
  friends actually reach the spawned process). There's nothing extra to set up for it.
- **`MCP_WEATHER_API_KEY` degrades per-tool-call, not per-app.** Skip it and the agent's
  `get_weather` tool returns a clear error when called; `get_current_time`, `list_ai_concepts` and
  everything else in the app keep working normally, since they share the same MCP server process
  but don't depend on this key at all.
- **First request after idle time will be a bit slow.** Cloud Run can scale down to zero running
  instances when nobody's using the app, and Neon's free database does the same. That's what
  keeps this free, but it means the very first request after a period of no traffic takes a few
  extra seconds while everything wakes back up. Every request after that is fast again.
- **Free-tier limits can change.** The numbers referenced above (Cloud Run's standing free grant,
  Neon's free storage/compute) are current as of this writing; check each provider's own pricing
  page if you're relying on this long after reading it.
- **If something doesn't come up correctly**, the single most useful thing to check first is the
  `backend` logs command from Step 7, it tells you immediately whether the problem is "can't
  reach Postgres" versus something else. Failure modes actually hit while writing this guide, in
  case the logs point at one of these:
  - `backend` deploy fails with `container failed to start ... within the allocated timeout` and
    the logs never get past `[rag] seeding vector store from N knowledge-base file(s)...`: almost
    always Postgres, not `python-service`, check `vectorStore.ts`'s `ssl`/`connectionTimeoutMillis`
    config exists (it's meant to be permanent, this is only worth checking if you've hand-edited
    that file) and that Step 1's Neon connection string is exactly right in the `postgres-url`
    secret (Step 3 has a verification command for this).
  - Same timeout error, but the logs show `embedding service responded 404` instead: `backend`
    reached `python-service` but was rejected, either the Step 4 `run.invoker` IAM grant never
    actually applied (`gcloud run services get-iam-policy ai-nexus-python --region us-central1`
    should show it) or `python-service` was deployed with `--ingress internal` despite this guide's
    Step 4 no longer including that flag (network-layer block, happens before auth is even
    checked).
  - The site loads but every feature (chat, RAG, agent, everything) fails identically: the
    frontend's built-in JS is calling `localhost:4000` instead of the real backend, meaning
    `NEXT_PUBLIC_API_BASE_URL` didn't actually get baked in at Step 5's `docker build`. Open
    DevTools → Network on the failing request and check the URL it's actually trying to reach to
    confirm this before anything else. Verify `frontend/Dockerfile` declares
    `NEXT_PUBLIC_API_BASE_URL` as both an `ARG` and an `ENV` before its `RUN npm run build` line
    (meant to be permanent, only worth checking if hand-edited), then rebuild Step 5 from scratch.
  - The GitHub Actions workflow fails on the `google-github-actions/auth` step specifically with
    `PERMISSION_DENIED: IAM Service Account Credentials API has not been used`: see `CI-CD.md`
    Step 1, item 0.
  - `backend` works fine for one user at a time but starts failing under real concurrent traffic
    (many visitors at once, e.g. right after sharing the live link somewhere): check whether your
    `postgres-url` secret uses Neon's pooled connection string (`-pooler` in the hostname, see
    Step 1) rather than the direct one. Cloud Run scaling `backend` out to multiple instances under
    load means multiple separate connection pools competing for Neon's much smaller direct-
    connection ceiling; switching to the pooled string fixes this, verified live by firing 25
    concurrent requests at a database-backed endpoint and confirming all 25 succeeded.
  - `embeddingsClient.ts`'s retries throw `This operation was aborted` after a period of no
    traffic, even though nothing is actually broken: `python-service` scaled to zero and needed
    longer than the per-attempt timeout to cold-start, fetch its auth token and reach Voyage's API.
    The timeout is meant to already be generous enough (15s) to survive this; only worth checking
    if you've hand-edited that file down to something tighter.

---

## Stopping or deleting this deployment

None of this is urgent for cost reasons, everything here scales to zero or sits in a free tier
either way (see "Good to know" above), so leaving it all running costs $0 whether you use it
again tomorrow or never touch it again. This section is for when you want it torn down anyway,
for tidiness, to reclaim the `ainexusacr`-style unique name, or because you're done with the
project entirely. None of the commands below care which folder your terminal is in, they all act
on cloud resources by name, not local files, so **Where: Your local terminal**, any folder, for
every command in this section.

### Option 1: Delete just AI Nexus's pieces (keep your GCP project for other things)

Do this if you might use this same GCP project for something else later and want to keep it, just
remove what this guide created.

1. If you did Step 8 and mapped a custom domain, delete that mapping first (skip this one if you
   never did Step 8):
   ```powershell
   gcloud beta run domain-mappings delete --domain ai-nexus.app --region us-central1
   ```
2. Delete the frontend service:
   ```powershell
   gcloud run services delete ai-nexus --region us-central1
   ```
3. Delete the backend service:
   ```powershell
   gcloud run services delete ai-nexus-backend --region us-central1
   ```
4. Delete the python-service service:
   ```powershell
   gcloud run services delete ai-nexus-python --region us-central1
   ```
5. Delete the `postgres-url` secret:
   ```powershell
   gcloud secrets delete postgres-url
   ```
6. Delete the `anthropic-api-key` secret (skip this one if you used mock mode and never created
   it):
   ```powershell
   gcloud secrets delete anthropic-api-key
   ```
7. Delete the `voyage-api-key` secret:
   ```powershell
   gcloud secrets delete voyage-api-key
   ```
8. Delete the `mcp-weather-api-key` secret (skip this one if you never created it):
   ```powershell
   gcloud secrets delete mcp-weather-api-key
   ```
9. Delete the Artifact Registry repository. This removes the `backend`, `frontend` and
   `python-service` images inside it too, you don't need to delete those separately:
   ```powershell
   gcloud artifacts repositories delete ai-nexus --location=us-central1
   ```
10. **(Your browser, optional)** Delete the Neon project: go to
   [console.neon.tech](https://console.neon.tech), open the project you created in Step 1, and
   delete it from its settings page. Neon is a separate company from Google Cloud, so nothing in
   the `gcloud` commands above touches it, this is the only step that isn't a `gcloud` command.

Each `gcloud ... delete` command above will ask you to confirm with a `y`/`N` prompt before it
actually deletes anything.

### Option 2: Delete the entire GCP project (fastest, guaranteed $0 going forward)

Do this instead of Option 1 if the project you created in Step 0 was made just for this guide and
you don't need it for anything else. This removes every resource above in one command, along with
anything else you may have put in that project, so only run it if you're sure:
```powershell
gcloud projects delete YOUR_PROJECT_ID
```
Replace `YOUR_PROJECT_ID` with the same Project ID you've used in every command throughout this
guide. Google gives you roughly a 30-day grace period where the project is disabled but
recoverable before it's permanently purged, in case you delete the wrong one by mistake. This
does not touch your Neon project, delete that separately in your browser the same way as step 10
in Option 1 above if you want it gone too.
