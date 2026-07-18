# Deploying AI Nexus (Free)

This guide walks you through deploying AI Nexus for **$0/month**, from a completely blank
starting point: no cloud account, nothing installed. Follow the numbered steps in order; don't
skip ahead.

There are two options below, **Option A: Google Cloud (GCP)** and **Option B: Microsoft
Azure**. Pick ONE. You do not need both, and you do not need to read the section for the one you
don't pick. If you have no preference, pick **Option A (GCP)**: it needs one less manual
permission-setup step than Azure.

**Every command below is run in a terminal on your own computer** (Command Prompt, PowerShell, or
a Mac/Linux terminal, whichever you normally use), starting from the root folder of your local
copy of this repository (the folder that directly contains `docker-compose.yml`). Steps that
instead happen in a web browser are explicitly marked **Where: Browser**; everything else is
marked **Where: Terminal, in the `ai-nexus` folder**.

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
| PostgreSQL | 16 | `docker-compose.yml`'s `postgres` service (`pgvector/pgvector:pg16`) |
| pgvector extension | bundled with the `pgvector/pgvector:pg16` image | same |

Neither cloud CLI's own version is pinned anywhere in this repo, install whatever the newest
release is from each Step 0 link below, both `gcloud` and `az` are backward-compatible enough that
this guide doesn't depend on a specific CLI version.

**As of this writing**, Neon defaults brand-new projects to **PostgreSQL 18**, not 16, but lets
you pick any version from 14 through 18 at project-creation time; `pgvector` works the same way
on all of them. Both options' Step 1 below tells you where to pick 16 explicitly if you'd rather
exactly match the version this repo runs locally; either way, it's a one-click choice in Neon's
project-creation screen, not a command.

---

## Before you start (do this once, no matter which option you pick)

**Where: Terminal**, then **Browser** for step 4.

