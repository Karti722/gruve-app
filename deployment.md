# Deployment Guide — AWS, Azure, GCP

This app is already fully containerized (see `docker-compose.yml` and the `Dockerfile` in each
service), so deploying to any major cloud is the same basic shape everywhere: push four container
images to a registry, run them on a managed container platform, and point them at a managed
Postgres instance with the `pgvector` extension enabled. This guide covers all three major clouds
using each one's simplest "serverless containers" service — no Kubernetes cluster to operate.

If you specifically want a Kubernetes-based deployment (EKS/AKS/GKE) instead, see
[section 5](#5-if-you-specifically-need-kubernetes-eksaksgke) at the end.

---

## 1. What you're deploying

Four pieces, mirroring `docker-compose.yml`:

| Service | Image | Exposure | Depends on |
|---|---|---|---|
| `frontend` | `frontend/Dockerfile` (Next.js) | **Public** — this is what users open in a browser | `backend` (via `NEXT_PUBLIC_API_BASE_URL`, baked in at build time) |
| `backend` | `backend/Dockerfile` (Express API; bundles the compiled `mcp-server/` and spawns it as a stdio child process — **no separate deployment needed for MCP**) | **Public** — the frontend and any API client call this over HTTPS | `python-service`, `postgres`, Anthropic API (outbound) |
| `python-service` | `python-service/Dockerfile` (FastAPI embeddings) | **Internal only** — only `backend` needs to reach it | nothing |
| `postgres` | managed Postgres + `pgvector` (not self-hosted in prod) | **Internal only** — only `backend` needs to reach it | nothing |

Because `NEXT_PUBLIC_API_BASE_URL` is compiled into the frontend's static JS at build time (Next.js
`NEXT_PUBLIC_*` convention), you must know the backend's public URL *before* building the frontend
image. Deploy the backend first, then build the frontend pointing at that URL.

### Environment variables needed in production

| Variable | Set on | Value |
|---|---|---|
| `ANTHROPIC_API_KEY` | backend | Real key, from a secrets manager — never bake into an image |
| `ANTHROPIC_MODEL` | backend | e.g. `claude-sonnet-5` |
| `PORT` | backend | `4000` (or whatever the platform expects) |
| `PYTHON_EMBEDDING_SERVICE_URL` | backend | `python-service`'s **internal** URL (e.g. `http://python-service.internal:8001`) |
| `POSTGRES_URL` | backend | `postgresql://user:pass@<managed-postgres-host>:5432/nexus_vectors` |
| `MCP_SERVER_ENTRY` | backend | `/app/mcp-server/dist/index.js` (already the default baked into the backend image — see `backend/Dockerfile`) |
| `FRONTEND_URL` | backend | frontend's public HTTPS URL — **set this *after* deploying the frontend** (see the circular-dependency note below) |
| `EMBEDDING_SERVICE_PORT` | python-service | `8001` |
| `NEXT_PUBLIC_API_BASE_URL` | frontend (**build-time**) | backend's public HTTPS URL |

None of these need code changes to deploy — they're all already read from `process.env` /
`os.environ` (see `backend/src/config.ts`, `python-service/app/main.py`,
`frontend/lib/api.ts`).

### The backend ↔ frontend URL is circular — deploy in two passes

`NEXT_PUBLIC_API_BASE_URL` (frontend) and `FRONTEND_URL` (backend) each need to know the *other*
service's public URL, but neither URL exists until that service is deployed. Break the cycle like
this:

1. Deploy `backend` first with `FRONTEND_URL` left at its local default (or omitted) — it'll
   reject browser calls from the not-yet-deployed frontend, which is fine, nothing is calling it
   yet.
