# Deployment Guide: AWS, Azure, GCP

This app is already fully containerized (see `docker-compose.yml` and the `Dockerfile` in each
service), so deploying to any major cloud is the same basic shape everywhere: push four container
images to a registry, run them on a managed container platform and point them at a Postgres
instance with the `pgvector` extension enabled. This guide covers all three major clouds using
each one's simplest "serverless containers" service: no Kubernetes cluster to operate.

Azure and GCP each get two full, self-contained paths below: a **Paid** path (that cloud's own
managed Postgres) and a **Free** path (a $0/month third-party Postgres instead). AWS is paid-only:
Fargate has no standing free compute tier, so there's no free variant to offer there (see
section 3).

If you specifically want a Kubernetes-based deployment (EKS/AKS/GKE) instead, see
[section 6](#6-if-you-specifically-need-kubernetes-eksaksgke) at the end.

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

Every cloud command below that provisions a database explicitly requests **PostgreSQL 16** to
match. If a cloud's current default version has moved past 16 by the time you read this, either
pin to 16 explicitly (as shown) or bump every occurrence of "16" in this guide together; pgvector
itself is compatible with newer major Postgres versions too, so upgrading is safe as long as you
change it everywhere at once.

---

## 1. What you're deploying

Four pieces, mirroring `docker-compose.yml`:

| Service | Image | Exposure | Depends on |
|---|---|---|---|
| `frontend` | `frontend/Dockerfile` (Next.js 14.2.35, Node 20) | **Public**: this is what users open in a browser | `backend` (via `NEXT_PUBLIC_API_BASE_URL`, baked in at build time) |
| `backend` | `backend/Dockerfile` (Express 4.21 API on Node 20; bundles the compiled `mcp-server/` and spawns it as a stdio child process, **no separate deployment needed for MCP**) | **Public**: the frontend and any API client call this over HTTPS | `python-service`, `postgres`, Anthropic API (outbound) |
| `python-service` | `python-service/Dockerfile` (FastAPI 0.115.0 on Python 3.12: embeddings, summarization, tokenization/cost, semantic caching, evaluation; stdlib-only, no downloaded models) | **Internal only**: only `backend` needs to reach it | nothing |
| `postgres` | managed PostgreSQL 16 + `pgvector` (not self-hosted in prod; locally this is the `pgvector/pgvector:pg16` image) | **Internal only**: only `backend` needs to reach it | nothing |

Because `NEXT_PUBLIC_API_BASE_URL` is compiled into the frontend's static JS at build time (Next.js
`NEXT_PUBLIC_*` convention), you must know the backend's public URL *before* building the frontend
image. Deploy the backend first, then build the frontend pointing at that URL.

### Environment variables needed in production

| Variable | Set on | Value |
|---|---|---|
| `ANTHROPIC_API_KEY` | backend | Real key starting with `sk-ant-`, from a secrets manager; never bake into an image. **Omit entirely on the Free paths** to keep the LLM call in mock mode (see below) |
| `ANTHROPIC_MODEL` | backend | `claude-sonnet-5` (the exact string this repo's `.env.example` and `docker-compose.yml` both default to) |
| `PORT` | backend | `4000`. This is the port the Express server listens on inside its container; it's independent of whatever public port the platform exposes it on |
| `PYTHON_EMBEDDING_SERVICE_URL` | backend | `python-service`'s **internal** URL, e.g. `http://python-service.internal:8001` on ECS, `http://python-service` on Container Apps/Cloud Run (see each path's Step 4 for the exact value that platform expects) |
| `POSTGRES_URL` | backend | `postgresql://<user>:<password>@<host>:5432/nexus_vectors` (Paid paths) or a Neon connection string ending in `?sslmode=require` (Free paths); see "Does `POSTGRES_URL` need to change?" below |
| `MCP_SERVER_ENTRY` | backend | `/app/mcp-server/dist/index.js`. This is already the default baked into `backend/Dockerfile` (`WORKDIR /app/backend` plus the sibling `../mcp-server/dist/index.js` copied in at build time), so you only need to set this variable if you've changed the image's directory layout |
| `FRONTEND_URL` | backend | frontend's public HTTPS URL, e.g. `https://app.yourdomain.com`: **set this *after* deploying the frontend** (see the circular-dependency note below) |
| `EMBEDDING_SERVICE_PORT` | python-service | `8001` |
| `NEXT_PUBLIC_API_BASE_URL` | frontend (**build-time**, not runtime) | backend's public HTTPS URL, e.g. `https://api.yourdomain.com` |

None of these need code changes to deploy: they're all already read from `process.env` /
`os.environ` (see `backend/src/config.ts`, `python-service/app/main.py`,
`frontend/lib/api.ts`).

### Example environment values

Concrete, filled-in versions of the table above, so you can see exactly what a real value looks
like rather than just the variable names. `REAL_PASSWORD` and the account/project identifiers
below are placeholders you replace with your own; everything else (the hostname shapes, the URL
patterns) matches what each provider actually gives you.

**Paid path (AWS example, RDS-backed):**
```bash
ANTHROPIC_API_KEY=sk-ant-api03-REAL_KEY_FROM_CONSOLE
ANTHROPIC_MODEL=claude-sonnet-5
PORT=4000
FRONTEND_URL=https://app.yourdomain.com
PYTHON_EMBEDDING_SERVICE_URL=http://python-service.ai-nexus.local:8001
MCP_SERVER_ENTRY=/app/mcp-server/dist/index.js
POSTGRES_URL=postgresql://nexus:REAL_PASSWORD@ai-nexus-postgres.abcd1234.us-east-1.rds.amazonaws.com:5432/nexus_vectors
EMBEDDING_SERVICE_PORT=8001
NEXT_PUBLIC_API_BASE_URL=https://api.yourdomain.com
```

