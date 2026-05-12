# Stackfast 2026

Stackfast 2026 is a pnpm TypeScript monorepo for building, validating, and exporting modern application stacks. It combines a curated tool registry, compatibility rules, idea-to-stack blueprint generation, migration planning, and scaffold export flows.

## Current Status

- Monorepo scaffold is complete.
- Core packages compile and test successfully.
- API contract tests cover the public MVP API surface.
- Registry validation passes for the expanded catalog.
- Playwright E2E tests cover the primary MVP flows.
- Deployment work is still pending.

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
| `AI_PROVIDER` | `heuristic`, `gemini`, or `openai` |
| `GEMINI_API_KEY`, `OPENAI_API_KEY` | Optional AI provider keys |
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

## Deployment Notes

Phase 8 deployment is still pending. Before production deployment:

- Replace in-memory rate limiting with a distributed backend such as Redis/Upstash.
- Provision Neon Postgres and configure `DATABASE_URL`.
- Configure Better Auth and GitHub OAuth callback URLs.
- Set production `CORS_ORIGIN`, `BETTER_AUTH_URL`, `VITE_API_URL`, and `VITE_AUTH_URL`.
- Configure `ADMIN_API_KEY` and AI provider secrets.
- Add error tracking such as Sentry.

## Roadmap

See `ROADMAP.md` for phase-by-phase progress and remaining deployment/MVP ship tasks.