2. Build and deploy `frontend` with `NEXT_PUBLIC_API_BASE_URL` set to the backend's now-known
   public URL (this is already required — see each cloud's "Frontend" step below).
3. Update `backend`'s `FRONTEND_URL` to the frontend's now-known public URL and redeploy/restart
   just the backend service (a config-only redeploy, no rebuild needed). Each cloud section below
   has the one-line command for this.

`FRONTEND_URL` accepts a comma-separated list, so you can include a staging URL alongside
production without another deploy.

---

## 2. AWS — ECS Fargate + RDS for PostgreSQL + ECR

**Services used:** Elastic Container Registry (images), ECS Fargate (compute, no servers to
manage), RDS for PostgreSQL (database), Secrets Manager (API key), Application Load Balancer
(public HTTPS).

### 2.1 Push images to ECR
```bash
aws ecr create-repository --repository-name ai-nexus/backend
aws ecr create-repository --repository-name ai-nexus/frontend
aws ecr create-repository --repository-name ai-nexus/python-service

aws ecr get-login-password --region <region> | docker login --username AWS --password-stdin <account-id>.dkr.ecr.<region>.amazonaws.com

# Backend build context is the repo root (it needs the sibling mcp-server/ folder)
docker build -f backend/Dockerfile -t <account-id>.dkr.ecr.<region>.amazonaws.com/ai-nexus/backend:latest .
docker build -f python-service/Dockerfile -t <account-id>.dkr.ecr.<region>.amazonaws.com/ai-nexus/python-service:latest python-service
# Build frontend AFTER you know the backend's public URL — see step 2.4
docker push <account-id>.dkr.ecr.<region>.amazonaws.com/ai-nexus/backend:latest
docker push <account-id>.dkr.ecr.<region>.amazonaws.com/ai-nexus/python-service:latest
```

### 2.2 RDS for PostgreSQL with pgvector
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
`pgvector` ships with RDS for PostgreSQL 15.2+/14.7+ — no extra install needed, just enable it once
connected:
```sql
CREATE EXTENSION IF NOT EXISTS vector;
```
(The app's own `vectorStore.ts` already runs this `CREATE EXTENSION IF NOT EXISTS` on startup, so
this manual step is optional — it happens automatically the first time the backend connects.)

### 2.3 Secrets
```bash
aws secretsmanager create-secret --name ai-nexus/anthropic-api-key --secret-string "sk-ant-..."
aws secretsmanager create-secret --name ai-nexus/postgres-url --secret-string "postgresql://nexus:<password>@<rds-endpoint>:5432/nexus_vectors"
```

### 2.4 ECS Fargate cluster, task definitions, services
```bash
aws ecs create-cluster --cluster-name ai-nexus-cluster
```
Create a task definition per service (JSON, abbreviated — repeat for `python-service`):
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

### 2.5 Frontend
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
editing `.env` before building — Next.js inlines `NEXT_PUBLIC_*` vars at build time either way.)

### 2.6 Point the backend's CORS policy at the deployed frontend
Add `FRONTEND_URL` to the task definition's `environment` array from step 2.4 (alongside `PORT`
and `PYTHON_EMBEDDING_SERVICE_URL`):
```json
{ "name": "FRONTEND_URL", "value": "https://app.yourdomain.com" }
```
Task definitions are immutable, so register the edited JSON as a new revision and point the
service at it — this is a config-only redeploy, no image rebuild needed:
```bash
aws ecs register-task-definition --cli-input-json file://backend-task.json
aws ecs update-service --cluster ai-nexus-cluster --service ai-nexus-backend \
  --task-definition ai-nexus-backend --force-new-deployment
```

**Simpler alternative:** for a demo/low-traffic deployment, **AWS App Runner** does steps 2.1–2.6
with far less configuration — point it at an ECR image, give it env vars/secrets, and it handles
the load balancer, HTTPS, and scaling itself. Worth using instead of ECS+ALB unless you need ECS's
finer-grained control.

---

## 3. Azure — Container Apps + Azure Database for PostgreSQL + ACR