**Free path (GCP Cloud Run + Neon example):**
```bash
ANTHROPIC_API_KEY=
ANTHROPIC_MODEL=claude-sonnet-5
PORT=4000
FRONTEND_URL=https://ai-nexus-frontend-abcd1234-uc.a.run.app
PYTHON_EMBEDDING_SERVICE_URL=https://ai-nexus-python-service-abcd1234-uc.a.run.app
MCP_SERVER_ENTRY=/app/mcp-server/dist/index.js
POSTGRES_URL=postgresql://neondb_owner:REAL_PASSWORD@ep-cool-name-123456.us-east-2.aws.neon.tech/nexus_vectors?sslmode=require
EMBEDDING_SERVICE_PORT=8001
NEXT_PUBLIC_API_BASE_URL=https://ai-nexus-backend-abcd1234-uc.a.run.app
```

Note `ANTHROPIC_API_KEY` is left blank on the Free path on purpose: that's what keeps the LLM call
in mock mode so hosting stays $0. Each cloud path below shows exactly how to set these values as
real secrets/env vars on that platform, not just as a `.env` file (containers in production don't
read a `.env` file the way local dev does; the platform injects these as actual process
environment variables, either directly or pulled from a secrets manager at startup).

### Does `POSTGRES_URL` need to change? Yes

This is one of the most common things to forget. Locally, `POSTGRES_URL` points at the Docker
Postgres container running on your own machine (`postgresql://nexus:nexus@localhost:5433/nexus_vectors`,
straight from `.env.example`), which no cloud service can reach. In production it must point at
whichever real Postgres you provision in that cloud's section below: the RDS/Cloud SQL/Azure
Database hostname on a Paid path, or the Neon connection string on a Free path, each with its own
real username, password and host. Every path's "Secrets" step below shows exactly what that value
looks like and how to set it.

### Do I need to run setup commands after deploying? No, it happens automatically

Locally, `npm run db:up` only starts the Postgres container; the actual schema and data setup runs
by itself the moment the backend process starts. `vectorStore.ts`'s `ensureReady()` creates the
`pgvector` extension, the `chunks` table and the HNSW index if they don't already exist, and
`seedDocuments.ts` chunks, embeds and loads the knowledge-base markdown into that table if it's
still empty (see `codebase.md` for both). That's true in production too: the first time the
deployed backend container boots and successfully connects to whichever Postgres `POSTGRES_URL`
points at, it runs that exact same startup sequence. There's no `ssh` session, no migration
command and no separate seeding step to run by hand; a successful container boot against a
reachable Postgres instance *is* the entire setup step, the same way it is locally. The one thing
worth watching the first time: tail the backend's logs right after deploy (each cloud path below
shows the log-viewing command) and confirm you see it connect to Postgres and finish seeding,
rather than assuming it worked silently.

### The backend ↔ frontend URL is circular: deploy in two passes

`NEXT_PUBLIC_API_BASE_URL` (frontend) and `FRONTEND_URL` (backend) each need to know the *other*
service's public URL, but neither URL exists until that service is deployed. Break the cycle like
this:

1. Deploy `backend` first with `FRONTEND_URL` left at its local default (or omitted); it'll
   reject browser calls from the not-yet-deployed frontend, which is fine, nothing is calling it
   yet.
