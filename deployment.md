# Deployment Guide AWS, Azure, GCP

This app is already fully containerized (see `docker-compose.yml` and the `Dockerfile` in each
service), so deploying to any major cloud is the same basic shape everywhere: push four container
images to a registry, run them on a managed container platform and point them at a Postgres
instance with the `pgvector` extension enabled. This guide covers all three major clouds using
each one's simplest "serverless containers" service no Kubernetes cluster to operate.

Azure and GCP each get two full, self-contained paths below: a **Paid** path (that cloud's own
managed Postgres) and a **Free** path (a $0/month third-party Postgres instead). AWS is paid-only
 Fargate has no standing free compute tier, so there's no free variant to offer there (see
section 3).

If you specifically want a Kubernetes-based deployment (EKS/AKS/GKE) instead, see
[section 6](#6-if-you-specifically-need-kubernetes-eksaksgke) at the end.

---

## 1. What you're deploying

Four pieces, mirroring `docker-compose.yml`:

| Service | Image | Exposure | Depends on |
|---|---|---|---|
| `frontend` | `frontend/Dockerfile` (Next.js) | **Public** this is what users open in a browser | `backend` (via `NEXT_PUBLIC_API_BASE_URL`, baked in at build time) |
| `backend` | `backend/Dockerfile` (Express API; bundles the compiled `mcp-server/` and spawns it as a stdio child process **no separate deployment needed for MCP**) | **Public** the frontend and any API client call this over HTTPS | `python-service`, `postgres`, Anthropic API (outbound) |
| `python-service` | `python-service/Dockerfile` (FastAPI embeddings, summarization, tokenization/cost, semantic caching, evaluation; stdlib-only, no downloaded models) | **Internal only** only `backend` needs to reach it | nothing |
| `postgres` | managed Postgres + `pgvector` (not self-hosted in prod) | **Internal only** only `backend` needs to reach it | nothing |

Because `NEXT_PUBLIC_API_BASE_URL` is compiled into the frontend's static JS at build time (Next.js
`NEXT_PUBLIC_*` convention), you must know the backend's public URL *before* building the frontend
image. Deploy the backend first, then build the frontend pointing at that URL.

### Environment variables needed in production

| Variable | Set on | Value |
|---|---|---|
| `ANTHROPIC_API_KEY` | backend | Real key, from a secrets manager never bake into an image. **Omit entirely on the Free paths** to keep the LLM call in mock mode (see below) |
| `ANTHROPIC_MODEL` | backend | e.g. `claude-sonnet-5` |
| `PORT` | backend | `4000` (or whatever the platform expects) |
| `PYTHON_EMBEDDING_SERVICE_URL` | backend | `python-service`'s **internal** URL (e.g. `http://python-service.internal:8001`) |
| `POSTGRES_URL` | backend | `postgresql://user:pass@<managed-postgres-host>:5432/nexus_vectors` (Paid paths) or a Neon connection string (Free paths) |
| `MCP_SERVER_ENTRY` | backend | `/app/mcp-server/dist/index.js` (already the default baked into the backend image see `backend/Dockerfile`) |
| `FRONTEND_URL` | backend | frontend's public HTTPS URL **set this *after* deploying the frontend** (see the circular-dependency note below) |
| `EMBEDDING_SERVICE_PORT` | python-service | `8001` |
| `NEXT_PUBLIC_API_BASE_URL` | frontend (**build-time**) | backend's public HTTPS URL |

None of these need code changes to deploy they're all already read from `process.env` /
`os.environ` (see `backend/src/config.ts`, `python-service/app/main.py`,
`frontend/lib/api.ts`).

### The backend ↔ frontend URL is circular deploy in two passes

`NEXT_PUBLIC_API_BASE_URL` (frontend) and `FRONTEND_URL` (backend) each need to know the *other*
service's public URL, but neither URL exists until that service is deployed. Break the cycle like
this:

1. Deploy `backend` first with `FRONTEND_URL` left at its local default (or omitted) it'll
   reject browser calls from the not-yet-deployed frontend, which is fine, nothing is calling it
   yet.
