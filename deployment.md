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
| `POSTGRES_URL` | backend | `postgresql://user:pass@<managed-postgres-host>:5432/gruve_vectors` |
| `MCP_SERVER_ENTRY` | backend | `/app/mcp-server/dist/index.js` (already the default baked into the backend image — see `backend/Dockerfile`) |
| `EMBEDDING_SERVICE_PORT` | python-service | `8001` |
| `NEXT_PUBLIC_API_BASE_URL` | frontend (**build-time**) | backend's public HTTPS URL |

None of these need code changes to deploy — they're all already read from `process.env` /
`os.environ` (see `backend/src/config.ts`, `python-service/app/main.py`,
`frontend/lib/api.ts`).

---

## 2. AWS — ECS Fargate + RDS for PostgreSQL + ECR

**Services used:** Elastic Container Registry (images), ECS Fargate (compute, no servers to
manage), RDS for PostgreSQL (database), Secrets Manager (API key), Application Load Balancer
(public HTTPS).

### 2.1 Push images to ECR
```bash
aws ecr create-repository --repository-name gruve/backend
aws ecr create-repository --repository-name gruve/frontend
aws ecr create-repository --repository-name gruve/python-service

aws ecr get-login-password --region <region> | docker login --username AWS --password-stdin <account-id>.dkr.ecr.<region>.amazonaws.com

# Backend build context is the repo root (it needs the sibling mcp-server/ folder)
docker build -f backend/Dockerfile -t <account-id>.dkr.ecr.<region>.amazonaws.com/gruve/backend:latest .
docker build -f python-service/Dockerfile -t <account-id>.dkr.ecr.<region>.amazonaws.com/gruve/python-service:latest python-service
# Build frontend AFTER you know the backend's public URL — see step 2.4
docker push <account-id>.dkr.ecr.<region>.amazonaws.com/gruve/backend:latest
docker push <account-id>.dkr.ecr.<region>.amazonaws.com/gruve/python-service:latest
```

### 2.2 RDS for PostgreSQL with pgvector
```bash
aws rds create-db-instance \
  --db-instance-identifier gruve-postgres \
  --engine postgres \
  --engine-version 16.4 \
  --db-instance-class db.t4g.micro \
  --allocated-storage 20 \
  --master-username gruve \
  --master-user-password <choose-a-strong-password> \
  --db-name gruve_vectors \
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
aws secretsmanager create-secret --name gruve/anthropic-api-key --secret-string "sk-ant-..."
aws secretsmanager create-secret --name gruve/postgres-url --secret-string "postgresql://gruve:<password>@<rds-endpoint>:5432/gruve_vectors"
```

### 2.4 ECS Fargate cluster, task definitions, services
```bash
aws ecs create-cluster --cluster-name gruve-cluster
```
Create a task definition per service (JSON, abbreviated — repeat for `python-service`):
```json
{
  "family": "gruve-backend",
  "requiresCompatibilities": ["FARGATE"],
  "networkMode": "awsvpc",
  "cpu": "512",
  "memory": "1024",
  "containerDefinitions": [{
    "name": "backend",
    "image": "<account-id>.dkr.ecr.<region>.amazonaws.com/gruve/backend:latest",
    "portMappings": [{ "containerPort": 4000 }],
    "environment": [
      { "name": "PORT", "value": "4000" },
      { "name": "PYTHON_EMBEDDING_SERVICE_URL", "value": "http://python-service.gruve.local:8001" }
    ],
    "secrets": [
      { "name": "ANTHROPIC_API_KEY", "valueFrom": "arn:aws:secretsmanager:...:gruve/anthropic-api-key" },
      { "name": "POSTGRES_URL", "valueFrom": "arn:aws:secretsmanager:...:gruve/postgres-url" }
    ]
  }]
}
```
```bash
aws ecs register-task-definition --cli-input-json file://backend-task.json
```
Run `python-service` as an internal ECS service using **Service Connect** (gives it the
`python-service.gruve.local` DNS name used above) with no public load balancer. Run `backend`
as a service **behind an Application Load Balancer** (public, HTTPS via an ACM certificate).

### 2.5 Frontend
Once the ALB gives you the backend's public URL (e.g. `https://api.yourdomain.com`), build and
push the frontend with that baked in, then run it as its own Fargate service behind its own ALB
(or the same ALB with path-based routing):
```bash
docker build -f frontend/Dockerfile \
  --build-arg NEXT_PUBLIC_API_BASE_URL=https://api.yourdomain.com \
  -t <account-id>.dkr.ecr.<region>.amazonaws.com/gruve/frontend:latest frontend
```
(Add `ARG NEXT_PUBLIC_API_BASE_URL` / `ENV NEXT_PUBLIC_API_BASE_URL=$NEXT_PUBLIC_API_BASE_URL`
near the top of `frontend/Dockerfile`'s build stage if you want this as a build arg rather than
editing `.env` before building — Next.js inlines `NEXT_PUBLIC_*` vars at build time either way.)

**Simpler alternative:** for a demo/low-traffic deployment, **AWS App Runner** does steps 2.1–2.5
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
az acr create --name gruveacr --resource-group gruve-rg --sku Basic
az acr login --name gruveacr

docker build -f backend/Dockerfile -t gruveacr.azurecr.io/gruve-backend:latest .
docker build -f python-service/Dockerfile -t gruveacr.azurecr.io/gruve-python-service:latest python-service
docker push gruveacr.azurecr.io/gruve-backend:latest
docker push gruveacr.azurecr.io/gruve-python-service:latest
```

### 3.2 Azure Database for PostgreSQL Flexible Server with pgvector
```bash
az postgres flexible-server create \
  --resource-group gruve-rg \
  --name gruve-postgres \
  --admin-user gruve \
  --admin-password <choose-a-strong-password> \
  --database-name gruve_vectors \
  --tier Burstable --sku-name Standard_B1ms \
  --public-access None