2. Build and deploy `frontend` with `NEXT_PUBLIC_API_BASE_URL` set to the backend's now-known
   public URL (this is already required; see each path's "Frontend" step below).
3. Update `backend`'s `FRONTEND_URL` to the frontend's now-known public URL and redeploy/restart
   just the backend service (a config-only redeploy, no rebuild needed). Each path below has the
   one-line command for this as its last step.

`FRONTEND_URL` accepts a comma-separated list, so you can include a staging URL alongside
production without another deploy.

### About the Free ($0/month) paths

For demo/portfolio traffic (not sustained production load), compute and database both have
genuine **standing** free tiers, not 12-month trials, on Azure and GCP. Numbers quoted in each
section are current as of this writing; check each provider's pricing page before relying on them
long-term.

- **Database: the actual blocker to a $0 deployment.** RDS, Cloud SQL and Azure Database for
  PostgreSQL are all paid-only; none has a permanent free managed-Postgres tier. Every Free path
  below swaps that step for **[Neon](https://neon.tech)**, a serverless Postgres provider with
  `pgvector` support and a real free tier (0.5GB storage, 100 compute-hours/month, scale-to-zero
  after 5 minutes idle: compute suspends and **auto-resumes transparently on the next query**, no
  manual action needed). The app only needs a connection string, so this is a drop-in swap for
  `POSTGRES_URL`, no code change. ([Supabase](https://supabase.com) is a comparable free option,
  but its free projects **pause after 7 days of inactivity and require a manual click to resume**,
  a bad fit for an unattended demo link someone might not open for a week. Neon's auto-resume
  doesn't have that failure mode, so it's the better default here.)
- **LLM:** every Free path below leaves `ANTHROPIC_API_KEY` unset entirely. The deployed app runs
  in mock mode: routing, retrieval, prompt templates and tool-calling are all still real; only
  the final model call is canned and labeled `[MOCK MODE]` so hosting stays $0 with nothing
  metered. Add the key later, the same way the Paid paths do, if you want occasional live Claude
  responses; that's a usage cost, not a hosting cost, and it doesn't change anything else.
- **Compute:** each of Azure/GCP's Free-path sections below quotes that platform's specific
  standing free grant.
- **The honest limit:** free tiers are usage caps, not guarantees. Neon's free compute
  autosuspending after 5 minutes idle means the first request after a long gap has a short
  (usually sub-second) wake-up delay stacking on top of Cloud Run's/Container Apps' own cold
  start: fine for a demo link opened occasionally, not something to build sustained traffic on.
  If this ever needs to handle real, sustained traffic, switch to the Paid path in that section;
  nothing else about the deployment shape changes.

### Cost at a glance

Rough monthly estimates for continuous (24/7) operation at low/demo traffic. These are **ballpark
figures from published list pricing, not quotes**: actual cost depends on region, exact instance
sizing, traffic and how provider pricing changes over time. See each section below for the
line-item breakdown behind these totals; use each provider's official pricing calculator before
budgeting for real.

| Path | ~Total/month | Why |
|---|---|---|
| AWS (Paid; only option) | **~$90–100** | Fargate, the ALB and RDS are all provisioned resources billed continuously: nothing on AWS scales to zero or has a standing free tier here |
| Azure Paid | **~$20–35** | Dominated by Azure Database for PostgreSQL (billed 24/7); Container Apps compute is often ~$0 if traffic stays inside the standing free grant |
| Azure Free | **$0** | Neon + Container Apps' free grant + mock mode (section 4B) |
| GCP Paid | **~$12–25** | Dominated by Cloud SQL (billed 24/7); Cloud Run compute is often ~$0 if traffic stays inside the standing free grant |
| GCP Free | **$0** | Neon + Cloud Run's free tier + mock mode (section 5B) |

---

## 2. Why these platforms, and what else was considered

**Why AWS, Azure and GCP, and not a simpler PaaS (Railway, Render, Fly.io, Heroku, DigitalOcean
App Platform)?** Any of those would deploy this app's four containers with noticeably less
ceremony: no IAM policies, no VPC networking to reason about, often a single config file. They
were left out on purpose: this guide is written to double as practice with the platforms real job
postings and real company infrastructure actually name, not just the fastest way to get a link
online. The trade-off is real, though: a simpler PaaS is a genuinely better choice if the goal is
only "get this running publicly today," and nothing here stops you from pointing one at these same
Dockerfiles; the shape (build an image per service, run it, point it at a Postgres with `pgvector`)
doesn't change.

**Why serverless containers (Fargate / Container Apps / Cloud Run) as the default, instead of raw
VMs or committing to Kubernetes from the start?** This is the actual default compute model at most
companies below a certain infrastructure-team size today, for a reason: it gives most of what
Kubernetes offers, declarative deploys, no manually patched servers, the platform restarting a
crashed container for you, without a cluster to size, upgrade or operate. The trade-off against
Kubernetes is real too: less portability (each cloud's serverless-container API is shaped
differently, where a Kubernetes manifest is close to identical across all three) and no access to
advanced orchestration primitives like custom schedulers or a service mesh. Section 6 exists as an
explicit escape hatch for exactly the deployments that need those.

**Why is AWS included at all, given it's the most expensive option here with no free path?**
Fargate, RDS and the ALB together are genuinely the priciest of the three for a low-traffic demo
(see the cost table above), and AWS has no standing free compute tier the way Azure and GCP do,
but ECS/Fargate/RDS experience shows up disproportionately often in job postings relative to its
Azure/GCP equivalents, so it earns its place here for the learning value even though it's the worst
fit for a $0 portfolio deployment. Azure and GCP get the Free-path treatment specifically because
their serverless compute has a standing (not trial) free grant, and because Postgres is the one
AWS-side cost with no free managed equivalent: RDS has never offered a perpetual free tier the way
Container Apps and Cloud Run do for compute.

**Why an external Postgres provider (Neon) for the Free paths, instead of just running Postgres in
a container on the same platform?** None of Fargate, Container Apps or Cloud Run are built to run
a stateful, always-on process; they're all designed around disposable, stateless containers that
scale to zero, which is exactly wrong for a database that needs a persistent volume and must never
restart mid-write. Running Postgres in a plain container on any of them would appear to work right
up until the next scale-to-zero cycle silently lost data. A real database on these platforms
therefore needs either that cloud's managed Postgres (the Paid path) or an external, always-on
Postgres provider reached over the network (the Free path's Neon); see "About the Free paths" in
section 1 for why Neon specifically, over Supabase or a self-hosted alternative.

---

## 3. AWS: ECS Fargate + RDS for PostgreSQL + ECR

*Paid only: AWS Fargate has no standing free compute tier, so there's no $0/month variant here.
See the Free paths in sections 4 and 5 instead.*

**Services used:** Elastic Container Registry (images), ECS Fargate (compute, no servers to
manage), RDS for PostgreSQL 16 (database), Secrets Manager (API key), Application Load Balancer
(public HTTPS), VPC (networking, reused from your account's default VPC unless noted otherwise).

#### Step 0: Install and authenticate the AWS CLI

Install **AWS CLI v2** (not the legacy v1) from
[aws.amazon.com/cli](https://aws.amazon.com/cli/), then authenticate and confirm it works:
```bash
aws configure
# prompts for Access Key ID, Secret Access Key, default region (e.g. us-east-1), output format (json)

aws sts get-caller-identity
```
The last command's output includes your **12-digit account ID**; every `<account-id>` placeholder
below is that number. Pick one **region** (e.g. `us-east-1`) and use it consistently for every
`<region>` placeholder below; RDS, ECR and ECS all need to be created in the same region to reach
each other without cross-region networking.

Find your default VPC's ID and subnet IDs now, since Steps 2 and 4 both need them:
```bash
aws ec2 describe-vpcs --filters "Name=isDefault,Values=true" --query "Vpcs[0].VpcId" --output text
# note this as <vpc-id>

aws ec2 describe-subnets --filters "Name=vpc-id,Values=<vpc-id>" --query "Subnets[].SubnetId" --output text
# note two or more of these as <subnet-id-1>, <subnet-id-2> (Fargate needs at least one, but
# two subnets in different Availability Zones is what the ALB requires for high availability)
```

#### Step 1: Push images to ECR
```bash
aws ecr create-repository --repository-name ai-nexus/backend
aws ecr create-repository --repository-name ai-nexus/frontend
aws ecr create-repository --repository-name ai-nexus/python-service

aws ecr get-login-password --region <region> | docker login --username AWS --password-stdin <account-id>.dkr.ecr.<region>.amazonaws.com

# Backend build context is the repo root (it needs the sibling mcp-server/ folder)
docker build -f backend/Dockerfile -t <account-id>.dkr.ecr.<region>.amazonaws.com/ai-nexus/backend:latest .
docker build -f python-service/Dockerfile -t <account-id>.dkr.ecr.<region>.amazonaws.com/ai-nexus/python-service:latest python-service
# Build frontend AFTER you know the backend's public URL, see Step 5
docker push <account-id>.dkr.ecr.<region>.amazonaws.com/ai-nexus/backend:latest
docker push <account-id>.dkr.ecr.<region>.amazonaws.com/ai-nexus/python-service:latest
```

#### Step 2: Security group + RDS for PostgreSQL 16 with pgvector

Create a security group that allows inbound Postgres traffic (port 5432) only from within the
VPC, not from the public internet:
```bash
aws ec2 create-security-group \
  --group-name ai-nexus-rds-sg \
  --description "Allow Postgres from within the VPC only" \
  --vpc-id <vpc-id> \
  --query "GroupId" --output text
# note this as <sg-id>

aws ec2 authorize-security-group-ingress \
  --group-id <sg-id> \
  --protocol tcp --port 5432 \
  --cidr 10.0.0.0/8
# adjust the CIDR to match your actual VPC's IP range if it isn't the default 10.0.0.0/16
```

Then create the database itself, explicitly on **PostgreSQL 16** to match this app's local
`pgvector/pgvector:pg16` image:
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
`16.4` is the current RDS-supported PostgreSQL 16 minor version as of this writing; if AWS has
moved past it, list what's actually available and pick the newest 16.x: `aws rds
describe-db-engine-versions --engine postgres --query "DBEngineVersions[?starts_with(EngineVersion,
'16')].EngineVersion"`.

`pgvector` ships with RDS for PostgreSQL 15.2+/14.7+, no extra install needed, just enable it once
connected. Wait for the instance to finish creating (`aws rds wait db-instance-available
--db-instance-identifier ai-nexus-postgres`), then get its connection endpoint:
```bash
aws rds describe-db-instances \
  --db-instance-identifier ai-nexus-postgres \
  --query "DBInstances[0].Endpoint.Address" --output text
# note this as <rds-endpoint>
```
```sql
CREATE EXTENSION IF NOT EXISTS vector;
```
(The app's own `vectorStore.ts` already runs this `CREATE EXTENSION IF NOT EXISTS` on startup, so
this manual step is optional; it happens automatically the first time the backend connects, per
the "Do I need to run setup commands" note in section 1.)

#### Step 3: Secrets
```bash
aws secretsmanager create-secret --name ai-nexus/anthropic-api-key --secret-string "sk-ant-..."
aws secretsmanager create-secret --name ai-nexus/postgres-url --secret-string "postgresql://nexus:<password>@<rds-endpoint>:5432/nexus_vectors"
```
Note the full ARNs these commands return (or fetch them with `aws secretsmanager describe-secret
--secret-id ai-nexus/anthropic-api-key --query ARN --output text`); Step 4's task definition
JSON needs the exact ARN, not just the secret name.

#### Step 4: ECS Fargate cluster, task definitions, services
```bash
aws ecs create-cluster --cluster-name ai-nexus-cluster
```
Also create a security group for the containers themselves, allowing inbound traffic from the ALB
on ports 4000 (backend) and 8001 (python-service), and outbound to anywhere (so the backend can
reach RDS, the Python service and the Anthropic API):
```bash
aws ec2 create-security-group \
  --group-name ai-nexus-ecs-sg \
  --description "AI Nexus ECS tasks" \
  --vpc-id <vpc-id> \
  --query "GroupId" --output text
# note this as <ecs-sg-id>

aws ec2 authorize-security-group-ingress --group-id <ecs-sg-id> --protocol tcp --port 4000 --cidr 0.0.0.0/0
aws ec2 authorize-security-group-ingress --group-id <ecs-sg-id> --protocol tcp --port 8001 --source-group <ecs-sg-id>
```

Create a task definition per service (JSON, abbreviated; repeat the same shape for
`python-service`, with its own image, `containerPort: 8001` and `EMBEDDING_SERVICE_PORT=8001`):
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
      { "name": "ANTHROPIC_API_KEY", "valueFrom": "arn:aws:secretsmanager:<region>:<account-id>:secret:ai-nexus/anthropic-api-key" },
      { "name": "POSTGRES_URL", "valueFrom": "arn:aws:secretsmanager:<region>:<account-id>:secret:ai-nexus/postgres-url" }
    ],
    "logConfiguration": {
      "logDriver": "awslogs",
      "options": {
        "awslogs-group": "/ecs/ai-nexus-backend",
        "awslogs-region": "<region>",
        "awslogs-stream-prefix": "backend",
        "awslogs-create-group": "true"
      }
    }
  }]
}
```
```bash
aws ecs register-task-definition --cli-input-json file://backend-task.json
```

Set up **Service Connect** so `python-service` gets the internal DNS name the backend's task
definition already expects (`python-service.ai-nexus.local`), then create both ECS services:
```bash
aws ecs create-service \
  --cluster ai-nexus-cluster \
  --service-name ai-nexus-python-service \
  --task-definition ai-nexus-python-service \
  --desired-count 1 \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={subnets=[<subnet-id-1>,<subnet-id-2>],securityGroups=[<ecs-sg-id>],assignPublicIp=DISABLED}" \
  --service-connect-configuration "enabled=true,namespace=ai-nexus,services=[{portName=http,discoveryName=python-service,clientAliases=[{port=8001,dnsName=python-service.ai-nexus.local}]}]"

