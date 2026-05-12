# ADR 003 — Deployment architecture for MVP

**Status:** Accepted
**Date:** 2026-05-12

## Context

Phases 0-7 produced a working monorepo with a green quality gate locally.
Phase 8 is the first time Stackfast runs in production, which means every
piece of operational infrastructure (hosting, database, OAuth callbacks,
rate-limit backend, error tracking, DNS) has to be picked and wired
together. This ADR captures those decisions so Phase 8 execution is
mechanical rather than design-on-the-fly.

### What we already know

- **Monorepo shape:** `apps/api` (Hono on Node), `apps/web` (Vite + wouter
  + React 18), six shared packages.
- **Database:** Neon Postgres. See ADR 001 — auth data lives in our own
  Postgres via Better Auth.
- **Auth:** Better Auth with GitHub OAuth (ADR 001). Cookies are
  `SameSite=Lax` by default; cross-origin cookies require `Secure` +
  `SameSite=None` and matching `allowedOrigins`.
- **AI:** Azure OpenAI primary, Gemini fallback, heuristic ultimate
  fallback (ADR 002). Keys are long-lived, not user-specific.
- **Rate limiting today:** in-memory `Map`, single-process, reset on
  restart. `apps/api/src/index.ts` tags this with
  `TODO Phase 8: Replace with Upstash/Redis-backed rate limiting`.
- **Registry:** Static JSON bundled with the API and web apps; no
  runtime CMS. Changes require a redeploy.
- **Scale we care about for MVP:** tens of users, not thousands. No
  multi-region requirement.
- **Operator tooling:** Railway is already connected to the operator's
  account via the Railway CLI, which sets the default expectation that
  `railway up` / `railway link` drive deploys.

### Non-goals for MVP

- Zero-downtime blue/green deploys.
- Multi-region failover.
- Custom CDN.
- Self-hosting. Stackfast is a single-operator hobby/tool deployment.

## Decision

### 1. Hosting: split web + API, both on Railway

Two services in one Railway project:

| Service | Runtime | Build | Start |
|---|---|---|---|
| `stackfast-api` | Node 20 | `pnpm install --filter @stackfast/api... && pnpm --filter @stackfast/api build` | `pnpm --filter @stackfast/api start` |
| `stackfast-web` | Static | `pnpm install --filter @stackfast/web... && pnpm --filter @stackfast/web build` | Serve `apps/web/dist` via Railway's static hosting |

Domains:

- `https://stackfast.app` → web
- `https://api.stackfast.app` → API

#### Why split vs monolith

A single Node process serving both HTML and the API would work, but:

1. The web app is fully static after `vite build`. Serving it from a
   Node process wastes the runtime for no benefit and makes cache
   headers harder to tune.
2. Split means the web can be redeployed without cycling the API and
   vice versa. Easier rollbacks.
3. The auth cookie story is simpler than it looks: see the cookie
   strategy section below.

#### Why Railway vs Vercel/Fly/Render

- **Railway:** Supports long-running Node processes, keeps Docker out of
  the common case, free tier is enough for MVP traffic. Operator is
  already on Railway with the CLI connected.
- **Vercel:** Great for the web side, but the API is Hono on Node with
  persistent state (the rate-limit cache) and needs full Node runtime,
  not edge functions. Could split Vercel (web) + Railway (API) but that
  doubles the surface area for a cookie story that's already the
  trickier part of this deploy.
- **Fly.io:** Good fit technically, but it adds a Docker + Fly CLI
  learning curve. Defer to v1.x if we ever need multi-region.
- **Render:** Viable alternative, functionally similar to Railway.
  Railway wins on prior operator familiarity.

### 2. Database: Neon Postgres (pre-existing)

- **Production branch:** `main`, auto-suspend off or set to a long
  window so cold starts don't hit user-facing requests.
- **Staging branch:** `staging`, provisioned from `main` for pre-release
  testing. Auto-suspend aggressively.
- **Preview branches:** Not in MVP. Good candidate for v1.x once PR
  preview environments are wired up.
- **Migrations:** Drizzle Kit generates SQL; Railway runs `drizzle-kit
  push` via a one-shot deploy command, not in the container start
  script.

### 3. Rate limiting backend: Upstash Redis