2. Build and deploy `frontend` with `NEXT_PUBLIC_API_BASE_URL` set to the backend's now-known
   public URL (this is already required see each path's "Frontend" step below).
3. Update `backend`'s `FRONTEND_URL` to the frontend's now-known public URL and redeploy/restart
   just the backend service (a config-only redeploy, no rebuild needed). Each path below has the
   one-line command for this as its last step.

`FRONTEND_URL` accepts a comma-separated list, so you can include a staging URL alongside
production without another deploy.

### About the Free ($0/month) paths

For demo/portfolio traffic (not sustained production load), compute and database both have
genuine **standing** free tiers not 12-month trials on Azure and GCP. Numbers quoted in each
section are current as of this writing; check each provider's pricing page before relying on them
long-term.

- **Database the actual blocker to a $0 deployment.** RDS, Cloud SQL and Azure Database for
  PostgreSQL are all paid-only; none has a permanent free managed-Postgres tier. Every Free path
  below swaps that step for **[Neon](https://neon.tech)**, a serverless Postgres provider with
  `pgvector` support and a real free tier (0.5GB storage, 100 compute-hours/month, scale-to-zero
  after 5 minutes idle compute suspends and **auto-resumes transparently on the next query**, no
  manual action needed). The app only needs a connection string, so this is a drop-in swap for
  `POSTGRES_URL` no code change. ([Supabase](https://supabase.com) is a comparable free option,
  but its free projects **pause after 7 days of inactivity and require a manual click to resume**
  a bad fit for an unattended demo link someone might not open for a week. Neon's auto-resume
  doesn't have that failure mode, so it's the better default here.)
- **LLM:** every Free path below leaves `ANTHROPIC_API_KEY` unset entirely. The deployed app runs
  in mock mode routing, retrieval, prompt templates and tool-calling are all still real; only
  the final model call is canned and labeled `[MOCK MODE]` so hosting stays $0 with nothing
  metered. Add the key later, the same way the Paid paths do, if you want occasional live Claude
  responses; that's a usage cost, not a hosting cost and doesn't change anything else.
- **Compute:** each of Azure/GCP's Free-path sections below quotes that platform's specific
  standing free grant.
- **The honest limit:** free tiers are usage caps, not guarantees. Neon's free compute
  autosuspending after 5 minutes idle means the first request after a long gap has a short
  (usually sub-second) wake-up delay stacking on top of Cloud Run's/Container Apps' own cold
  start fine for a demo link opened occasionally, not something to build sustained traffic on.
  If this ever needs to handle real, sustained traffic, switch to the Paid path in that section 
  nothing else about the deployment shape changes.

### Cost at a glance

Rough monthly estimates for continuous (24/7) operation at low/demo traffic. These are **ballpark
figures from published list pricing, not quotes** actual cost depends on region, exact instance
sizing and traffic and provider pricing changes over time. See each section below for the
line-item breakdown behind these totals; use each provider's official pricing calculator before
budgeting for real.

| Path | ~Total/month | Why |
|---|---|---|
| AWS (Paid only option) | **~$90–100** | Fargate, the ALB and RDS are all provisioned resources billed continuously nothing on AWS scales to zero or has a standing free tier here |
| Azure Paid | **~$20–35** | Dominated by Azure Database for PostgreSQL (billed 24/7); Container Apps compute is often ~$0 if traffic stays inside the standing free grant |
| Azure Free | **$0** | Neon + Container Apps' free grant + mock mode (section 4B) |
| GCP Paid | **~$12–25** | Dominated by Cloud SQL (billed 24/7); Cloud Run compute is often ~$0 if traffic stays inside the standing free grant |
| GCP Free | **$0** | Neon + Cloud Run's free tier + mock mode (section 5B) |

---

## 2. Why these platforms and what else was considered

**Why AWS, Azure and GCP and not a simpler PaaS (Railway, Render, Fly.io, Heroku, DigitalOcean
App Platform)?** Any of those would deploy this app's four containers with noticeably less
ceremony no IAM policies, no VPC networking to reason about, often a single config file. They
were left out on purpose: this guide is written to double as practice with the platforms real job
postings and real company infrastructure actually name, not just the fastest way to get a link
online. The trade-off is real, though a simpler PaaS is a genuinely better choice if the goal is
only "get this running publicly today," and nothing here stops you from pointing one at these same
Dockerfiles; the shape (build an image per service, run it, point it at a Postgres with `pgvector`)
doesn't change.

**Why serverless containers (Fargate / Container Apps / Cloud Run) as the default, instead of raw
VMs or committing to Kubernetes from the start?** This is the actual default compute model at most
companies below a certain infrastructure-team size today, for a reason: it gives most of what
Kubernetes offers declarative deploys, no manually patched servers, the platform restarting a
crashed container for you without a cluster to size, upgrade or operate. The trade-off against
Kubernetes is real too: less portability (each cloud's serverless-container API is shaped
differently, where a Kubernetes manifest is close to identical across all three) and no access to
advanced orchestration primitives like custom schedulers or a service mesh. Section 6 exists as an
explicit escape hatch for exactly the deployments that need those.

**Why is AWS included at all, given it's the most expensive option here with no free path?**
Fargate, RDS and the ALB together are genuinely the priciest of the three for a low-traffic demo
(see the cost table above) and AWS has no standing free compute tier the way Azure and GCP do 
but ECS/Fargate/RDS experience shows up disproportionately often in job postings relative to its
Azure/GCP equivalents, so it earns its place here for the learning value even though it's the worst
fit for a $0 portfolio deployment. Azure and GCP get the Free-path treatment specifically because
their serverless compute has a standing (not trial) free grant and because Postgres is the one
AWS-side cost with no free managed equivalent RDS has never offered a perpetual free tier the way
Container Apps and Cloud Run do for compute.

**Why an external Postgres provider (Neon) for the Free paths, instead of just running Postgres in
a container on the same platform?** None of Fargate, Container Apps or Cloud Run are built to run
a stateful, always-on process they're all designed around disposable, stateless containers that
scale to zero, which is exactly wrong for a database that needs a persistent volume and must never
restart mid-write. Running Postgres in a plain container on any of them would appear to work right
up until the next scale-to-zero cycle silently lost data. A real database on these platforms
therefore needs either that cloud's managed Postgres (the Paid path) or an external, always-on
Postgres provider reached over the network (the Free path's Neon) see "About the Free paths" in
section 1 for why Neon specifically, over Supabase or a self-hosted alternative.

---

## 3. AWS ECS Fargate + RDS for PostgreSQL + ECR

*Paid only AWS Fargate has no standing free compute tier, so there's no $0/month variant here.
See the Free paths in sections 3 and 4 instead.*

**Services used:** Elastic Container Registry (images), ECS Fargate (compute, no servers to
manage), RDS for PostgreSQL (database), Secrets Manager (API key), Application Load Balancer
(public HTTPS).

#### Step 1: Push images to ECR
```bash
aws ecr create-repository --repository-name ai-nexus/backend
aws ecr create-repository --repository-name ai-nexus/frontend
aws ecr create-repository --repository-name ai-nexus/python-service

aws ecr get-login-password --region <region> | docker login --username AWS --password-stdin <account-id>.dkr.ecr.<region>.amazonaws.com

# Backend build context is the repo root (it needs the sibling mcp-server/ folder)
docker build -f backend/Dockerfile -t <account-id>.dkr.ecr.<region>.amazonaws.com/ai-nexus/backend:latest .
docker build -f python-service/Dockerfile -t <account-id>.dkr.ecr.<region>.amazonaws.com/ai-nexus/python-service:latest python-service
# Build frontend AFTER you know the backend's public URL see Step 4
docker push <account-id>.dkr.ecr.<region>.amazonaws.com/ai-nexus/backend:latest
docker push <account-id>.dkr.ecr.<region>.amazonaws.com/ai-nexus/python-service:latest
```

#### Step 2: RDS for PostgreSQL with pgvector
```bash
aws rds create-db-instance \
  --db-instance-identifier ai-nexus-postgres \
  --engine postgres \
  --engine-version 16.4 \
  --db-instance-class db.t4g.micro \
  --allocated-storage 20 \
  --master-username nexus \
  --master-user-password <choose-a-strong-password> \
  --db-name nexus_vectors \
  --publicly-accessible false \
  --vpc-security-group-ids <sg-id>
```
`pgvector` ships with RDS for PostgreSQL 15.2+/14.7+ no extra install needed, just enable it once
connected:
```sql
CREATE EXTENSION IF NOT EXISTS vector;
```
(The app's own `vectorStore.ts` already runs this `CREATE EXTENSION IF NOT EXISTS` on startup, so
this manual step is optional it happens automatically the first time the backend connects.)

#### Step 3: Secrets
```bash
aws secretsmanager create-secret --name ai-nexus/anthropic-api-key --secret-string "sk-ant-..."
aws secretsmanager create-secret --name ai-nexus/postgres-url --secret-string "postgresql://nexus:<password>@<rds-endpoint>:5432/nexus_vectors"
```

#### Step 4: ECS Fargate cluster, task definitions, services
```bash
aws ecs create-cluster --cluster-name ai-nexus-cluster
```
Create a task definition per service (JSON, abbreviated repeat for `python-service`):
```json
{
  "family": "ai-nexus-backend",
  "requiresCompatibilities": ["FARGATE"],
  "networkMode": "awsvpc",
  "cpu": "512",
  "memory": "1024",
  "containerDefinitions": [{
    "name": "backend",
    "image": "<account-id>.dkr.ecr.<region>.amazonaws.com/ai-nexus/backend:latest",
    "portMappings": [{ "containerPort": 4000 }],
    "environment": [
      { "name": "PORT", "value": "4000" },
      { "name": "PYTHON_EMBEDDING_SERVICE_URL", "value": "http://python-service.ai-nexus.local:8001" }
    ],
    "secrets": [
      { "name": "ANTHROPIC_API_KEY", "valueFrom": "arn:aws:secretsmanager:...:ai-nexus/anthropic-api-key" },
      { "name": "POSTGRES_URL", "valueFrom": "arn:aws:secretsmanager:...:ai-nexus/postgres-url" }
    ]
  }]
}
```
```bash
aws ecs register-task-definition --cli-input-json file://backend-task.json
```
Run `python-service` as an internal ECS service using **Service Connect** (gives it the
`python-service.ai-nexus.local` DNS name used above) with no public load balancer. Run `backend`
as a service **behind an Application Load Balancer** (public, HTTPS via an ACM certificate).

#### Step 5: Frontend
Once the ALB gives you the backend's public URL (e.g. `https://api.yourdomain.com`), build and
push the frontend with that baked in, then run it as its own Fargate service behind its own ALB
(or the same ALB with path-based routing):
```bash
docker build -f frontend/Dockerfile \
  --build-arg NEXT_PUBLIC_API_BASE_URL=https://api.yourdomain.com \
  -t <account-id>.dkr.ecr.<region>.amazonaws.com/ai-nexus/frontend:latest frontend
```
(Add `ARG NEXT_PUBLIC_API_BASE_URL` / `ENV NEXT_PUBLIC_API_BASE_URL=$NEXT_PUBLIC_API_BASE_URL`
near the top of `frontend/Dockerfile`'s build stage if you want this as a build arg rather than
editing `.env` before building Next.js inlines `NEXT_PUBLIC_*` vars at build time either way.)

#### Step 6: Point the backend's CORS policy at the deployed frontend
Add `FRONTEND_URL` to the task definition's `environment` array from Step 4 (alongside `PORT`
and `PYTHON_EMBEDDING_SERVICE_URL`):
```json
{ "name": "FRONTEND_URL", "value": "https://app.yourdomain.com" }
```
Task definitions are immutable, so register the edited JSON as a new revision and point the
service at it this is a config-only redeploy, no image rebuild needed:
```bash
aws ecs register-task-definition --cli-input-json file://backend-task.json
aws ecs update-service --cluster ai-nexus-cluster --service ai-nexus-backend \
  --task-definition ai-nexus-backend --force-new-deployment
```

**Simpler alternative:** for a demo/low-traffic deployment, **AWS App Runner** does Steps 1–6
with far less configuration point it at an ECR image, give it env vars/secrets and it handles
the load balancer, HTTPS and scaling itself. Worth using instead of ECS+ALB unless you need ECS's
finer-grained control.

#### Estimated monthly cost (us-east-1 list pricing, 24/7 operation)

AWS has no standing free tier for any of these, so every line item below applies from day one 
this is why AWS is the most expensive of the three clouds in this guide for a low-traffic demo.

| Item | Estimate | Notes |
|---|---|---|
| ECS Fargate (3 services × 0.5 vCPU/1GB, always-on) | ~$54/mo | `$0.04048`/vCPU-hr + `$0.004445`/GB-hr, no scale-to-zero on Fargate |
| Application Load Balancer | ~$20/mo | Base hourly rate + a small amount of LCU usage; assumes one shared ALB with path-based routing rather than one per service |
| RDS `db.t4g.micro` + 20GB storage | ~$14/mo | Compute + gp2 storage |
| ECR image storage | <$1/mo | A few GB of images |
| Secrets Manager (2 secrets) | ~$1/mo | $0.40/secret/month |
| **Total** | **~$90/mo** | Rough get an exact number from the [AWS Pricing Calculator](https://calculator.aws) for your region/sizing |

---

## 4. Azure Container Apps + ACR

### 4A. Paid path: Container Apps + Azure Database for PostgreSQL

**Services used:** Azure Container Registry (images), Azure Container Apps (compute built-in
HTTPS, internal/external ingress and scale-to-zero), Azure Database for PostgreSQL Flexible
Server (database), Key Vault (API key).

#### Step 1: Push images to ACR
```bash
az acr create --name ainexusacr --resource-group ai-nexus-rg --sku Basic
az acr login --name ainexusacr

docker build -f backend/Dockerfile -t ainexusacr.azurecr.io/ai-nexus-backend:latest .
docker build -f python-service/Dockerfile -t ainexusacr.azurecr.io/ai-nexus-python-service:latest python-service
docker push ainexusacr.azurecr.io/ai-nexus-backend:latest
docker push ainexusacr.azurecr.io/ai-nexus-python-service:latest
```
(ACR registry names must be globally unique and alphanumeric-only no hyphens hence
`ainexusacr` rather than `ai-nexus-acr`.)

#### Step 2: Azure Database for PostgreSQL Flexible Server with pgvector
```bash
az postgres flexible-server create \
  --resource-group ai-nexus-rg \
  --name ai-nexus-postgres \
  --admin-user nexus \
  --admin-password <choose-a-strong-password> \
  --database-name nexus_vectors \
  --tier Burstable --sku-name Standard_B1ms \
  --public-access None
```
Enable the extension (Azure requires allow-listing it first, then creating it):
```bash
az postgres flexible-server parameter set \
  --resource-group ai-nexus-rg --server-name ai-nexus-postgres \
  --name azure.extensions --value vector
```
```sql
CREATE EXTENSION IF NOT EXISTS vector;  -- runs automatically on backend startup too
```

#### Step 3: Secrets
```bash
az keyvault create --name ai-nexus-kv --resource-group ai-nexus-rg
az keyvault secret set --vault-name ai-nexus-kv --name anthropic-api-key --value "sk-ant-..."
az keyvault secret set --vault-name ai-nexus-kv --name postgres-url --value "postgresql://nexus:<password>@ai-nexus-postgres.postgres.database.azure.com:5432/nexus_vectors"
```

#### Step 4: Container Apps environment + services
```bash
az containerapp env create --name ai-nexus-env --resource-group ai-nexus-rg --location eastus

# Internal-only no public ingress
az containerapp create \
  --name python-service --resource-group ai-nexus-rg --environment ai-nexus-env \
  --image ainexusacr.azurecr.io/ai-nexus-python-service:latest \
  --ingress internal --target-port 8001

# Public this is the API clients/frontend hit
az containerapp create \
  --name backend --resource-group ai-nexus-rg --environment ai-nexus-env \
  --image ainexusacr.azurecr.io/ai-nexus-backend:latest \
  --ingress external --target-port 4000 \
  --env-vars PORT=4000 PYTHON_EMBEDDING_SERVICE_URL=http://python-service \
  --secrets anthropic-api-key=keyvaultref:https://ai-nexus-kv.vault.azure.net/secrets/anthropic-api-key,identityref:system \
            postgres-url=keyvaultref:https://ai-nexus-kv.vault.azure.net/secrets/postgres-url,identityref:system \
  --secret-env-vars ANTHROPIC_API_KEY=anthropic-api-key POSTGRES_URL=postgres-url
```
Container Apps gives `backend` an HTTPS URL automatically (e.g.
`https://backend.<random>.eastus.azurecontainerapps.io`) use that for the frontend build.

#### Step 5: Frontend
```bash
docker build -f frontend/Dockerfile \
  --build-arg NEXT_PUBLIC_API_BASE_URL=https://backend.<random>.eastus.azurecontainerapps.io \
  -t ainexusacr.azurecr.io/ai-nexus-frontend:latest frontend
docker push ainexusacr.azurecr.io/ai-nexus-frontend:latest

az containerapp create \
  --name frontend --resource-group ai-nexus-rg --environment ai-nexus-env \
  --image ainexusacr.azurecr.io/ai-nexus-frontend:latest \
  --ingress external --target-port 3000
```

#### Step 6: Point the backend's CORS policy at the deployed frontend
Unlike GCP's `--set-env-vars` note in section 5A's Step 6, Container Apps' `--set-env-vars` on
`update` only adds/overwrites the named variable(s) it doesn't clear the others set in Step 4,
so no extra flag needed:
```bash
az containerapp update \
  --name backend --resource-group ai-nexus-rg \
  --set-env-vars FRONTEND_URL=https://frontend.<random>.eastus.azurecontainerapps.io
```

#### Estimated monthly cost (list pricing, 24/7 operation)

Unlike AWS, Container Apps compute is consumption-based against a standing free grant (see
section 1), so it can land at ~$0/month if traffic stays inside 180,000 vCPU-seconds / 360,000
GiB-seconds / 2M requests. The Postgres instance is the one line item that's billed 24/7
regardless of traffic that's the dominant, unavoidable cost here.

| Item | Estimate | Notes |
|---|---|---|
| Azure Database for PostgreSQL Flexible Server (`Burstable B1ms`, 32GB) | ~$16/mo | ~$13/mo compute + ~$3/mo storage |
| Azure Container Registry (Basic) | ~$5/mo | Flat daily rate |
| Container Apps compute (backend + python-service + frontend) | $0–$10+/mo | $0 if usage stays inside the free grant; metered beyond it |
| Key Vault | <$1/mo | Per-operation pricing, negligible at this scale |
| **Total** | **~$20–35/mo** | Rough get an exact number from the [Azure Pricing Calculator](https://azure.microsoft.com/en-us/pricing/calculator/) for your region/sizing |

---

### 4B. Free path ($0/month): Container Apps + Neon

**Services used:** Azure Container Registry (images), Azure Container Apps (compute a standing
free monthly grant of 180,000 vCPU-seconds / 360,000 GiB-seconds / 2,000,000 requests, not a
12-month trial), [Neon](https://neon.tech) (free serverless Postgres with `pgvector` see "About
the Free paths" in section 1 for why Neon over Supabase/Azure Database here).

#### Step 1: Provision Neon
No CLI needed: [console.neon.tech](https://console.neon.tech) → sign up (no credit card) → New
Project → pick a region close to `eastus` (or wherever you'll deploy Container Apps). Copy the
connection string it gives you 
`postgresql://<user>:<password>@<endpoint>.neon.tech/<dbname>?sslmode=require` that's your
`POSTGRES_URL`. No manual `CREATE EXTENSION` step needed: the app's own `vectorStore.ts` already
runs `CREATE EXTENSION IF NOT EXISTS vector` on startup.

#### Step 2: Push images to ACR
```bash
az acr create --name ainexusacr --resource-group ai-nexus-rg --sku Basic
az acr login --name ainexusacr

docker build -f backend/Dockerfile -t ainexusacr.azurecr.io/ai-nexus-backend:latest .
docker build -f python-service/Dockerfile -t ainexusacr.azurecr.io/ai-nexus-python-service:latest python-service
docker push ainexusacr.azurecr.io/ai-nexus-backend:latest
docker push ainexusacr.azurecr.io/ai-nexus-python-service:latest
```
(ACR registry names must be globally unique and alphanumeric-only no hyphens hence
`ainexusacr` rather than `ai-nexus-acr`.)

#### Step 3: Secrets
Only `postgres-url` is needed no `anthropic-api-key` secret at all, since that omission is what
keeps the LLM call in mock mode:
```bash
az keyvault create --name ai-nexus-kv --resource-group ai-nexus-rg
az keyvault secret set --vault-name ai-nexus-kv --name postgres-url --value "postgresql://<user>:<password>@<endpoint>.neon.tech/<dbname>?sslmode=require"
```

#### Step 4: Container Apps environment + services
```bash
az containerapp env create --name ai-nexus-env --resource-group ai-nexus-rg --location eastus

# Internal-only no public ingress
az containerapp create \
  --name python-service --resource-group ai-nexus-rg --environment ai-nexus-env \
  --image ainexusacr.azurecr.io/ai-nexus-python-service:latest \
  --ingress internal --target-port 8001

# Public this is the API clients/frontend hit
az containerapp create \
  --name backend --resource-group ai-nexus-rg --environment ai-nexus-env \
  --image ainexusacr.azurecr.io/ai-nexus-backend:latest \
  --ingress external --target-port 4000 \
  --env-vars PORT=4000 PYTHON_EMBEDDING_SERVICE_URL=http://python-service \
  --secrets postgres-url=keyvaultref:https://ai-nexus-kv.vault.azure.net/secrets/postgres-url,identityref:system \
  --secret-env-vars POSTGRES_URL=postgres-url
```
Container Apps gives `backend` an HTTPS URL automatically (e.g.
`https://backend.<random>.eastus.azurecontainerapps.io`) use that for the frontend build.

#### Step 5: Frontend
```bash
docker build -f frontend/Dockerfile \
  --build-arg NEXT_PUBLIC_API_BASE_URL=https://backend.<random>.eastus.azurecontainerapps.io \
  -t ainexusacr.azurecr.io/ai-nexus-frontend:latest frontend
docker push ainexusacr.azurecr.io/ai-nexus-frontend:latest

az containerapp create \
  --name frontend --resource-group ai-nexus-rg --environment ai-nexus-env \
  --image ainexusacr.azurecr.io/ai-nexus-frontend:latest \
  --ingress external --target-port 3000
```

#### Step 6: Point the backend's CORS policy at the deployed frontend
```bash
az containerapp update \
  --name backend --resource-group ai-nexus-rg \
  --set-env-vars FRONTEND_URL=https://frontend.<random>.eastus.azurecontainerapps.io
```

---

## 5. GCP Cloud Run + Artifact Registry

### 5A. Paid path: Cloud Run + Cloud SQL for PostgreSQL

**Services used:** Artifact Registry (images), Cloud Run (compute scale-to-zero, built-in
HTTPS), Cloud SQL for PostgreSQL (database), Secret Manager (API key).

#### Step 1: Push images to Artifact Registry
```bash
gcloud artifacts repositories create ai-nexus --repository-format=docker --location=us-central1
gcloud auth configure-docker us-central1-docker.pkg.dev

docker build -f backend/Dockerfile -t us-central1-docker.pkg.dev/<project-id>/ai-nexus/backend:latest .
docker build -f python-service/Dockerfile -t us-central1-docker.pkg.dev/<project-id>/ai-nexus/python-service:latest python-service
docker push us-central1-docker.pkg.dev/<project-id>/ai-nexus/backend:latest
docker push us-central1-docker.pkg.dev/<project-id>/ai-nexus/python-service:latest
```

#### Step 2: Cloud SQL for PostgreSQL with pgvector
```bash
gcloud sql instances create ai-nexus-postgres \
  --database-version=POSTGRES_16 \
  --tier=db-f1-micro \
  --region=us-central1

gcloud sql databases create nexus_vectors --instance=ai-nexus-postgres
gcloud sql users set-password postgres --instance=ai-nexus-postgres --password=<choose-a-strong-password>
```
Cloud SQL for PostgreSQL 15+ supports `pgvector` directly:
```sql
CREATE EXTENSION IF NOT EXISTS vector;  -- runs automatically on backend startup too
```

#### Step 3: Secrets
```bash
echo -n "sk-ant-..." | gcloud secrets create anthropic-api-key --data-file=-
echo -n "postgresql://postgres:<password>@<cloud-sql-connection>/nexus_vectors" | gcloud secrets create postgres-url --data-file=-
```

#### Step 4: Deploy python-service (internal only) and backend (public)
```bash
gcloud run deploy python-service \
  --image us-central1-docker.pkg.dev/<project-id>/ai-nexus/python-service:latest \
  --region us-central1 --no-allow-unauthenticated --ingress internal \
  --port 8001

gcloud run deploy backend \
  --image us-central1-docker.pkg.dev/<project-id>/ai-nexus/backend:latest \
  --region us-central1 --allow-unauthenticated --port 4000 \
  --add-cloudsql-instances <project-id>:us-central1:ai-nexus-postgres \
  --set-env-vars PORT=4000,PYTHON_EMBEDDING_SERVICE_URL=<python-service-internal-url> \
  --set-secrets ANTHROPIC_API_KEY=anthropic-api-key:latest,POSTGRES_URL=postgres-url:latest
```
Cloud Run's inter-service calls need either the services to allow authenticated invocation with a
service-to-service identity token or a Serverless VPC Connector so `backend` can reach
`python-service` by internal address see
[Cloud Run service-to-service docs](https://cloud.google.com/run/docs/authenticating/service-to-service)
for the current recommended pattern.

#### Step 5: Frontend
```bash
docker build -f frontend/Dockerfile \
  --build-arg NEXT_PUBLIC_API_BASE_URL=$(gcloud run services describe backend --region us-central1 --format 'value(status.url)') \
  -t us-central1-docker.pkg.dev/<project-id>/ai-nexus/frontend:latest frontend
docker push us-central1-docker.pkg.dev/<project-id>/ai-nexus/frontend:latest

gcloud run deploy frontend \
  --image us-central1-docker.pkg.dev/<project-id>/ai-nexus/frontend:latest \
  --region us-central1 --allow-unauthenticated --port 3000
```

#### Step 6: Point the backend's CORS policy at the deployed frontend
Use `--update-env-vars` here, not `--set-env-vars` `--set-env-vars` replaces the *entire*
environment variable list, which would wipe out `PORT`/`PYTHON_EMBEDDING_SERVICE_URL` from Step 4.
`--update-env-vars` only touches the key(s) you name:
```bash
gcloud run services update backend \
  --region us-central1 \
  --update-env-vars FRONTEND_URL=$(gcloud run services describe frontend --region us-central1 --format 'value(status.url)')
```

#### Estimated monthly cost (list pricing, 24/7 operation)

Like Azure, Cloud Run compute is consumption-based against a standing free tier (see section 1),
so it can land at ~$0/month if traffic stays inside 2M requests / 180,000 vCPU-seconds / 360,000
GiB-seconds. Cloud SQL is the one line item that's billed 24/7 regardless of traffic that's the
dominant, unavoidable cost here and it's why GCP comes out cheapest of the three paid paths.

| Item | Estimate | Notes |
|---|---|---|
| Cloud SQL for PostgreSQL (`db-f1-micro`, 10GB SSD) | ~$12/mo | ~$10/mo compute + ~$2/mo storage |
| Artifact Registry image storage | <$1/mo | A few GB of images |
| Cloud Run compute (backend + python-service + frontend) | $0–$10+/mo | $0 if usage stays inside the free tier; metered beyond it |
| Secret Manager (2 secrets) | <$1/mo | ~$0.06/active secret version/month |
| **Total** | **~$12–25/mo** | Rough get an exact number from the [GCP Pricing Calculator](https://cloud.google.com/products/calculator) for your region/sizing |

---

### 5B. Free path ($0/month): Cloud Run + Neon

**Services used:** Artifact Registry (images), Cloud Run (compute a standing always-free tier of
2,000,000 requests, 180,000 vCPU-seconds and 360,000 GiB-seconds per month, not a 12-month
trial), [Neon](https://neon.tech) (free serverless Postgres with `pgvector` see "About the Free
paths" in section 1 for why Neon over Supabase/Cloud SQL here).

#### Step 1: Provision Neon
No CLI needed: [console.neon.tech](https://console.neon.tech) → sign up (no credit card) → New
Project → pick a region close to `us-central1` (or wherever you'll deploy Cloud Run). Copy the
connection string it gives you 
`postgresql://<user>:<password>@<endpoint>.neon.tech/<dbname>?sslmode=require` that's your
`POSTGRES_URL`. No manual `CREATE EXTENSION` step needed: the app's own `vectorStore.ts` already
runs `CREATE EXTENSION IF NOT EXISTS vector` on startup.

#### Step 2: Push images to Artifact Registry
```bash
gcloud artifacts repositories create ai-nexus --repository-format=docker --location=us-central1
gcloud auth configure-docker us-central1-docker.pkg.dev

docker build -f backend/Dockerfile -t us-central1-docker.pkg.dev/<project-id>/ai-nexus/backend:latest .
docker build -f python-service/Dockerfile -t us-central1-docker.pkg.dev/<project-id>/ai-nexus/python-service:latest python-service
docker push us-central1-docker.pkg.dev/<project-id>/ai-nexus/backend:latest
docker push us-central1-docker.pkg.dev/<project-id>/ai-nexus/python-service:latest
```

#### Step 3: Secrets
Only `postgres-url` is needed no `anthropic-api-key` secret at all, since that omission is what
keeps the LLM call in mock mode:
```bash
echo -n "postgresql://<user>:<password>@<endpoint>.neon.tech/<dbname>?sslmode=require" | gcloud secrets create postgres-url --data-file=-
```

#### Step 4: Deploy python-service (internal only) and backend (public)
```bash
gcloud run deploy python-service \
  --image us-central1-docker.pkg.dev/<project-id>/ai-nexus/python-service:latest \
  --region us-central1 --no-allow-unauthenticated --ingress internal \
  --port 8001

gcloud run deploy backend \
  --image us-central1-docker.pkg.dev/<project-id>/ai-nexus/backend:latest \
  --region us-central1 --allow-unauthenticated --port 4000 \
  --set-env-vars PORT=4000,PYTHON_EMBEDDING_SERVICE_URL=<python-service-internal-url> \
  --set-secrets POSTGRES_URL=postgres-url:latest
```
No `--add-cloudsql-instances` flag here that flag is Cloud SQL-specific and Neon is reached
over the public internet via TLS, so no VPC connector is needed for the database hop. The
`backend` → `python-service` hop still needs the same authenticated-invocation or Serverless VPC
Connector setup as the Paid path's Step 4 above.

#### Step 5: Frontend
```bash
docker build -f frontend/Dockerfile \
  --build-arg NEXT_PUBLIC_API_BASE_URL=$(gcloud run services describe backend --region us-central1 --format 'value(status.url)') \
  -t us-central1-docker.pkg.dev/<project-id>/ai-nexus/frontend:latest frontend
docker push us-central1-docker.pkg.dev/<project-id>/ai-nexus/frontend:latest

gcloud run deploy frontend \
  --image us-central1-docker.pkg.dev/<project-id>/ai-nexus/frontend:latest \
  --region us-central1 --allow-unauthenticated --port 3000
```

#### Step 6: Point the backend's CORS policy at the deployed frontend
Use `--update-env-vars` here, not `--set-env-vars`, for the same reason as the Paid path's Step 6:
```bash
gcloud run services update backend \
  --region us-central1 \
  --update-env-vars FRONTEND_URL=$(gcloud run services describe frontend --region us-central1 --format 'value(status.url)')
```

---

## 6. If you specifically need Kubernetes (EKS/AKS/GKE)

The same four images work unmodified on any Kubernetes cluster nothing here is
platform-specific. The shape is a `Deployment` + `Service` per container (`ClusterIP` for
`python-service`, `LoadBalancer`/`Ingress` for `backend` and `frontend`), a `Secret` for
`ANTHROPIC_API_KEY`/`POSTGRES_URL` and either a managed Postgres (RDS/Azure Database/Cloud SQL, as
above or Neon for a free option) or an in-cluster Postgres via the `pgvector/pgvector` image with
a `StatefulSet` + `PersistentVolumeClaim` (essentially `docker-compose.yml`'s `postgres` service
translated to a `StatefulSet`). This is real added operational overhead (cluster upgrades, node
management, more YAML) versus the serverless-container options above reach for it only if you
already run Kubernetes for other services and want this to live alongside them, not because it's
inherently "more production."

---

## 7. Notes that apply to all clouds and paths

- **`python-service` and `postgres` should never be publicly exposed.** Only `backend` and
  `frontend` need public HTTPS endpoints; the examples above set `python-service` to
  internal/unauthenticated-denied on purpose.
- **Never bake `ANTHROPIC_API_KEY` into an image or commit it.** Every Paid-path example pulls it
  from that cloud's secrets manager at runtime, the same way `.env` (gitignored) does locally; the
  Free paths omit it entirely on purpose (see section 1).
- **`mcp-server` is not deployed separately anywhere in this guide.** It's compiled into the
  backend image and spawned by `backend/src/agent/mcpClient.ts` as a stdio child process at
  runtime the same as it works locally. There's nothing extra to provision for it.
- **Cold starts:** Cloud Run and Azure Container Apps can scale to zero, which is cheap but means
  the first request after idle time is slower (container boot + Postgres connection + RAG
  knowledge-base check). Set a minimum instance count of 1 on `backend` if consistent latency
  matters more than idle cost. On the Free paths, Neon's own autosuspend/auto-resume (see section
  1) stacks with this, so the very first request after a long idle period is the slowest case.
- **Free-tier numbers are usage caps, not guarantees** and change over time re-check each
  provider's current pricing/limits page before relying on this for anything beyond a demo link.
- **This guide is CLI-first, not Infrastructure-as-Code.** For anything beyond a demo/personal
  deployment, translate these steps into Terraform, AWS CDK, Bicep or Pulumi so the environment is
  reproducible and reviewable the CLI commands above are meant to show the shape of what's
  needed, not to be the final production setup.
- **CI/CD:** a natural next step is a GitHub Actions workflow that runs `docker build`/`push` for
  each changed service on merge to `main`, then triggers the equivalent of the deploy commands
  above (`aws ecs update-service --force-new-deployment`, `az containerapp update` or
  `gcloud run deploy`/`gcloud run services update` again with the new image tag). Not included
  here since it's a meaningful separate piece of setup, but every command in this guide is
  scriptable as-is.