aws ecs create-service \
  --cluster ai-nexus-cluster \
  --service-name ai-nexus-backend \
  --task-definition ai-nexus-backend \
  --desired-count 1 \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={subnets=[<subnet-id-1>,<subnet-id-2>],securityGroups=[<ecs-sg-id>],assignPublicIp=DISABLED}" \
  --load-balancers "targetGroupArn=<backend-target-group-arn>,containerName=backend,containerPort=4000"
```
The backend service's `--load-balancers` flag needs an existing ALB target group; create the ALB
and target group first with `aws elbv2 create-load-balancer`, `aws elbv2 create-target-group`
(`--target-type ip`, since Fargate tasks don't have EC2 instance IDs) and `aws elbv2
create-listener`, or use the EC2/ECS console's "Create service" wizard, which provisions all three
for you in one flow if you'd rather not compose those three CLI calls by hand. Either way, the
result is an ALB DNS name (e.g. `ai-nexus-alb-123456789.<region>.elb.amazonaws.com`) that's your
backend's public URL for Step 5.

Watch the service come up and check its logs before moving on:
```bash
aws ecs wait services-stable --cluster ai-nexus-cluster --services ai-nexus-backend
aws logs tail /ecs/ai-nexus-backend --follow
```
Look for the same "seeded knowledge base" / listening-on-port log lines this app prints locally
when `npm run dev` starts; that confirms the container reached Postgres and finished the
automatic setup from section 1.

#### Step 5: Frontend
Once you have the backend's public URL (the ALB DNS name from Step 4, or a custom domain like
`https://api.yourdomain.com` if you've pointed Route 53 at it), build and push the frontend with
that baked in, then run it as its own Fargate service behind its own ALB (or the same ALB with
path-based routing):
```bash
docker build -f frontend/Dockerfile \
  --build-arg NEXT_PUBLIC_API_BASE_URL=https://api.yourdomain.com \
  -t <account-id>.dkr.ecr.<region>.amazonaws.com/ai-nexus/frontend:latest frontend
docker push <account-id>.dkr.ecr.<region>.amazonaws.com/ai-nexus/frontend:latest
```
(Add `ARG NEXT_PUBLIC_API_BASE_URL` / `ENV NEXT_PUBLIC_API_BASE_URL=$NEXT_PUBLIC_API_BASE_URL`
near the top of `frontend/Dockerfile`'s build stage if you want this as a build arg rather than
editing `.env` before building; Next.js inlines `NEXT_PUBLIC_*` vars at build time either way.)
Repeat the task-definition-plus-`create-service` pattern from Step 4 for `frontend`, using
`containerPort: 3000` and its own target group/ALB listener.

