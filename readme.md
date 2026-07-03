# Stackfast 2026

Stackfast 2026 is a pnpm TypeScript monorepo for building, validating, and exporting modern application stacks. It combines a curated tool registry, compatibility rules, idea-to-stack blueprint generation, migration planning, and scaffold export flows.

## Current Status

- Monorepo scaffold is complete.
- Core packages compile and test successfully.
- API contract tests cover the public MVP API surface.
- Registry validation passes for the expanded catalog.
- Playwright E2E tests cover the primary MVP flows.
- Deployment tooling and docs are ready; production cutover is operator-driven — see [Production deployment](#production-deployment).

## Architecture

```text
apps/
	api/        Hono API server
	web/        React + Vite web app
packages/
	ai/         Blueprint explanation providers and heuristic fallback
	exporter/   Starter file, README, env, and setup-guide generation
	registry/   Curated tool/catalog loading and validation
	rules-engine/ Compatibility scoring and diagnostics
	schemas/    Shared Zod, API, and Drizzle schemas
	shared/     Shared utilities
```

## Tech Stack

- Package manager: pnpm workspaces
- Runtime: Node.js 20+
- API: Hono, Zod, Better Auth, Drizzle, Neon Postgres-ready
- Web: React 18, Vite, TypeScript, Wouter, TanStack Query, Tailwind CSS
- Tests: Vitest, Playwright
- Registry: static curated catalog with build-time Zod validation

## Setup

1. Install Node.js 20+.
2. Install dependencies:

	 ```sh
	 pnpm install
	 ```

3. Copy `.env.example` to `.env` at the workspace root and fill in the values
	 (at minimum `DATABASE_URL`, `BETTER_AUTH_SECRET`, `GITHUB_CLIENT_ID`,
	 `GITHUB_CLIENT_SECRET`, and optionally `GEMINI_API_KEY`).
4. Run both dev servers:

	 ```sh
	 pnpm dev
	 ```

	 This starts the Hono API on `http://localhost:3000` and the Vite web app
	 on `http://localhost:5173`. The web dev server proxies `/api/*` to the
	 API, so sign-in cookies and CORS "just work" in dev.

	 To start only one server:

	 ```sh
	 pnpm dev:api   # Hono API with tsx watch
	 pnpm dev:web   # Vite dev server
	 ```

## Environment Variables

Common local variables are documented in `.env.example`:

| Variable | Purpose |
| --- | --- |
| `PORT` | API port, default `3000` |
| `CORS_ORIGIN` / `WEB_ORIGIN` | Allowed browser origin for API CORS |
| `DATABASE_URL` | Neon/Postgres connection string |
| `BETTER_AUTH_SECRET` | Better Auth session secret |
| `BETTER_AUTH_URL` | Public API/auth base URL |
| `ALLOW_AUTH_BYPASS` | Local non-production auth bypass when no database is configured |
| `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET` | GitHub OAuth credentials |
| `ADMIN_API_KEY` | Protects `/admin/*` and `/internal/*` routes |
| `AI_PROVIDER` | `heuristic`, `gemini`, or `azure-openai` |
| `GEMINI_API_KEY` | Gemini API key (when `AI_PROVIDER=gemini`) |
| `AZURE_OPENAI_RESOURCE_NAME` | Azure Foundry resource subdomain (when `AI_PROVIDER=azure-openai`) |
| `AZURE_OPENAI_API_KEY` | Azure OpenAI API key |
| `AZURE_OPENAI_DEPLOYMENT` | Azure deployment name, e.g. `gpt-5.5` or `gpt-4.1` |
| `VITE_API_URL` | Web build-time API URL, e.g. `http://localhost:3000/api/v1` |
| `VITE_AUTH_URL` | Optional web build-time auth origin override |

For local development without a database, keep `NODE_ENV=development` and `ALLOW_AUTH_BYPASS=true`.

## Scripts

| Command | Description |
| --- | --- |
| `pnpm dev` | Run API and web dev servers together (colored, shared Ctrl-C) |
| `pnpm dev:api` | Run only the API (tsx watch, loads `.env` via dotenv-cli) |
| `pnpm dev:web` | Run only the Vite web dev server |
| `pnpm seed` | Seed the Neon DB from the registry catalog (needs `DATABASE_URL`) |
| `pnpm -r type-check` | Type-check every workspace package/app |
| `pnpm -r lint` | Lint every workspace package/app |
| `pnpm -r test` | Run unit/API tests |
| `pnpm validate:registry` | Validate the catalog and compatibility rules |
| `pnpm -r build` | Build all packages/apps |
| `pnpm test:e2e` | Run Playwright MVP flow tests |

## API Surface

Public MVP routes:

- `GET /health`
- `POST /api/v1/blueprints`
- `POST /api/v1/stacks/analyze`
- `GET /api/v1/tools/search`
- `GET /api/v1/tools/:id`
- `GET /api/v1/categories`
- `GET /api/v1/catalog`
- `GET /api/v1/compatibility/:a/:b`
- `POST /api/v1/scaffolds`
- `GET /api/v1/migrations/:from/:to`

Protected routes:

- `POST /admin/tools/import`
- `POST /admin/compatibility/recompute`
- `POST /internal/enrich-tool`

## Testing and Quality Gate

Recommended local validation before a PR:

```sh
pnpm -r type-check
pnpm -r lint
pnpm -r test
pnpm validate:registry
pnpm -r build
pnpm test:e2e
```

Playwright uses isolated local ports by default and builds the web app with `VITE_API_URL` pointing at the test API.

## Production deployment

Stackfast runs in production as **two independent Railway services in one Railway
project**, both deployed via the Railway CLI:

- `stackfast-api` — Node 20 Hono process, served at `https://api.stackfast.app`.
- `stackfast-web` — static Vite bundle (`apps/web/dist`), served at `https://stackfast.app`.

The two services build, redeploy, and roll back independently. The architecture
itself is decided in [ADR 003 — Deployment architecture for MVP](docs/decisions/003-deployment-architecture.md);
this section is the operator runbook for executing it. Auth and AI provider
choices are decided in [ADR 001 — Authentication strategy](docs/decisions/001-authentication-strategy.md)
and [ADR 002 — AI provider strategy](docs/decisions/002-ai-provider-strategy.md).

In production the web service calls `https://api.stackfast.app` **directly — there
is no proxy**. The local Vite `/api/*` proxy only exists in dev. This is enforced
at build time by `VITE_API_URL` and `VITE_AUTH_URL` pointing at the absolute API
origin, which is what makes the cross-origin `SameSite=None; Domain=.stackfast.app`
session cookie take effect (see ADR 003 § 4).

### Production environment variables

Set every variable below on the relevant Railway service before the first deploy.
API variables go on `stackfast-api`; the `VITE_*` variables are read by
`stackfast-web` **at build time**. Secrets live only in Railway, never in git.

| Variable | Service | Production value | Required | Provisioned by |
| --- | --- | --- | --- | --- |
| `PORT` | api | injected by Railway | yes | Railway |
| `NODE_ENV` | api | `production` | yes | Operator |
| `CORS_ORIGIN` | api | `https://stackfast.app` | yes | Operator |
| `DATABASE_URL` | api | Neon production branch pooled connection string | yes | Neon |
| `BETTER_AUTH_SECRET` | api | 32-byte random (distinct per environment) | yes | Operator |
| `BETTER_AUTH_URL` | api | `https://api.stackfast.app` | yes | Operator |
| `ALLOW_AUTH_BYPASS` | api | `false` (auth fails closed in prod) | yes | Operator |
| `GITHUB_CLIENT_ID` | api | Production GitHub OAuth app client id | yes | GitHub |
| `GITHUB_CLIENT_SECRET` | api | Production GitHub OAuth app secret | yes | GitHub |
| `ADMIN_API_KEY` | api | 32-byte random, distinct from `BETTER_AUTH_SECRET` | yes | Operator |
| `AI_PROVIDER` | api | `azure-openai` | yes | Operator |
| `AZURE_OPENAI_RESOURCE_NAME` | api | Azure Foundry resource subdomain | when provider = `azure-openai` | Azure Foundry |
| `AZURE_OPENAI_API_KEY` | api | Azure OpenAI API key | when provider = `azure-openai` | Azure Foundry |
| `AZURE_OPENAI_DEPLOYMENT` | api | Azure deployment name (e.g. `gpt-4.1`) | when provider = `azure-openai` | Azure Foundry |
| `GEMINI_API_KEY` | api | Gemini key so fallback works if Azure degrades | optional | Google |
| `UPSTASH_REDIS_REST_URL` | api | Upstash production database REST URL | required when `RATE_LIMIT_BACKEND=upstash` | Upstash |
| `UPSTASH_REDIS_REST_TOKEN` | api | Upstash production database REST token | required when `RATE_LIMIT_BACKEND=upstash` | Upstash |
| `RATE_LIMIT_BACKEND` | api | `upstash` | optional (defaults to `memory`) | Operator |
| `SENTRY_DSN` | api | prod DSN, or unset to disable | optional | Sentry |
| `SENTRY_AUTH_TOKEN` | api/web | org-scoped token for source-map upload | required for source maps | Sentry |
| `SENTRY_ORG` | api/web | Sentry org slug | required for source maps | Sentry |
| `SENTRY_PROJECT_API` | api | Sentry API project slug | required for source maps | Sentry |
| `SENTRY_PROJECT_WEB` | web | Sentry web project slug | required for source maps | Sentry |
| `RAILWAY_GIT_COMMIT_SHA` | api/web | injected by Railway (Sentry release tag) | optional | Railway |
| `VITE_API_URL` | web | `https://api.stackfast.app/api/v1` | yes | Operator (build) |
| `VITE_AUTH_URL` | web | `https://api.stackfast.app` | yes | Operator (build) |
| `VITE_SENTRY_DSN` | web | prod DSN, or unset to disable | optional | Sentry |
| `VITE_APP_RELEASE` | web | Railway commit SHA (Sentry release tag) | optional | Operator (build) |

`BETTER_AUTH_SECRET`, `ADMIN_API_KEY`, and the Upstash credentials must be distinct
from every other environment. All variables are also documented inline in
[`.env.example`](.env.example).

### Deploying with the Railway CLI

From a fresh clone, with the Railway CLI installed:

```sh
# 1. Authenticate (browser SSO round trip).
railway login

# 2. Link the repo to the existing Railway project.
railway link

# 3. Select the target environment.
railway environment production        # or: railway environment staging

# 4. Set every variable from the table above (repeat per key / per service).
railway variables set CORS_ORIGIN=https://stackfast.app --service stackfast-api
railway variables set VITE_API_URL=https://api.stackfast.app/api/v1 --service stackfast-web
# ...set the rest of the variables for each service...

# 5. Build and deploy the API. Wait for the /health check to go green.
railway up --service stackfast-api

# 6. Apply pending Drizzle migrations (one-shot, see below).
railway run --service stackfast-api -- pnpm exec tsx scripts/deploy/migrate.ts

# 7. Build and deploy the web bundle.
railway up --service stackfast-web

# 8. Attach the custom domains (or use the Railway dashboard).
railway domain add stackfast.app --service stackfast-web
railway domain add api.stackfast.app --service stackfast-api

# 9. Run the post-deploy smoke test.
pnpm exec tsx scripts/deploy/smoke.ts --base https://api.stackfast.app --web https://stackfast.app
```

Staging follows the exact same sequence with `railway environment staging` and the
staging hostnames. Because the services are independent, re-running
`railway up --service stackfast-web` leaves the API serving traffic without a
restart, and vice versa.

### Applying database migrations

Drizzle migrations run as a **one-shot Railway command against the Neon production
branch**, separate from the API start script. They are forward-only in production.

```sh
railway run --service stackfast-api -- pnpm exec tsx scripts/deploy/migrate.ts
```

`scripts/deploy/migrate.ts` waits up to 30 seconds for the database to accept
connections, applies additive (forward-only) DDL, and exits non-zero on any
failure. Pass `--dry-run` to print the pending DDL without applying it. Column
drops and renames must ship across two sequential deploys so the previous API
build stays schema-compatible (see [ADR 003](docs/decisions/003-deployment-architecture.md) § 2, § 7
and the rollback runbook).

### Rollback procedure

Each service rolls back to its immediately previous successful build via the
Railway CLI, independently of the other. The full operator runbook — including the
schema-compatibility gate for API rollbacks — is in
[`scripts/deploy/rollback.md`](scripts/deploy/rollback.md).

```sh
# Roll back the web service (always safe — static bundle, no data layer).
railway rollback --service stackfast-web --environment production

# Roll back the API service (clear the schema-compatibility gate first).
railway rollback --service stackfast-api --environment production
```

Migrations are **not** re-run on rollback. Because every schema change obeys the
two-deploy rule, a one-deploy API rollback always lands on a build that is
compatible with the current Neon schema. If a rollback target's schema expectation
conflicts with the live schema, stop and perform a manual forward-migration
intervention first — see [`scripts/deploy/rollback.md`](scripts/deploy/rollback.md).

### Architecture decision records

- [ADR 001 — Authentication strategy](docs/decisions/001-authentication-strategy.md)
- [ADR 002 — AI provider strategy](docs/decisions/002-ai-provider-strategy.md)
- [ADR 003 — Deployment architecture for MVP](docs/decisions/003-deployment-architecture.md)

## Roadmap

See `ROADMAP.md` for phase-by-phase progress and remaining deployment/MVP ship tasks.
