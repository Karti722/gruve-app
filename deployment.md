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

### What you're deploying

Four pieces, mirroring `docker-compose.yml`:

| Service | What it is | Who can reach it |
|---|---|---|
| `frontend` | The Next.js website, what you open in a browser | **Public** |
| `backend` | The Express API the frontend and any API client talks to | **Public** |
| `python-service` | A FastAPI microservice doing embeddings (via a real Voyage AI call), extractive summarization, caching and evaluation | **Internal only**, just `backend` talks to it |
| `postgres` | A managed Postgres database with the `pgvector` extension | **Internal only**, just `backend` talks to it |

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
`frontend/lib/api.ts`) still applies in production, just pointed at real cloud URLs instead of
`localhost`. Here's every one, what it's for, and an illustrative example value, using
`ai-nexus.app`-style names instead of `localhost` so it's obvious which URL is which:

| Variable | Set on | Example value | Where the real value comes from |
|---|---|---|---|
| `NEXT_PUBLIC_API_BASE_URL` | `frontend`, **build-time** | `https://api.ai-nexus.app` | `backend`'s public URL, captured automatically in Step 4 |
| `FRONTEND_URL` | `backend` | `https://ai-nexus.app` | `frontend`'s public URL, captured automatically in Step 6 |
| `PYTHON_EMBEDDING_SERVICE_URL` | `backend` | the internal URL Cloud Run prints | `python-service`'s internal address, captured automatically in Step 4 |
| `POSTGRES_URL` | `backend` | `postgresql://nexus:REAL_PASSWORD@ep-cool-forest-123456.us-east-2.aws.neon.tech/nexus_vectors?sslmode=require` | the Neon connection string from Step 1 |
| `ANTHROPIC_API_KEY` | `backend` | `sk-ant-api03-REAL_KEY_FROM_CONSOLE` | [console.anthropic.com](https://console.anthropic.com/), from Step 4 of "Before you start"; omit for mock mode instead, see "About mock mode" above |
| `ANTHROPIC_MODEL` | `backend` | `claude-sonnet-5` | fixed, already this repo's default |
| `PORT` | `backend` | `4000` | fixed, matches `backend/Dockerfile` |
| `VOYAGE_API_KEY` | `python-service` | `pa-REAL_KEY_FROM_DASHBOARD` | [dashboard.voyageai.com](https://dashboard.voyageai.com/), from Step 5 of "Before you start"; **required**, no mock-mode equivalent, see above |
| `EMBEDDING_SERVICE_PORT` | `python-service` | `8001` | fixed, matches `python-service/Dockerfile` |

Put together, a fully filled-in production `.env` (illustrative values, not real ones, and not a
file you actually create, see the note below) looks like:
```text
ANTHROPIC_API_KEY=sk-ant-api03-REAL_KEY_FROM_CONSOLE
ANTHROPIC_MODEL=claude-sonnet-5
PORT=4000
FRONTEND_URL=https://ai-nexus.app
PYTHON_EMBEDDING_SERVICE_URL=http://python-service:8001
POSTGRES_URL=postgresql://nexus:REAL_PASSWORD@ep-cool-forest-123456.us-east-2.aws.neon.tech/nexus_vectors?sslmode=require
VOYAGE_API_KEY=pa-REAL_KEY_FROM_DASHBOARD
EMBEDDING_SERVICE_PORT=8001
NEXT_PUBLIC_API_BASE_URL=https://api.ai-nexus.app
```
**Two important catches:**
- Cloud Run doesn't give you a clean domain like `https://ai-nexus.app` for free by default, it
  hands you an auto-generated address instead (e.g. `https://frontend-abcd1234-uc.a.run.app`).
  That auto-generated address is what actually gets used in the steps below, captured straight
  into a variable, and it costs nothing. The `ai-nexus.app`-style names above are only there so
  it's obvious at a glance which variable is "the frontend's address" versus "the backend's
  address"; getting an actual clean domain name means buying one and mapping it afterward ([Cloud
  Run domain mapping](https://cloud.google.com/run/docs/mapping-custom-domains)), which is
  optional and not part of this $0 guide.
- This guide never has you create an actual `.env` file. In production, Cloud Run injects these as
  real process environment variables/secrets directly onto the container (that's what the
  `--set-env-vars`/`--set-secrets` flags in the commands below do); the block above exists purely
  so you can see every value in one place, not as a file to create by hand.

---

## Deploying to Google Cloud (GCP): Cloud Run + Neon

**What gets created:** a free Postgres database on Neon, a container image registry (Artifact
Registry), and three running services on Cloud Run (`backend`, `python-service`, `frontend`).
Cloud Run's standing free tier (2,000,000 requests and ~180,000 vCPU-seconds a month) comfortably
covers demo/personal traffic, and Voyage AI's 200-million-free-token allowance comfortably covers
this app's entire realistic embedding usage, so this whole path is still $0/month.

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
dropdown on this same screen, `pgvector` works identically either way. Once it's created, copy
the **connection string** it shows you, it looks like:
```text
postgresql://<user>:<password>@<endpoint>.neon.tech/<dbname>?sslmode=require
```
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
small temporary file first, create the secret, then delete the file. You're creating three
secrets here: `postgres-url` (from Step 1), `anthropic-api-key` (from Step 4 of "Before you
start") and `voyage-api-key` (from Step 5 of "Before you start").

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
7. Delete the temporary file, all three values are already stored in Secret Manager now:
   ```powershell
   Remove-Item secret.txt
   ```

If you decided to skip the Anthropic key and use mock mode instead (see above), just skip steps 3
and 4 here, and skip `ANTHROPIC_API_KEY` in Step 4's `--set-secrets` flag below too. Steps 5 and 6
(the Voyage key) are not skippable the same way; RAG, the semantic cache and extractive
summarization all fail without it.

### Step 4: Deploy the backend and python-service

**Where: Your local terminal, in the `ai-nexus` root folder.**

1. Deploy `python-service` first (`backend` needs to know its address). This is where the
   `voyage-api-key` secret from Step 3 goes, not on `backend`, since `python-service` is what
   actually calls Voyage AI:
   ```powershell
   gcloud run deploy python-service `
     --image us-central1-docker.pkg.dev/YOUR_PROJECT_ID/ai-nexus/python-service:latest `
     --region us-central1 --no-allow-unauthenticated --ingress internal `
     --port 8001 `
     --set-secrets VOYAGE_API_KEY=voyage-api-key:latest
   ```
2. Save its address into a variable, so you don't have to copy/paste it by hand:
   ```powershell
   $pythonServiceUrl = gcloud run services describe python-service --region us-central1 --format 'value(status.url)'
   ```
3. Deploy `backend`, using that saved address and both secrets from Step 3:
   ```powershell
   gcloud run deploy backend `
     --image us-central1-docker.pkg.dev/YOUR_PROJECT_ID/ai-nexus/backend:latest `
     --region us-central1 --allow-unauthenticated --port 4000 `
     --set-env-vars "PORT=4000,PYTHON_EMBEDDING_SERVICE_URL=$pythonServiceUrl" `
     --set-secrets POSTGRES_URL=postgres-url:latest,ANTHROPIC_API_KEY=anthropic-api-key:latest
   ```
   (If you skipped the Anthropic key and are using mock mode instead, drop
   `,ANTHROPIC_API_KEY=anthropic-api-key:latest` from the `--set-secrets` value above.)
4. `backend` also needs explicit permission to call `python-service` (Cloud Run requires this
   even for two services in the same project). First save your project's number into a variable:
   ```powershell
   $projectNumber = gcloud projects describe YOUR_PROJECT_ID --format='value(projectNumber)'
   ```
5. Then grant the permission:
   ```powershell
   gcloud run services add-iam-policy-binding python-service `
     --region us-central1 `
     --member="serviceAccount:$projectNumber-compute@developer.gserviceaccount.com" `
     --role="roles/run.invoker"
   ```
6. Save the backend's own web address, you need it in the next step:
   ```powershell
   $backendUrl = gcloud run services describe backend --region us-central1 --format 'value(status.url)'
   ```
7. Print it so you can see it, e.g. `https://backend-abcd1234-uc.a.run.app`:
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
2. Push it:
   ```powershell
   docker push us-central1-docker.pkg.dev/YOUR_PROJECT_ID/ai-nexus/frontend:latest
   ```
3. Deploy it:
   ```powershell
   gcloud run deploy frontend `
     --image us-central1-docker.pkg.dev/YOUR_PROJECT_ID/ai-nexus/frontend:latest `
     --region us-central1 --allow-unauthenticated --port 3000
   ```

### Step 6: Point the backend at the now-deployed frontend

**Where: Your local terminal, in the `ai-nexus` root folder.**

1. Save the frontend's address into a variable:
   ```powershell
   $frontendUrl = gcloud run services describe frontend --region us-central1 --format 'value(status.url)'
   ```
2. Update the backend with it. This is a config-only update, no image rebuild, it takes effect
   within a few seconds. `--update-env-vars` only adds/changes the one variable named, so it
   doesn't wipe out `PORT`/`PYTHON_EMBEDDING_SERVICE_URL` from Step 4:
   ```powershell
   gcloud run services update backend `
     --region us-central1 `
     --update-env-vars "FRONTEND_URL=$frontendUrl"
   ```

### Step 7: Confirm it's actually working

**Where: Your local terminal, in the `ai-nexus` root folder**, then **your browser**.

1. Check the backend's logs:
   ```powershell
   gcloud run services logs read backend --region us-central1 --limit 50
   ```
   Look for a log line confirming it connected to Postgres and finished loading its knowledge
   base (the same lines you'd see locally right after `npm run dev` starts).
2. Open the frontend in your browser, `$frontendUrl` still has the address from Step 6:
   ```powershell
   Start-Process $frontendUrl
   ```
   That address is the link you share; if you want to type it into the browser by hand instead,
   just run `$frontendUrl` on its own to print it.

---

## Updating the app after you deploy

Deploying this way does **not** wire this repo up to GitHub or Cloud Run in any automatic sense:
`git push` alone never updates the live app, since there's no CI/CD pipeline set up here. Every
`docker build` command in Steps 2 and 5 reads whatever's on your local disk at the moment you run
it, not from GitHub, so committing/pushing to GitHub and updating the *live* deployed app are two
entirely separate actions on two separate schedules. Keep committing and pushing to GitHub however
often you like; separately, whenever you want a code change to actually show up on the live site,
repeat these steps for just the service(s) you changed, from the `ai-nexus` root folder:

1. Rebuild that service's image: the same `docker build` command from Step 2 (`backend` or
   `python-service`) or Step 5 (`frontend`).
2. Push it: the same `docker push` command.
3. Redeploy it onto the existing service, e.g. for the backend:
   ```powershell
   gcloud run deploy backend `
     --image us-central1-docker.pkg.dev/YOUR_PROJECT_ID/ai-nexus/backend:latest `
     --region us-central1
   ```
   (swap `backend` for `python-service` or `frontend` as needed). This updates the running service
   in place, it does **not** wipe out the secrets, environment variables or IAM permissions you
   already set up for it back in Steps 3 and 4, only the container image changes, so you never need
   to recreate any of those on a routine update.

Two things that only come up the first time you do this, not on every later update:
- If you only changed `frontend`, you can skip its `--build-arg NEXT_PUBLIC_API_BASE_URL=...` flag
  on rebuild: the backend's URL doesn't change across redeploys, so the value already baked in is
  still correct.
- If you change what `backend` needs from `python-service` (or vice versa), redeploy
  `python-service` first, same as Step 4 originally did, so `backend` always points at a
  `python-service` that's actually already running the new code.

---

## Good to know

- **`python-service` and `postgres` are never given a public web address**, on purpose, only
  `backend` and `frontend` are reachable from outside.
- **Never put `ANTHROPIC_API_KEY` or `VOYAGE_API_KEY` directly in a Dockerfile or commit them to
  git.** This guide only ever loads either from Secret Manager at runtime.
- **`VOYAGE_API_KEY` has no mock-mode equivalent.** Unlike the Anthropic key, which degrades to a
  labeled placeholder reply if skipped, embeddings have no offline fallback anywhere in this app:
  RAG, the semantic cache and extractive summarization all fail outright without a real Voyage key.
- **`mcp-server` is never deployed as its own separate step.** It's already compiled into the
  backend's image and started automatically alongside it (`backend/src/agent/mcpClient.ts` spawns
  it as a background process). There's nothing extra to set up for it.
- **First request after idle time will be a bit slow.** Cloud Run can scale down to zero running
  instances when nobody's using the app, and Neon's free database does the same. That's what
  keeps this free, but it means the very first request after a period of no traffic takes a few
  extra seconds while everything wakes back up. Every request after that is fast again.
- **Free-tier limits can change.** The numbers referenced above (Cloud Run's standing free grant,
  Neon's free storage/compute) are current as of this writing; check each provider's own pricing
  page if you're relying on this long after reading it.
- **If something doesn't come up correctly**, the single most useful thing to check first is the
  `backend` logs command from Step 7, it tells you immediately whether the problem is "can't
  reach Postgres" versus something else.

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

1. Delete the frontend service:
   ```powershell
   gcloud run services delete frontend --region us-central1
   ```
2. Delete the backend service:
   ```powershell
   gcloud run services delete backend --region us-central1
   ```
3. Delete the python-service service:
   ```powershell
   gcloud run services delete python-service --region us-central1
   ```
4. Delete the `postgres-url` secret:
   ```powershell
   gcloud secrets delete postgres-url
   ```
5. Delete the `anthropic-api-key` secret (skip this one if you used mock mode and never created
   it):
   ```powershell
   gcloud secrets delete anthropic-api-key
   ```
6. Delete the `voyage-api-key` secret:
   ```powershell
   gcloud secrets delete voyage-api-key
   ```
7. Delete the Artifact Registry repository. This removes the `backend`, `frontend` and
   `python-service` images inside it too, you don't need to delete those separately:
   ```powershell
   gcloud artifacts repositories delete ai-nexus --location=us-central1
   ```
8. **(Your browser, optional)** Delete the Neon project: go to
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
does not touch your Neon project, delete that separately in your browser the same way as step 8
in Option 1 above if you want it gone too.