#### Step 6: Point the backend's CORS policy at the deployed frontend
Add `FRONTEND_URL` to the task definition's `environment` array from Step 4 (alongside `PORT`
and `PYTHON_EMBEDDING_SERVICE_URL`):
```json
{ "name": "FRONTEND_URL", "value": "https://app.yourdomain.com" }
```
Task definitions are immutable, so register the edited JSON as a new revision and point the
service at it; this is a config-only redeploy, no image rebuild needed:
```bash
aws ecs register-task-definition --cli-input-json file://backend-task.json
aws ecs update-service --cluster ai-nexus-cluster --service ai-nexus-backend \
  --task-definition ai-nexus-backend --force-new-deployment
```

**Simpler alternative:** for a demo/low-traffic deployment, **AWS App Runner** does Steps 1–6
with far less configuration: point it at an ECR image, give it env vars/secrets and it handles
the VPC networking, load balancer, HTTPS and scaling itself, no security groups or target groups
to create by hand. Worth using instead of ECS+ALB unless you specifically need ECS's
finer-grained control.

#### Estimated monthly cost (us-east-1 list pricing, 24/7 operation)

AWS has no standing free tier for any of these, so every line item below applies from day one;
this is why AWS is the most expensive of the three clouds in this guide for a low-traffic demo.