**Services used:** Azure Container Registry (images), Azure Container Apps (compute — built-in
HTTPS, internal/external ingress, and scale-to-zero), Azure Database for PostgreSQL Flexible
Server (database), Key Vault (API key).

### 3.1 Push images to ACR
```bash
az acr create --name ainexusacr --resource-group ai-nexus-rg --sku Basic
az acr login --name ainexusacr

docker build -f backend/Dockerfile -t ainexusacr.azurecr.io/ai-nexus-backend:latest .
docker build -f python-service/Dockerfile -t ainexusacr.azurecr.io/ai-nexus-python-service:latest python-service
docker push ainexusacr.azurecr.io/ai-nexus-backend:latest
docker push ainexusacr.azurecr.io/ai-nexus-python-service:latest
```
(ACR registry names must be globally unique and alphanumeric-only — no hyphens — hence
`ainexusacr` rather than `ai-nexus-acr`.)

### 3.2 Azure Database for PostgreSQL Flexible Server with pgvector
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

### 3.3 Secrets
```bash
az keyvault create --name ai-nexus-kv --resource-group ai-nexus-rg
az keyvault secret set --vault-name ai-nexus-kv --name anthropic-api-key --value "sk-ant-..."
az keyvault secret set --vault-name ai-nexus-kv --name postgres-url --value "postgresql://nexus:<password>@ai-nexus-postgres.postgres.database.azure.com:5432/nexus_vectors"
```

### 3.4 Container Apps environment + services
```bash
az containerapp env create --name ai-nexus-env --resource-group ai-nexus-rg --location eastus

# Internal-only — no public ingress
az containerapp create \
  --name python-service --resource-group ai-nexus-rg --environment ai-nexus-env \
  --image ainexusacr.azurecr.io/ai-nexus-python-service:latest \
  --ingress internal --target-port 8001

# Public — this is the API clients/frontend hit
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
`https://backend.<random>.eastus.azurecontainerapps.io`) — use that for the frontend build.

### 3.5 Frontend
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

### 3.6 Point the backend's CORS policy at the deployed frontend
Unlike GCP's `--set-env-vars` (see 4.6), Container Apps' `--set-env-vars` on `update` only adds/
overwrites the named variable(s) — it doesn't clear the others set in 3.4, so no extra flag needed:
```bash
az containerapp update \
  --name backend --resource-group ai-nexus-rg \
  --set-env-vars FRONTEND_URL=https://frontend.<random>.eastus.azurecontainerapps.io
```

---

## 4. GCP — Cloud Run + Cloud SQL for PostgreSQL + Artifact Registry

**Services used:** Artifact Registry (images), Cloud Run (compute — scale-to-zero, built-in
HTTPS), Cloud SQL for PostgreSQL (database), Secret Manager (API key).

### 4.1 Push images to Artifact Registry
```bash
gcloud artifacts repositories create ai-nexus --repository-format=docker --location=us-central1
gcloud auth configure-docker us-central1-docker.pkg.dev

docker build -f backend/Dockerfile -t us-central1-docker.pkg.dev/<project-id>/ai-nexus/backend:latest .
docker build -f python-service/Dockerfile -t us-central1-docker.pkg.dev/<project-id>/ai-nexus/python-service:latest python-service
docker push us-central1-docker.pkg.dev/<project-id>/ai-nexus/backend:latest
docker push us-central1-docker.pkg.dev/<project-id>/ai-nexus/python-service:latest
```

### 4.2 Cloud SQL for PostgreSQL with pgvector
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

### 4.3 Secrets
```bash
echo -n "sk-ant-..." | gcloud secrets create anthropic-api-key --data-file=-
echo -n "postgresql://postgres:<password>@<cloud-sql-connection>/nexus_vectors" | gcloud secrets create postgres-url --data-file=-
```

