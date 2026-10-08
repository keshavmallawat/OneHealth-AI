# OneHealth AI — Deployment guide

**Status, stated plainly:** the project runs locally and the container files below are written and the compose file validates, but **the images have not yet been built or deployed.** Treat section 2 as the next task, not a completed one, and do not describe the system as deployed until section 3 has passed on a real host.

---

## 1. Run locally (works today)

Windows: double-click `RUN-SETUP.bat`. It installs, migrates, builds, starts the three services, seeds demo data and runs the test suites. Full log in `scripts/setup-log.txt`.

Manual start: see the Quick start section of the README (database, backend, AI service, frontend).

---

## 2. Run everything in containers

Requirements: Docker with Compose v2.

```bash
cp infra/.env.prod.example infra/.env.prod
# Fill in every secret. Generate each with:
#   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
# PII_ENCRYPTION_KEY must be exactly 32 characters.

docker compose -f infra/docker-compose.prod.yml --env-file infra/.env.prod up -d --build
```

Open `http://localhost:8080`.

| Service | Image | Notes |
|---|---|---|
| `postgres` | `postgres:16` | Data in the `pgdata` volume |
| `redis` | `redis:7-alpine` | Optional at runtime; the API falls back to memory without it |
| `ai` | `ai-service/Dockerfile` | Python 3.12, Tesseract installed. Build with `WITH_SPACY=true` to include spaCy |
| `api` | `backend/Dockerfile` | Applies migrations, then starts. Uploads in the `uploads` volume |
| `web` | `frontend/Dockerfile` | nginx serving the built app and proxying `/api` to `api` |

Compose refuses to start if a required secret is missing, and no secret is written in any file in the repository. `infra/.env.prod` is git-ignored.

Seed demo data (optional, development only):

```bash
docker compose -f infra/docker-compose.prod.yml --env-file infra/.env.prod exec api npm run seed
```

The image keeps the development dependencies the seed script needs (`ts-node`). Like the rest of the container files, this has not been run yet.

---

## 3. Post-deployment checklist

Run through this on the real host before calling it deployed.

- [ ] `GET /api/health` shows `database`, `aiService` and `storage` healthy
- [ ] Register a patient and a clinician
- [ ] Upload `sample-data/sample-blood-report-abnormal.pdf`; analysis completes
- [ ] Upload `sample-data/sample-lipid-profile-scan.png`; OCR path completes
- [ ] Clinician requests access by share code; patient approves; clinician sees read-only data; patient revokes; clinician is refused
- [ ] `node scripts/smoke-test.js https://<your-host>` passes (it registers accounts, so use a staging copy)
- [ ] HTTPS is enforced in front of the web container (the compose file serves plain HTTP on purpose; terminate TLS at the host or a load balancer)
- [ ] `NODE_ENV=production` is set and the API booted, which proves it is not running on development secrets

---

## 4. Hosting options

| Option | Fit | Notes |
|---|---|---|
| One small VM (AWS EC2, DigitalOcean, any VPS) running the compose file | Best for the submission: one machine, one command | Put Caddy or nginx with Let's Encrypt in front for HTTPS |
| Render | Matches the proposal's "AWS / Render" | Create a Postgres instance, a Docker web service for each of `api` and `ai`, and a static site for `frontend/dist` with a rewrite of `/api/*` to the API. Set the same environment variables |
| AWS ECS Fargate, CloudFront, WAF | The Complete Plan's end state | Out of scope for the academic submission |

**Storage.** For a single VM the `uploads` volume is enough. To use S3 set `STORAGE_DRIVER=s3` with `AWS_REGION`, `S3_BUCKET_NAME` and credentials; the S3 driver is implemented but has not been exercised against a real bucket, so test it before relying on it.

**LLM summaries.** Optional. With no `OPENAI_API_KEY` the deterministic explainer runs and the UI says so.

---

## 5. Health data caution

Use synthetic reports on any publicly reachable instance. A real deployment holding real patient data would need, at minimum: data residency decisions, a legal review against the Digital Personal Data Protection Act 2023, encrypted backups, access monitoring and a penetration test. None of these is claimed by this project.