```
Enable the extension (Azure requires allow-listing it first, then creating it):
```bash
az postgres flexible-server parameter set \
  --resource-group gruve-rg --server-name gruve-postgres \
  --name azure.extensions --value vector
```
```sql
CREATE EXTENSION IF NOT EXISTS vector;  -- runs automatically on backend startup too
```

### 3.3 Secrets
```bash
az keyvault create --name gruve-kv --resource-group gruve-rg
az keyvault secret set --vault-name gruve-kv --name anthropic-api-key --value "sk-ant-..."
az keyvault secret set --vault-name gruve-kv --name postgres-url --value "postgresql://gruve:<password>@gruve-postgres.postgres.database.azure.com:5432/gruve_vectors"
```

### 3.4 Container Apps environment + services
```bash
az containerapp env create --name gruve-env --resource-group gruve-rg --location eastus

# Internal-only — no public ingress
az containerapp create \
  --name python-service --resource-group gruve-rg --environment gruve-env \
  --image gruveacr.azurecr.io/gruve-python-service:latest \
  --ingress internal --target-port 8001

# Public — this is the API clients/frontend hit
az containerapp create \
  --name backend --resource-group gruve-rg --environment gruve-env \
  --image gruveacr.azurecr.io/gruve-backend:latest \
  --ingress external --target-port 4000 \
  --env-vars PORT=4000 PYTHON_EMBEDDING_SERVICE_URL=http://python-service \
  --secrets anthropic-api-key=keyvaultref:https://gruve-kv.vault.azure.net/secrets/anthropic-api-key,identityref:system \
            postgres-url=keyvaultref:https://gruve-kv.vault.azure.net/secrets/postgres-url,identityref:system \
  --secret-env-vars ANTHROPIC_API_KEY=anthropic-api-key POSTGRES_URL=postgres-url
```
Container Apps gives `backend` an HTTPS URL automatically (e.g.
`https://backend.<random>.eastus.azurecontainerapps.io`) — use that for the frontend build.

### 3.5 Frontend
```bash
docker build -f frontend/Dockerfile \
  --build-arg NEXT_PUBLIC_API_BASE_URL=https://backend.<random>.eastus.azurecontainerapps.io \
  -t gruveacr.azurecr.io/gruve-frontend:latest frontend
docker push gruveacr.azurecr.io/gruve-frontend:latest

az containerapp create \
  --name frontend --resource-group gruve-rg --environment gruve-env \
  --image gruveacr.azurecr.io/gruve-frontend:latest \
  --ingress external --target-port 3000
```

---

## 4. GCP — Cloud Run + Cloud SQL for PostgreSQL + Artifact Registry

**Services used:** Artifact Registry (images), Cloud Run (compute — scale-to-zero, built-in
HTTPS), Cloud SQL for PostgreSQL (database), Secret Manager (API key).

### 4.1 Push images to Artifact Registry
```bash
gcloud artifacts repositories create gruve --repository-format=docker --location=us-central1
gcloud auth configure-docker us-central1-docker.pkg.dev

docker build -f backend/Dockerfile -t us-central1-docker.pkg.dev/<project-id>/gruve/backend:latest .
docker build -f python-service/Dockerfile -t us-central1-docker.pkg.dev/<project-id>/gruve/python-service:latest python-service
docker push us-central1-docker.pkg.dev/<project-id>/gruve/backend:latest
docker push us-central1-docker.pkg.dev/<project-id>/gruve/python-service:latest
```

### 4.2 Cloud SQL for PostgreSQL with pgvector
```bash
gcloud sql instances create gruve-postgres \
  --database-version=POSTGRES_16 \
  --tier=db-f1-micro \
  --region=us-central1

gcloud sql databases create gruve_vectors --instance=gruve-postgres
gcloud sql users set-password postgres --instance=gruve-postgres --password=<choose-a-strong-password>
```
Cloud SQL for PostgreSQL 15+ supports `pgvector` directly:
```sql
CREATE EXTENSION IF NOT EXISTS vector;  -- runs automatically on backend startup too
```

### 4.3 Secrets
```bash
echo -n "sk-ant-..." | gcloud secrets create anthropic-api-key --data-file=-
echo -n "postgresql://postgres:<password>@<cloud-sql-connection>/gruve_vectors" | gcloud secrets create postgres-url --data-file=-
```

### 4.4 Deploy python-service (internal only) and backend (public)
```bash
gcloud run deploy python-service \
  --image us-central1-docker.pkg.dev/<project-id>/gruve/python-service:latest \
  --region us-central1 --no-allow-unauthenticated --ingress internal \
  --port 8001

gcloud run deploy backend \
  --image us-central1-docker.pkg.dev/<project-id>/gruve/backend:latest \
  --region us-central1 --allow-unauthenticated --port 4000 \
  --add-cloudsql-instances <project-id>:us-central1:gruve-postgres \
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
  -t us-central1-docker.pkg.dev/<project-id>/gruve/frontend:latest frontend
docker push us-central1-docker.pkg.dev/<project-id>/gruve/frontend:latest

gcloud run deploy frontend \
  --image us-central1-docker.pkg.dev/<project-id>/gruve/frontend:latest \
  --region us-central1 --allow-unauthenticated --port 3000
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