### 4.4 Deploy python-service (internal only) and backend (public)
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
service-to-service identity token, or a Serverless VPC Connector so `backend` can reach
`python-service` by internal address — see
[Cloud Run service-to-service docs](https://cloud.google.com/run/docs/authenticating/service-to-service)
for the current recommended pattern.

### 4.5 Frontend
```bash
docker build -f frontend/Dockerfile \
  --build-arg NEXT_PUBLIC_API_BASE_URL=$(gcloud run services describe backend --region us-central1 --format 'value(status.url)') \
  -t us-central1-docker.pkg.dev/<project-id>/ai-nexus/frontend:latest frontend
docker push us-central1-docker.pkg.dev/<project-id>/ai-nexus/frontend:latest

gcloud run deploy frontend \
  --image us-central1-docker.pkg.dev/<project-id>/ai-nexus/frontend:latest \
  --region us-central1 --allow-unauthenticated --port 3000
```

### 4.6 Point the backend's CORS policy at the deployed frontend
Use `--update-env-vars` here, not `--set-env-vars` — `--set-env-vars` replaces the *entire*
environment variable list, which would wipe out `PORT`/`PYTHON_EMBEDDING_SERVICE_URL` from step
4.4. `--update-env-vars` only touches the key(s) you name:
```bash
gcloud run services update backend \
  --region us-central1 \
  --update-env-vars FRONTEND_URL=$(gcloud run services describe frontend --region us-central1 --format 'value(status.url)')
```

---

## 5. If you specifically need Kubernetes (EKS/AKS/GKE)

The same four images work unmodified on any Kubernetes cluster — nothing here is
platform-specific. The shape is a `Deployment` + `Service` per container (`ClusterIP` for
`python-service`, `LoadBalancer`/`Ingress` for `backend` and `frontend`), a `Secret` for
`ANTHROPIC_API_KEY`/`POSTGRES_URL`, and either a managed Postgres (RDS/Azure Database/Cloud SQL, as
above) or an in-cluster Postgres via the `pgvector/pgvector` image with a `StatefulSet` +
`PersistentVolumeClaim` (essentially `docker-compose.yml`'s `postgres` service translated to a
`StatefulSet`). This is real added operational overhead (cluster upgrades, node management, more
YAML) versus the serverless-container options above — reach for it only if you already run
Kubernetes for other services and want this to live alongside them, not because it's inherently
"more production."

---

## 6. Notes that apply to all three clouds

- **`python-service` and `postgres` should never be publicly exposed.** Only `backend` and
  `frontend` need public HTTPS endpoints; the examples above set `python-service` to
  internal/unauthenticated-denied on purpose.
- **Never bake `ANTHROPIC_API_KEY` into an image or commit it.** Every example above pulls it from
  that cloud's secrets manager at runtime, the same way `.env` (gitignored) does locally.
- **`mcp-server` is not deployed separately anywhere in this guide.** It's compiled into the
  backend image and spawned by `backend/src/agent/mcpClient.ts` as a stdio child process at
  runtime — the same as it works locally. There's nothing extra to provision for it.
- **Cold starts:** Cloud Run and Azure Container Apps can scale to zero, which is cheap but means
  the first request after idle time is slower (container boot + Postgres connection + RAG
  knowledge-base check). Set a minimum instance count of 1 on `backend` if consistent latency
  matters more than idle cost.
- **This guide is CLI-first, not Infrastructure-as-Code.** For anything beyond a demo/personal
  deployment, translate these steps into Terraform, AWS CDK, Bicep, or Pulumi so the environment is
  reproducible and reviewable — the CLI commands above are meant to show the shape of what's
  needed, not to be the final production setup.
- **CI/CD:** a natural next step is a GitHub Actions workflow that runs `docker build`/`push` for
  each changed service on merge to `main`, then triggers the equivalent of the deploy commands
  above (`aws ecs update-service --force-new-deployment`, `az containerapp update`, or
  `gcloud run deploy` again with the new image tag). Not included here since it's a meaningful
  separate piece of setup, but every command in this guide is scriptable as-is.