Replace the in-memory `Map` in `apps/api/src/app.ts` with a
[sliding-window counter](https://github.com/upstash/ratelimit) backed by
Upstash Redis REST.

- **Buckets:** generation = 30/min, reads = 100/min (unchanged from
  today).
- **Key format:** `{bucket}:{clientId}` where `clientId` is the IP or
  `cf-connecting-ip`.
- **Client:** `@upstash/ratelimit` + `@upstash/redis`.
- **Failure mode:** if Upstash is unavailable, fail **open** (log a
  warning, allow the request). For MVP the wrong answer is blocking
  legitimate users during a transient Redis outage, not letting a
  spike through for a few minutes.

#### Why Upstash vs Railway-hosted Redis

- **Upstash:** REST API is usable from serverless and long-running
  processes identically, generous free tier, no connection-pool
  management, designed for exactly this workload.
- **Railway Redis:** Closer to the app but introduces a persistent TCP
  connection pool from a single Node process — not incorrect, just more
  moving parts. Pick this only if Upstash pricing stops making sense.

### 4. Cookie and CORS strategy

The web app calls the API cross-origin (`stackfast.app` →
`api.stackfast.app`). Better Auth cookies must flow:

- **Cookie attributes in prod:** `Secure; HttpOnly; SameSite=None`.
- **Cookie domain:** `.stackfast.app` so both subdomains share it.
- **API CORS config:** `origin: "https://stackfast.app"`, `credentials:
  true`. No wildcard. The Hono CORS middleware is already configured
  this way via `CORS_ORIGIN`; just needs the prod value set.
- **Web `VITE_API_URL`:** `https://api.stackfast.app/api/v1`.
- **Better Auth `baseURL`:** `https://api.stackfast.app`.
- **GitHub OAuth callback:**
  `https://api.stackfast.app/api/auth/callback/github` (must match the
  GitHub OAuth app's registered callback).

Dev continues to use Vite's same-origin proxy (`/api` → `localhost:3000`)
so local cookies Just Work without `SameSite=None`.

### 5. Error tracking: Sentry (kept, low priority)

Sentry is the chosen tool if we enable error tracking, but it's
explicitly not a hard MVP requirement. The operator is keeping it in
scope to avoid revisiting the decision when something eventually
breaks in production.

- **API:** `@sentry/node` with tracing disabled for MVP (just error
  capture). Release = Git SHA injected by Railway.
- **Web:** `@sentry/react` with the Vite source-map plugin so stack
  traces resolve.
- **PII:** Off. Do not forward request bodies. Scrub `idea` and
  `constraints` fields before send.
- **Sample rate:** 1.0 for errors, 0.0 for traces.
- **Feature flag:** Wiring guarded by `SENTRY_DSN` presence — if the env
  var is missing, Sentry init is a no-op. This lets us ship the wiring
  without forcing the operator to sign up immediately.

### 6. Secrets and config

All secrets live in Railway's environment variables, not in git. The
`.env.example` at the repo root lists every variable that exists in any
environment. The production values are:

| Variable | Where |
|---|---|
| `PORT` | Set by Railway |
| `NODE_ENV` | `production` |
| `CORS_ORIGIN` | `https://stackfast.app` |
| `DATABASE_URL` | Neon production branch pooler |
| `BETTER_AUTH_SECRET` | 32-byte random, generated per deploy env |
| `BETTER_AUTH_URL` | `https://api.stackfast.app` |
| `ALLOW_AUTH_BYPASS` | `false` (fail closed in prod) |
| `GITHUB_CLIENT_ID` / `_SECRET` | Prod GitHub OAuth app |
| `ADMIN_API_KEY` | 32-byte random |
| `AI_PROVIDER` | `azure-openai` |
| `AZURE_OPENAI_*` | From the Foundry resource |
| `GEMINI_API_KEY` | Set so fallback works if Azure degrades |
| `UPSTASH_REDIS_REST_URL` / `_TOKEN` | From Upstash console |
| `SENTRY_DSN` | Optional; present = Sentry enabled |

Staging mirrors production with its own Neon branch, its own GitHub
OAuth app, its own secrets.

### 7. Rollback strategy

- **Web:** Railway keeps the previous build; "Rollback" button or
  `railway rollback`. The web is fully static so a rollback has no
  data-layer implications.
- **API:** Same Railway rollback, plus a hard rule that any migration
  that drops or renames a column ships in two phases across two
  deploys so we can roll back one deploy without touching schema.
- **Schema:** Drizzle migrations are forward-only in production.
  Rolling back a destructive migration means writing a new migration
  that undoes it, not re-running old DDL.

### 8. What we are explicitly not doing

- Not running a custom CDN (Railway fronts the web app; that's fine for
  MVP).
- Not using Railway's Postgres (we're on Neon).
- Not setting up status-page tooling. A Sentry Slack notification, if
  Sentry is enabled, is enough for a single operator.
- Not adding APM / distributed tracing.
- Not configuring WAF rules beyond Railway's defaults.

## Consequences

**Positive**

- Clear, reproducible production setup that a single operator can run
  via the Railway CLI.
- Secrets and config are boring env vars; no secret manager complexity.
- Rate limiting becomes correct for multi-instance (though we only run
  one instance for MVP, this unblocks future horizontal scale for
  free).
- Cookie story is testable: same origin in dev, cross-origin with
  explicit `SameSite=None` in prod.
- Two services we can redeploy independently.

**Negative**

- Three SaaS dependencies in the hot path (Railway, Neon, Upstash) plus
  Azure OpenAI for AI and optionally Sentry. Each is a failure mode.
  Mitigated by the heuristic AI fallback and fail-open rate limiting.
- Cross-origin cookie config is fiddlier than monolith hosting and has
  historically been a source of bugs. Mitigated by explicit dev/prod
  configs and E2E tests that exercise auth.
- DNS mistakes can bite. Mitigated by using subdomain routing
  (`stackfast.app` + `api.stackfast.app`) instead of path-based routing,
  which is easier to reason about.

## Implementation notes (for the Phase 8 spec)

The Phase 8 spec will turn each of these sections into concrete tasks.
High-level phases for that spec:

1. **Infrastructure setup** — Railway project, services, domains,
   driven via `railway up` / `railway link`.
2. **Database** — Neon production branch, connection string, pooler.
3. **Auth** — Production GitHub OAuth app, Better Auth config, cookie
   domain.
4. **Rate limiting** — Upstash provisioning, `@upstash/ratelimit`
   integration, replace the in-memory `Map`.
5. **AI** — Azure OpenAI secrets, Gemini fallback key.
6. **Error tracking** — Sentry project, SDK wiring behind `SENTRY_DSN`
   feature flag, source map upload.
7. **Smoke tests** — Health check, blueprint generation, OAuth
   round-trip, rate-limit behavior.
8. **Cutover** — DNS, README update, done.

## Referenced ADRs

- ADR 001 — Authentication strategy
- ADR 002 — AI provider strategy