1. Install Docker Desktop: [docker.com/products/docker-desktop](https://www.docker.com/products/docker-desktop/).
   After installing, open a terminal and confirm it worked:
   ```bash
   docker --version
   ```
2. Install Git, if you don't already have it: [git-scm.com/downloads](https://git-scm.com/downloads).
3. Clone this repository and move into it. Every command in the rest of this guide assumes your
   terminal is sitting in this folder:
   ```bash
   git clone <your-repo-url>
   cd ai-nexus
   ```
4. **Optional, can be done later:** get a free API key at
   [console.anthropic.com](https://console.anthropic.com/) if you want the deployed app to give
   real Claude responses. You can skip this entirely for now; see "About mock mode" right below
   for what happens if you do.

### What you're deploying

Four pieces, mirroring `docker-compose.yml`:

| Service | What it is | Who can reach it |
|---|---|---|
| `frontend` | The Next.js website, what you open in a browser | **Public** |
| `backend` | The Express API the frontend and any API client talks to | **Public** |
| `python-service` | A FastAPI microservice doing embeddings, summarization, evaluation | **Internal only**, just `backend` talks to it |
| `postgres` | A managed Postgres database with the `pgvector` extension | **Internal only**, just `backend` talks to it |

Because the frontend needs to know the backend's web address before it's built, and the backend
needs to know the frontend's address to allow it to make calls, you deploy in this order every
time: **backend and python-service first, then frontend, then a final one-line update back on the
backend.** Both options below follow that order.

### About mock mode (this is why the app costs $0 in LLM calls too)

If you never set an `ANTHROPIC_API_KEY` (Step 4 above), the deployed app still works completely:
every feature runs for real except the very last step of each AI answer, which returns a
canned, clearly-labeled `[MOCK MODE]` response instead of a real Claude reply. This keeps the
whole deployment at $0, with nothing metered. Add a real key later, at any time, the same way
each option below shows, if you want live Claude responses; that's a small pay-as-you-go usage
cost from Anthropic, not a hosting cost, and it doesn't change anything else about the setup.

### The two web addresses that depend on each other

Both options below hit the same two-pass shape:

1. Deploy `backend` first. It's fine that nothing has told it the frontend's address yet, nothing
   is calling it yet either.
2. Build and deploy `frontend`, telling it the backend's now-known web address.
3. Go back and update `backend` with the frontend's now-known web address (a quick config update,
   no rebuilding).

Each option's steps below are numbered to match this exactly.

---

## Option A: Google Cloud (GCP) — Cloud Run + Neon

**What gets created:** a free Postgres database on Neon, a container image registry (Artifact
Registry), and three running services on Cloud Run (`backend`, `python-service`, `frontend`).
Cloud Run's standing free tier (2,000,000 requests and ~180,000 vCPU-seconds a month) comfortably
covers demo/personal traffic, so this whole path is $0/month.

### Step 0: Create a Google Cloud account and install its CLI

**Where: Browser**, then **Terminal**.

1. Go to [cloud.google.com](https://cloud.google.com/) and sign up (a credit card is required for
   identity verification, but you will not be charged as long as usage stays inside the free
   tier this guide uses).
2. Create a project (or use one Google creates for you by default), then note its **Project ID**
   (shown on the Cloud Console dashboard, not the same as the project *name*).
3. Install the Google Cloud CLI: [cloud.google.com/sdk/docs/install](https://cloud.google.com/sdk/docs/install).
4. Back in your terminal, log in and select your project:
   ```bash
   gcloud auth login
   gcloud config set project <project-id>
   gcloud config get-value project
   # should print back <project-id>, confirming it's selected
   ```
5. Turn on billing for the project (required by Google even for free-tier usage): in the Cloud
   Console, go to **Billing** in the left sidebar and link a billing account to this project.
6. Turn on the four Google APIs this guide uses:
   ```bash
   gcloud services enable run.googleapis.com artifactregistry.googleapis.com secretmanager.googleapis.com
   ```

Every command below uses the region `us-central1` and the project ID you noted in step 2; swap in
your own region consistently if you'd rather use a different one, just keep it the same in every
command.

### Step 1: Create your free Postgres database (Neon)

**Where: Browser.**

Go to [console.neon.tech](https://console.neon.tech), sign up (no credit card needed), and click
**New Project**. Pick a region close to `us-central1`. Neon defaults new projects to PostgreSQL
18, if you'd rather match this repo's local Postgres 16 exactly, pick **16** from the version
dropdown on this same screen, `pgvector` works identically either way. Once it's created, copy
the **connection string** it shows you, it looks like:
```
postgresql://<user>:<password>@<endpoint>.neon.tech/<dbname>?sslmode=require
```
Save this somewhere; it's your `POSTGRES_URL` and you'll paste it into a command in Step 3. No
extra setup needed here, the app itself creates the `pgvector` extension and its tables the first
time it connects.

### Step 2: Build and push the container images

**Where: Terminal, in the `ai-nexus` folder.**

```bash
gcloud artifacts repositories create ai-nexus --repository-format=docker --location=us-central1
gcloud auth configure-docker us-central1-docker.pkg.dev

docker build -f backend/Dockerfile -t us-central1-docker.pkg.dev/<project-id>/ai-nexus/backend:latest .
docker build -f python-service/Dockerfile -t us-central1-docker.pkg.dev/<project-id>/ai-nexus/python-service:latest python-service
docker push us-central1-docker.pkg.dev/<project-id>/ai-nexus/backend:latest
docker push us-central1-docker.pkg.dev/<project-id>/ai-nexus/python-service:latest
```
Replace every `<project-id>` with the Project ID you noted in Step 0. Note the backend build's
last argument is `.` (the repo root), not `backend`, because it needs the sibling `mcp-server/`
folder alongside it.

### Step 3: Store your database connection string as a secret

**Where: Terminal.**

```bash
echo -n "postgresql://<user>:<password>@<endpoint>.neon.tech/<dbname>?sslmode=require" | gcloud secrets create postgres-url --data-file=-
```
Paste in the real connection string you copied in Step 1. There's no `ANTHROPIC_API_KEY` secret
in this guide, leaving it unset is what keeps the LLM call in free mock mode (see above); add one
later the same way, `echo -n "sk-ant-..." | gcloud secrets create anthropic-api-key --data-file=-`,
if you want real Claude responses.

### Step 4: Deploy the backend and python-service

**Where: Terminal.**

```bash
gcloud run deploy python-service \
  --image us-central1-docker.pkg.dev/<project-id>/ai-nexus/python-service:latest \
  --region us-central1 --no-allow-unauthenticated --ingress internal \
  --port 8001

gcloud run deploy backend \
  --image us-central1-docker.pkg.dev/<project-id>/ai-nexus/backend:latest \
  --region us-central1 --allow-unauthenticated --port 4000 \
  --set-env-vars PORT=4000,PYTHON_EMBEDDING_SERVICE_URL=<python-service-url-printed-above> \
  --set-secrets POSTGRES_URL=postgres-url:latest
```
The first command prints `python-service`'s URL when it finishes; use that exact URL in place of
`<python-service-url-printed-above>` in the second command (or fetch it again any time with
`gcloud run services describe python-service --region us-central1 --format 'value(status.url)'`).

`backend` also needs permission to call `python-service` (Cloud Run requires this even for two
services in the same project):
```bash
gcloud run services add-iam-policy-binding python-service \
  --region us-central1 \
  --member="serviceAccount:$(gcloud projects describe <project-id> --format='value(projectNumber)')-compute@developer.gserviceaccount.com" \
  --role="roles/run.invoker"
```

Note the **backend's own URL**, printed by the `gcloud run deploy backend` command (or fetch it
again with `gcloud run services describe backend --region us-central1 --format
'value(status.url)'`), you need it in the next step.

### Step 5: Build and deploy the frontend

**Where: Terminal.**

```bash
docker build -f frontend/Dockerfile \
  --build-arg NEXT_PUBLIC_API_BASE_URL=<backend-url-from-step-4> \
  -t us-central1-docker.pkg.dev/<project-id>/ai-nexus/frontend:latest frontend
docker push us-central1-docker.pkg.dev/<project-id>/ai-nexus/frontend:latest

gcloud run deploy frontend \
  --image us-central1-docker.pkg.dev/<project-id>/ai-nexus/frontend:latest \
  --region us-central1 --allow-unauthenticated --port 3000
```
Replace `<backend-url-from-step-4>` with the real URL you noted at the end of Step 4, e.g.
`https://backend-abcd1234-uc.a.run.app`.

### Step 6: Point the backend at the now-deployed frontend

**Where: Terminal.**

```bash
gcloud run services update backend \
  --region us-central1 \
  --update-env-vars FRONTEND_URL=$(gcloud run services describe frontend --region us-central1 --format 'value(status.url)')
```
This is a config-only update, no image rebuild, it takes effect within a few seconds. Use
`--update-env-vars` here (not `--set-env-vars`), which only adds/changes the one variable named,
so it doesn't wipe out `PORT`/`PYTHON_EMBEDDING_SERVICE_URL` from Step 4.

### Step 7: Confirm it's actually working

**Where: Terminal**, then **Browser**.

```bash
gcloud run services logs read backend --region us-central1 --limit 50
```
Look for a log line confirming it connected to Postgres and finished loading its knowledge base
(the same lines you'd see locally right after `npm run dev` starts). Then open the frontend's URL
(`gcloud run services describe frontend --region us-central1 --format 'value(status.url)'`) in
your browser and try it. That URL is the link you share.

---

## Option B: Microsoft Azure — Container Apps + Neon

**What gets created:** a free Postgres database on Neon, a container image registry (Azure
Container Registry), and three running services on Azure Container Apps (`backend`,
`python-service`, `frontend`). Container Apps' standing free monthly grant (180,000 vCPU-seconds,
360,000 GiB-seconds, 2,000,000 requests) comfortably covers demo/personal traffic, so this whole
path is $0/month, aside from a small flat Container Registry fee (~$5/month for the cheapest
tier).

### Step 0: Create an Azure account and install its CLI

**Where: Browser**, then **Terminal**.

1. Go to [azure.microsoft.com/free](https://azure.microsoft.com/free/) and sign up.
2. Install the Azure CLI: [learn.microsoft.com/cli/azure/install-azure-cli](https://learn.microsoft.com/en-us/cli/azure/install-azure-cli).
3. Back in your terminal, log in and create the resource group everything below lives in:
   ```bash
   az login
   az account set --subscription "<your-subscription-name-or-id>"
   az group create --name ai-nexus-rg --location eastus
   ```

Every command below uses the resource group `ai-nexus-rg` in region `eastus`; swap in your own
names/[region](https://azure.microsoft.com/en-us/explore/global-infrastructure/geographies/)
consistently if you'd rather use different ones, just keep it the same in every command.

### Step 1: Create your free Postgres database (Neon)

**Where: Browser.**

Go to [console.neon.tech](https://console.neon.tech), sign up (no credit card needed), and click
**New Project**. Pick a region close to `eastus`. Neon defaults new projects to PostgreSQL 18, if
you'd rather match this repo's local Postgres 16 exactly, pick **16** from the version dropdown on
this same screen, `pgvector` works identically either way. Once it's created, copy the
**connection string** it shows you, it looks like:
```
postgresql://<user>:<password>@<endpoint>.neon.tech/<dbname>?sslmode=require
```
Save this somewhere; it's your `POSTGRES_URL` and you'll paste it into a command in Step 3.

### Step 2: Build and push the container images

**Where: Terminal, in the `ai-nexus` folder.**

```bash
az acr create --name ainexusacr --resource-group ai-nexus-rg --sku Basic
az acr login --name ainexusacr

docker build -f backend/Dockerfile -t ainexusacr.azurecr.io/ai-nexus-backend:latest .
docker build -f python-service/Dockerfile -t ainexusacr.azurecr.io/ai-nexus-python-service:latest python-service
docker push ainexusacr.azurecr.io/ai-nexus-backend:latest
docker push ainexusacr.azurecr.io/ai-nexus-python-service:latest
```
Registry names must be globally unique and alphanumeric only (no hyphens). If `ainexusacr` is
already taken, append your own suffix, e.g. `ainexusacr7412`, and use that exact name in every
command below, including the ones in later steps. Note the backend build's last argument is `.`
(the repo root), not `backend`, because it needs the sibling `mcp-server/` folder alongside it.

### Step 3: Store your database connection string as a secret

**Where: Terminal.**

```bash
az keyvault create --name ai-nexus-kv --resource-group ai-nexus-rg
az keyvault secret set --vault-name ai-nexus-kv --name postgres-url --value "postgresql://<user>:<password>@<endpoint>.neon.tech/<dbname>?sslmode=require"
```
Paste in the real connection string you copied in Step 1. There's no `anthropic-api-key` secret
in this guide, leaving it unset is what keeps the LLM call in free mock mode (see above); add one
later the same way if you want real Claude responses.

### Step 4: Deploy the backend and python-service

**Where: Terminal.**

```bash
az containerapp env create --name ai-nexus-env --resource-group ai-nexus-rg --location eastus

# Internal-only, no public web address
az containerapp create \
  --name python-service --resource-group ai-nexus-rg --environment ai-nexus-env \
  --image ainexusacr.azurecr.io/ai-nexus-python-service:latest \
  --ingress internal --target-port 8001

# Public: this is what the frontend and any API client will call
az containerapp create \
  --name backend --resource-group ai-nexus-rg --environment ai-nexus-env \
  --image ainexusacr.azurecr.io/ai-nexus-backend:latest \
  --ingress external --target-port 4000 \
  --env-vars PORT=4000 PYTHON_EMBEDDING_SERVICE_URL=http://python-service \
  --secrets postgres-url=keyvaultref:https://ai-nexus-kv.vault.azure.net/secrets/postgres-url,identityref:system \
  --secret-env-vars POSTGRES_URL=postgres-url
```

The backend container needs permission to actually read that secret from the vault, grant it now
or the container will fail to start:
```bash
az containerapp identity assign --name backend --resource-group ai-nexus-rg --system-assigned
az keyvault set-policy --name ai-nexus-kv \
  --object-id $(az containerapp identity show --name backend --resource-group ai-nexus-rg --query principalId -o tsv) \
  --secret-permissions get
```

Note the backend's web address, Azure generates it automatically:
```bash
az containerapp show --name backend --resource-group ai-nexus-rg --query properties.configuration.ingress.fqdn -o tsv
# e.g. backend.whitemoss-a1b2c3d4.eastus.azurecontainerapps.io
```
You need this exact address (with `https://` in front of it) in the next step.

### Step 5: Build and deploy the frontend

**Where: Terminal.**

```bash
docker build -f frontend/Dockerfile \
  --build-arg NEXT_PUBLIC_API_BASE_URL=https://<backend-address-from-step-4> \
  -t ainexusacr.azurecr.io/ai-nexus-frontend:latest frontend
docker push ainexusacr.azurecr.io/ai-nexus-frontend:latest

az containerapp create \
  --name frontend --resource-group ai-nexus-rg --environment ai-nexus-env \
  --image ainexusacr.azurecr.io/ai-nexus-frontend:latest \
  --ingress external --target-port 3000
```
Replace `<backend-address-from-step-4>` with the real address you noted at the end of Step 4.

### Step 6: Point the backend at the now-deployed frontend

**Where: Terminal.**

```bash
az containerapp show --name frontend --resource-group ai-nexus-rg --query properties.configuration.ingress.fqdn -o tsv
# note this frontend address

az containerapp update \
  --name backend --resource-group ai-nexus-rg \
  --set-env-vars FRONTEND_URL=https://<frontend-address-just-noted>
```
This is a config-only update, no image rebuild, and Container Apps' `--set-env-vars` on `update`
only adds/overwrites the one variable named here, so it won't wipe out the env vars set in Step 4.

### Step 7: Confirm it's actually working

**Where: Terminal**, then **Browser**.

```bash
az containerapp logs show --name backend --resource-group ai-nexus-rg --follow
```
Look for a log line confirming it connected to Postgres and finished loading its knowledge base
(the same lines you'd see locally right after `npm run dev` starts). Then open the frontend's
address from Step 6 in your browser and try it. That URL is the link you share.

---

## Good to know

- **`python-service` and `postgres` are never given a public web address**, on purpose, only
  `backend` and `frontend` are reachable from outside.
- **Never put `ANTHROPIC_API_KEY` directly in a Dockerfile or commit it to git.** Both options
  above only ever load it from a secrets manager (Secret Manager / Key Vault) at runtime, if you
  choose to add it at all.
- **`mcp-server` is never deployed as its own separate step.** It's already compiled into the
  backend's image and started automatically alongside it (`backend/src/agent/mcpClient.ts` spawns
  it as a background process). There's nothing extra to set up for it.
- **First request after idle time will be a bit slow.** Both Cloud Run and Container Apps can
  scale down to zero running instances when nobody's using the app, and Neon's free database does
  the same. That's what keeps this free, but it means the very first request after a period of no
  traffic takes a few extra seconds while everything wakes back up. Every request after that is
  fast again.
- **Free-tier limits can change.** The numbers referenced above (Cloud Run's/Container Apps'
  standing free grants, Neon's free storage/compute) are current as of this writing; check each
  provider's own pricing page if you're relying on this long after reading it.
- **If something doesn't come up correctly**, the single most useful thing to check first is the
  `backend` logs command from each option's Step 7, it tells you immediately whether the problem
  is "can't reach Postgres" versus something else.