| Item | Estimate | Notes |
|---|---|---|
| ECS Fargate (3 services × 0.5 vCPU/1GB, always-on) | ~$54/mo | `$0.04048`/vCPU-hr + `$0.004445`/GB-hr, no scale-to-zero on Fargate |
| Application Load Balancer | ~$20/mo | Base hourly rate + a small amount of LCU usage; assumes one shared ALB with path-based routing rather than one per service |
| RDS `db.t4g.micro` + 20GB storage | ~$14/mo | Compute + gp2 storage |
| ECR image storage | <$1/mo | A few GB of images |
| Secrets Manager (2 secrets) | ~$1/mo | $0.40/secret/month |
| **Total** | **~$90/mo** | Rough; get an exact number from the [AWS Pricing Calculator](https://calculator.aws) for your region/sizing |

---

## 4. Azure: Container Apps + ACR

### 4A. Paid path: Container Apps + Azure Database for PostgreSQL

**Services used:** Azure Container Registry (images), Azure Container Apps (compute: built-in
HTTPS, internal/external ingress and scale-to-zero), Azure Database for PostgreSQL 16 Flexible
Server (database), Key Vault (API key).

#### Step 0: Install and authenticate the Azure CLI

Install the Azure CLI (`az`) from
[learn.microsoft.com/cli/azure/install-azure-cli](https://learn.microsoft.com/en-us/cli/azure/install-azure-cli),
then log in and create the resource group everything below lives in:
```bash
az login
az account set --subscription "<your-subscription-name-or-id>"
az group create --name ai-nexus-rg --location eastus
```
Every command below assumes the resource group `ai-nexus-rg` in region `eastus`; swap in your own
resource group name and [region](https://azure.microsoft.com/en-us/explore/global-infrastructure/geographies/)
consistently if you'd rather use different ones.

#### Step 1: Push images to ACR
```bash
az acr create --name ainexusacr --resource-group ai-nexus-rg --sku Basic
az acr login --name ainexusacr

docker build -f backend/Dockerfile -t ainexusacr.azurecr.io/ai-nexus-backend:latest .
docker build -f python-service/Dockerfile -t ainexusacr.azurecr.io/ai-nexus-python-service:latest python-service
docker push ainexusacr.azurecr.io/ai-nexus-backend:latest
docker push ainexusacr.azurecr.io/ai-nexus-python-service:latest
```
(ACR registry names must be globally unique and alphanumeric-only, no hyphens, hence
`ainexusacr` rather than `ai-nexus-acr`. If that exact name is already taken by another Azure
customer, append your own suffix, e.g. `ainexusacr7412`, and use that name in every command below.)

#### Step 2: Azure Database for PostgreSQL 16 Flexible Server with pgvector
```bash
az postgres flexible-server create \
  --resource-group ai-nexus-rg \
  --name ai-nexus-postgres \
  --admin-user nexus \
  --admin-password <choose-a-strong-password> \
  --database-name nexus_vectors \
  --tier Burstable --sku-name Standard_B1ms \
  --version 16 \
  --public-access None
```
`--version 16` matches this app's local `pgvector/pgvector:pg16` image; omitting the flag would
let Azure pick its own current default, which may not be 16. Enable the extension (Azure requires
allow-listing it first, then creating it):
```bash
az postgres flexible-server parameter set \
  --resource-group ai-nexus-rg --server-name ai-nexus-postgres \
  --name azure.extensions --value vector
```
```sql
CREATE EXTENSION IF NOT EXISTS vector;  -- runs automatically on backend startup too
```
The server's full hostname (for `POSTGRES_URL`) is always
`<name>.postgres.database.azure.com`, so in this example:
`ai-nexus-postgres.postgres.database.azure.com`.

#### Step 3: Secrets
```bash
az keyvault create --name ai-nexus-kv --resource-group ai-nexus-rg
az keyvault secret set --vault-name ai-nexus-kv --name anthropic-api-key --value "sk-ant-..."
az keyvault secret set --vault-name ai-nexus-kv --name postgres-url --value "postgresql://nexus:<password>@ai-nexus-postgres.postgres.database.azure.com:5432/nexus_vectors"
```

#### Step 4: Container Apps environment + services
```bash
az containerapp env create --name ai-nexus-env --resource-group ai-nexus-rg --location eastus

# Internal-only, no public ingress
az containerapp create \
  --name python-service --resource-group ai-nexus-rg --environment ai-nexus-env \
  --image ainexusacr.azurecr.io/ai-nexus-python-service:latest \
  --ingress internal --target-port 8001

# Public: this is what the API clients/frontend hit
az containerapp create \
  --name backend --resource-group ai-nexus-rg --environment ai-nexus-env \
  --image ainexusacr.azurecr.io/ai-nexus-backend:latest \
  --ingress external --target-port 4000 \
  --env-vars PORT=4000 PYTHON_EMBEDDING_SERVICE_URL=http://python-service \
  --secrets anthropic-api-key=keyvaultref:https://ai-nexus-kv.vault.azure.net/secrets/anthropic-api-key,identityref:system \
            postgres-url=keyvaultref:https://ai-nexus-kv.vault.azure.net/secrets/postgres-url,identityref:system \
  --secret-env-vars ANTHROPIC_API_KEY=anthropic-api-key POSTGRES_URL=postgres-url
```
The `--secrets` flags reference Key Vault via a **system-assigned managed identity**
(`identityref:system`); grant that identity permission to read the vault first, or the container
will fail to start with an authorization error:
```bash
az containerapp identity assign --name backend --resource-group ai-nexus-rg --system-assigned
az keyvault set-policy --name ai-nexus-kv \
  --object-id $(az containerapp identity show --name backend --resource-group ai-nexus-rg --query principalId -o tsv) \
  --secret-permissions get
```
Container Apps gives `backend` an HTTPS URL automatically; find it (this is the `<random>` value
referenced in the steps below, generated by Azure, not something you choose):
```bash
az containerapp show --name backend --resource-group ai-nexus-rg --query properties.configuration.ingress.fqdn -o tsv
# e.g. backend.whitemoss-a1b2c3d4.eastus.azurecontainerapps.io
```
Use that URL for the frontend build in Step 5.

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
`update` only adds/overwrites the named variable(s); it doesn't clear the others set in Step 4,
so no extra flag needed:
```bash
az containerapp update \
  --name backend --resource-group ai-nexus-rg \
  --set-env-vars FRONTEND_URL=https://frontend.<random>.eastus.azurecontainerapps.io
```
Confirm it came up correctly by tailing the logs and looking for the same startup/seeding lines
you'd see locally:
```bash
az containerapp logs show --name backend --resource-group ai-nexus-rg --follow
```

#### Estimated monthly cost (list pricing, 24/7 operation)

Unlike AWS, Container Apps compute is consumption-based against a standing free grant (see
section 1), so it can land at ~$0/month if traffic stays inside 180,000 vCPU-seconds / 360,000
GiB-seconds / 2M requests. The Postgres instance is the one line item that's billed 24/7
regardless of traffic; that's the dominant, unavoidable cost here.

| Item | Estimate | Notes |
|---|---|---|
| Azure Database for PostgreSQL Flexible Server (`Burstable B1ms`, 32GB) | ~$16/mo | ~$13/mo compute + ~$3/mo storage |
| Azure Container Registry (Basic) | ~$5/mo | Flat daily rate |
| Container Apps compute (backend + python-service + frontend) | $0–$10+/mo | $0 if usage stays inside the free grant; metered beyond it |
| Key Vault | <$1/mo | Per-operation pricing, negligible at this scale |
| **Total** | **~$20–35/mo** | Rough; get an exact number from the [Azure Pricing Calculator](https://azure.microsoft.com/en-us/pricing/calculator/) for your region/sizing |

---

### 4B. Free path ($0/month): Container Apps + Neon

**Services used:** Azure Container Registry (images), Azure Container Apps (compute: a standing
free monthly grant of 180,000 vCPU-seconds / 360,000 GiB-seconds / 2,000,000 requests, not a
12-month trial), [Neon](https://neon.tech) (free serverless PostgreSQL 18 with `pgvector`; see
"About the Free paths" in section 1 for why Neon over Supabase/Azure Database here). Complete
Step 0 from section 4A first (install `az`, log in, create the resource group) if you haven't
already.

#### Step 1: Provision Neon
No CLI needed: [console.neon.tech](https://console.neon.tech) → sign up (no credit card) → New
Project → pick a region close to `eastus` (or wherever you'll deploy Container Apps). Copy the
connection string it gives you,
`postgresql://<user>:<password>@<endpoint>.neon.tech/<dbname>?sslmode=require`, that's your
`POSTGRES_URL`. No manual `CREATE EXTENSION` step needed: the app's own `vectorStore.ts` already
runs `CREATE EXTENSION IF NOT EXISTS vector` on startup. (Neon currently defaults new projects to
PostgreSQL 18, but lets you pick 14 through 18 explicitly at creation time; `pgvector` works the
same way across all of them, so this is a safe difference from the Paid path's explicit 16 pin
above. If you'd rather match 16 exactly, pick it from Neon's version dropdown when creating the
project.)

#### Step 2: Push images to ACR
```bash
az acr create --name ainexusacr --resource-group ai-nexus-rg --sku Basic
az acr login --name ainexusacr

docker build -f backend/Dockerfile -t ainexusacr.azurecr.io/ai-nexus-backend:latest .
docker build -f python-service/Dockerfile -t ainexusacr.azurecr.io/ai-nexus-python-service:latest python-service
docker push ainexusacr.azurecr.io/ai-nexus-backend:latest
docker push ainexusacr.azurecr.io/ai-nexus-python-service:latest
```
(ACR registry names must be globally unique and alphanumeric-only, no hyphens, hence
`ainexusacr` rather than `ai-nexus-acr`.)

#### Step 3: Secrets
Only `postgres-url` is needed, no `anthropic-api-key` secret at all, since that omission is what
keeps the LLM call in mock mode:
```bash
az keyvault create --name ai-nexus-kv --resource-group ai-nexus-rg
az keyvault secret set --vault-name ai-nexus-kv --name postgres-url --value "postgresql://<user>:<password>@<endpoint>.neon.tech/<dbname>?sslmode=require"
```

#### Step 4: Container Apps environment + services
```bash
az containerapp env create --name ai-nexus-env --resource-group ai-nexus-rg --location eastus

# Internal-only, no public ingress
az containerapp create \
  --name python-service --resource-group ai-nexus-rg --environment ai-nexus-env \
  --image ainexusacr.azurecr.io/ai-nexus-python-service:latest \
  --ingress internal --target-port 8001

# Public: this is what the API clients/frontend hit
az containerapp create \
  --name backend --resource-group ai-nexus-rg --environment ai-nexus-env \
  --image ainexusacr.azurecr.io/ai-nexus-backend:latest \
  --ingress external --target-port 4000 \
  --env-vars PORT=4000 PYTHON_EMBEDDING_SERVICE_URL=http://python-service \
  --secrets postgres-url=keyvaultref:https://ai-nexus-kv.vault.azure.net/secrets/postgres-url,identityref:system \
  --secret-env-vars POSTGRES_URL=postgres-url
```
As in 4A, grant the backend's managed identity permission to read the vault before it will start
successfully:
```bash
az containerapp identity assign --name backend --resource-group ai-nexus-rg --system-assigned
az keyvault set-policy --name ai-nexus-kv \
  --object-id $(az containerapp identity show --name backend --resource-group ai-nexus-rg --query principalId -o tsv) \
  --secret-permissions get
```
Container Apps gives `backend` an HTTPS URL automatically; find it the same way as 4A:
```bash
az containerapp show --name backend --resource-group ai-nexus-rg --query properties.configuration.ingress.fqdn -o tsv
```
Use that URL for the frontend build in Step 5.

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

## 5. GCP: Cloud Run + Artifact Registry

### 5A. Paid path: Cloud Run + Cloud SQL for PostgreSQL

**Services used:** Artifact Registry (images), Cloud Run (compute: scale-to-zero, built-in
HTTPS), Cloud SQL for PostgreSQL 16 (database), Secret Manager (API key).

#### Step 0: Install and authenticate the gcloud CLI

Install the Google Cloud CLI from
[cloud.google.com/sdk/docs/install](https://cloud.google.com/sdk/docs/install), then authenticate
and pick the project every command below runs against:
```bash
gcloud auth login
gcloud config set project <project-id>
gcloud config get-value project
# confirms <project-id>, the value every <project-id> placeholder below refers to
```
If you don't have a project yet, create one first: `gcloud projects create <project-id>
--name="AI Nexus"`, then enable billing on it in the console (required even for the Free path,
since Cloud Run's free tier still needs a billing account attached; you won't be charged as long
as usage stays inside the free grant). Also enable the APIs this guide uses:
```bash
gcloud services enable run.googleapis.com artifactregistry.googleapis.com sqladmin.googleapis.com secretmanager.googleapis.com
```

#### Step 1: Push images to Artifact Registry
```bash
gcloud artifacts repositories create ai-nexus --repository-format=docker --location=us-central1
gcloud auth configure-docker us-central1-docker.pkg.dev

docker build -f backend/Dockerfile -t us-central1-docker.pkg.dev/<project-id>/ai-nexus/backend:latest .
docker build -f python-service/Dockerfile -t us-central1-docker.pkg.dev/<project-id>/ai-nexus/python-service:latest python-service
docker push us-central1-docker.pkg.dev/<project-id>/ai-nexus/backend:latest
docker push us-central1-docker.pkg.dev/<project-id>/ai-nexus/python-service:latest
```

#### Step 2: Cloud SQL for PostgreSQL 16 with pgvector
```bash
gcloud sql instances create ai-nexus-postgres \
  --database-version=POSTGRES_16 \
  --tier=db-f1-micro \
  --region=us-central1

gcloud sql databases create nexus_vectors --instance=ai-nexus-postgres
gcloud sql users set-password postgres --instance=ai-nexus-postgres --password=<choose-a-strong-password>
```
`--database-version=POSTGRES_16` matches this app's local `pgvector/pgvector:pg16` image exactly.
Cloud SQL for PostgreSQL 15+ supports `pgvector` directly:
```sql
CREATE EXTENSION IF NOT EXISTS vector;  -- runs automatically on backend startup too
```
Get the instance's connection name for Step 4 (`<project-id>:us-central1:ai-nexus-postgres`,
already shown there, but you can confirm it with):
```bash
gcloud sql instances describe ai-nexus-postgres --format="value(connectionName)"
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
`<python-service-internal-url>` is the URL `gcloud run deploy python-service` just printed (or
fetch it again with `gcloud run services describe python-service --region us-central1 --format
'value(status.url)'`); Cloud Run gives every service a URL even when it's internal-only. Cloud
Run's inter-service calls need either the services to allow authenticated invocation with a
service-to-service identity token, or a Serverless VPC Connector so `backend` can reach
`python-service` by internal address; the simplest version, sufficient for a demo, is granting the
backend's default service account the Cloud Run Invoker role on `python-service`:
```bash
gcloud run services add-iam-policy-binding python-service \
  --region us-central1 \
  --member="serviceAccount:$(gcloud projects describe <project-id> --format='value(projectNumber)')-compute@developer.gserviceaccount.com" \
  --role="roles/run.invoker"
```
See the
[Cloud Run service-to-service docs](https://cloud.google.com/run/docs/authenticating/service-to-service)
for the full range of options, including the VPC Connector approach if you need private
networking rather than authenticated public calls.

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
Use `--update-env-vars` here, not `--set-env-vars`: `--set-env-vars` replaces the *entire*
environment variable list, which would wipe out `PORT`/`PYTHON_EMBEDDING_SERVICE_URL` from Step 4.
`--update-env-vars` only touches the key(s) you name:
```bash
gcloud run services update backend \
  --region us-central1 \
  --update-env-vars FRONTEND_URL=$(gcloud run services describe frontend --region us-central1 --format 'value(status.url)')
```
Confirm the backend came up correctly:
```bash
gcloud run services logs read backend --region us-central1 --limit 50
```
Look for the same startup/seeding log lines you'd see locally.

#### Estimated monthly cost (list pricing, 24/7 operation)

Like Azure, Cloud Run compute is consumption-based against a standing free tier (see section 1),
so it can land at ~$0/month if traffic stays inside 2M requests / 180,000 vCPU-seconds / 360,000
GiB-seconds. Cloud SQL is the one line item that's billed 24/7 regardless of traffic; that's the
dominant, unavoidable cost here, and it's why GCP comes out cheapest of the three paid paths.

| Item | Estimate | Notes |
|---|---|---|
| Cloud SQL for PostgreSQL (`db-f1-micro`, 10GB SSD) | ~$12/mo | ~$10/mo compute + ~$2/mo storage |
| Artifact Registry image storage | <$1/mo | A few GB of images |
| Cloud Run compute (backend + python-service + frontend) | $0–$10+/mo | $0 if usage stays inside the free tier; metered beyond it |
| Secret Manager (2 secrets) | <$1/mo | ~$0.06/active secret version/month |
| **Total** | **~$12–25/mo** | Rough; get an exact number from the [GCP Pricing Calculator](https://cloud.google.com/products/calculator) for your region/sizing |

---

### 5B. Free path ($0/month): Cloud Run + Neon

**Services used:** Artifact Registry (images), Cloud Run (compute: a standing always-free tier of
2,000,000 requests, 180,000 vCPU-seconds and 360,000 GiB-seconds per month, not a 12-month
trial), [Neon](https://neon.tech) (free serverless PostgreSQL 18 with `pgvector`; see "About the
Free paths" in section 1 for why Neon over Supabase/Cloud SQL here). Complete Step 0 from section
5A first (install `gcloud`, authenticate, enable APIs) if you haven't already; you can skip
enabling `sqladmin.googleapis.com` on this path since there's no Cloud SQL instance to create.

#### Step 1: Provision Neon
No CLI needed: [console.neon.tech](https://console.neon.tech) → sign up (no credit card) → New
Project → pick a region close to `us-central1` (or wherever you'll deploy Cloud Run). Copy the
connection string it gives you,
`postgresql://<user>:<password>@<endpoint>.neon.tech/<dbname>?sslmode=require`, that's your
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
Only `postgres-url` is needed, no `anthropic-api-key` secret at all, since that omission is what
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
No `--add-cloudsql-instances` flag here: that flag is Cloud SQL-specific, and Neon is reached
over the public internet via TLS, so no VPC connector is needed for the database hop. The
`backend` → `python-service` hop still needs the same authenticated-invocation setup as the Paid
path's Step 4 above (the `gcloud run services add-iam-policy-binding` command).

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

The same four images work unmodified on any Kubernetes cluster: nothing here is
platform-specific. The shape is a `Deployment` + `Service` per container (`ClusterIP` for
`python-service`, `LoadBalancer`/`Ingress` for `backend` and `frontend`), a `Secret` for
`ANTHROPIC_API_KEY`/`POSTGRES_URL` and either a managed Postgres (RDS/Azure Database/Cloud SQL, as
above, or Neon for a free option) or an in-cluster Postgres via the `pgvector/pgvector:pg16` image
(the exact same image `docker-compose.yml` uses locally) with a `StatefulSet` +
`PersistentVolumeClaim` (essentially `docker-compose.yml`'s `postgres` service translated to a
`StatefulSet`). This is real added operational overhead (cluster upgrades, node management, more
YAML) versus the serverless-container options above; reach for it only if you already run
Kubernetes for other services and want this to live alongside them, not because it's inherently
"more production."

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
  runtime, the same as it works locally. There's nothing extra to provision for it.
- **Cold starts:** Cloud Run and Azure Container Apps can scale to zero, which is cheap but means
  the first request after idle time is slower (container boot + Postgres connection + RAG
  knowledge-base check). Set a minimum instance count of 1 on `backend` if consistent latency
  matters more than idle cost (`gcloud run services update backend --min-instances=1` on GCP,
  `az containerapp update --name backend --resource-group ai-nexus-rg --min-replicas 1` on Azure).
  On the Free paths, Neon's own autosuspend/auto-resume (see section 1) stacks with this, so the
  very first request after a long idle period is the slowest case.
- **Free-tier numbers are usage caps, not guarantees**, and they change over time; re-check each
  provider's current pricing/limits page before relying on this for anything beyond a demo link.
- **This guide is CLI-first, not Infrastructure-as-Code.** For anything beyond a demo/personal
  deployment, translate these steps into Terraform, AWS CDK, Bicep or Pulumi so the environment is
  reproducible and reviewable; the CLI commands above are meant to show the shape of what's
  needed, not to be the final production setup.
- **CI/CD:** a natural next step is a GitHub Actions workflow that runs `docker build`/`push` for
  each changed service on merge to `main`, then triggers the equivalent of the deploy commands
  above (`aws ecs update-service --force-new-deployment`, `az containerapp update` or
  `gcloud run deploy`/`gcloud run services update` again with the new image tag). Not included
  here since it's a meaningful separate piece of setup, but every command in this guide is
  scriptable as-is.
