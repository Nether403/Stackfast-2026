# Design Document — Phase 8 Deployment

## Overview

Phase 8 turns the green-on-`main` MVP into a running deployment at `stackfast.app` + `api.stackfast.app` by executing the architecture already chosen in [ADR 003 — Deployment architecture for MVP](../../../docs/decisions/003-deployment-architecture.md). The work is predominantly additive: a new `apps/api/src/rate-limit/` module replaces the in-memory `Map` in `apps/api/src/app.ts`, new feature-flagged Sentry wiring ships on both the API and Web sides, the auth middleware is tightened so `requireSession()` fails closed with HTTP 503 in production, two Railway service manifests are added, and `.env.example` and the README gain the production variables and CLI runbook. Everything else — Hono routes, Better Auth config, the catalog, the rules engine, the blueprint pipeline, the existing CORS middleware, the Admin API key middleware, the OpenAPI doc, the Playwright suite structure — stays untouched. The design treats ADR 003 as the decision record; this document is the implementation contract that Phase 8 tasks will execute against.

The design also deliberately keeps the change set reversible in pieces: the rate-limiter migration is behind a `RATE_LIMIT_BACKEND=memory|upstash` env flag so the code can ship ahead of Upstash provisioning, and the Sentry modules are no-ops whenever `SENTRY_DSN` is falsy. This means Phase 8 tasks can be interleaved with Upstash and Sentry account provisioning without blocking the operator.

## Code layout

The table below lists every file the Phase 8 tasks touch, whether it is new or edited, and the purpose in one line. Sections 3-10 flesh each of these out.

| File | Change | Purpose |
|---|---|---|
| `apps/api/src/rate-limit/index.ts` | new | Public barrel: exports `createRateLimitMiddleware`, `rateLimitHealth`. |
| `apps/api/src/rate-limit/buckets.ts` | new | Bucket config (`generation`, `read` limits and windows). |
| `apps/api/src/rate-limit/upstash.ts` | new | Upstash-backed limiter using `@upstash/ratelimit` + `@upstash/redis`. |
| `apps/api/src/rate-limit/memory.ts` | new | Process-local limiter preserving today's behavior (kept for tests and for `RATE_LIMIT_BACKEND=memory`). |
| `apps/api/src/rate-limit/fail-open.ts` | new | Wrapper that catches any backend error, logs once, and allows the request (R4.5). |
| `apps/api/src/rate-limit/client-id.ts` | new | Pure helper extracting `x-forwarded-for` → `cf-connecting-ip` → `"local"` (R4.4). |
| `apps/api/src/observability/sentry.ts` | new | Feature-flagged `@sentry/node` init, PII scrubber, release tag. |
| `apps/api/src/app.ts` | edit | Replace `rateLimit(bucket, limit)` factory body with the new middleware; add `Sentry.setupHono()` handler attachment; tighten auth per R11. |
| `apps/api/src/index.ts` | edit | Remove the dead `rateLimitBuckets` cleanup `setInterval`; call `initSentry()` before `serve()`. |
| `apps/api/src/middleware/auth.ts` | edit | Fail closed with HTTP 503 in production regardless of `ALLOW_AUTH_BYPASS` (R11.2). |
| `apps/api/src/app.test.ts` | edit | Add cases: admin 401 before any middleware, CORS never wildcard, prod auth 503 on Better Auth init failure, rate-limit preserves count across simulated restart (via backend swap). |
| `apps/api/package.json` | edit | Add `@upstash/ratelimit`, `@upstash/redis`, `@sentry/node`. |
| `apps/web/src/lib/sentry.ts` | new | Browser `@sentry/react` init, idempotent, no-op when DSN missing. |
| `apps/web/src/main.tsx` | edit | Call `initSentry()` before `ReactDOM.createRoot`. |
| `apps/web/package.json` | edit | Add `@sentry/react`, `@sentry/vite-plugin`. |
| `apps/web/vite.config.ts` | edit | Conditionally register `sentryVitePlugin` when `SENTRY_DSN` and `SENTRY_AUTH_TOKEN` are set at build time. |
| `.env.example` | edit | Add `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, `RATE_LIMIT_BACKEND`, `SENTRY_DSN`, `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT_API`, `SENTRY_PROJECT_WEB`, `RAILWAY_GIT_COMMIT_SHA`, `VITE_SENTRY_DSN`, `VITE_APP_RELEASE`. |
| `readme.md` | edit | New "Production deployment" section covering Railway CLI, DNS, rollback, migrations, per R14. |
| `apps/api/railway.toml` | new | Railway service config for `stackfast-api` (build, start, healthcheck). |
| `apps/web/railway.toml` | new | Railway static-hosting config for `stackfast-web`. |
| `scripts/deploy/migrate.ts` | new | One-shot `drizzle-kit push` wrapper for R2.4. |
| `scripts/deploy/smoke.ts` | new | Post-deploy smoke: hits `/health`, triggers R6 rate-limit bursts, checks CORS headers. |
| `scripts/deploy/rollback.md` | new | Operator runbook for `railway rollback` per-service (R12). |
| `tests/e2e/deploy-cross-origin-auth.spec.ts` | new | Playwright cross-origin sign-in happy path. |
| `tests/e2e/deploy-rate-limit.spec.ts` | new | Playwright post-deploy rate-limit smoke. |
| `tests/e2e/deploy-health.spec.ts` | new | Playwright visibility check for `/health`. |
| `tests/e2e/deploy-admin-401.spec.ts` | new | Playwright check for admin 401 without key. |
| `apps/api/src/rate-limit/rate-limit.pbt.test.ts` | new | fast-check PBT suite for the five correctness invariants (section 8). |
| `vitest.workspace.ts` or root `vitest.config.ts` | edit if needed | Wire `fast-check` into the API package's test run. |

No package outside `apps/api`, `apps/web`, and the repo root is modified. The shared packages (`registry`, `rules-engine`, `exporter`, `ai`, `schemas`, `shared`) are untouched.


## Module boundaries and interfaces

### `apps/api/src/rate-limit/`

The existing `rateLimit(bucket, limit)` factory in `apps/api/src/app.ts` is the drop-in contract the new module preserves. That keeps `app.ts` changes surgical: only the factory body is swapped.

```ts
// apps/api/src/rate-limit/index.ts
export type BucketName = "generation" | "read";

export interface RateLimitDecision {
  allowed: boolean;
  remaining: number;
  resetAtEpochMs: number;
}

export interface RateLimitBackend {
  readonly name: "memory" | "upstash";
  check(bucket: BucketName, clientId: string): Promise<RateLimitDecision>;
}

// Drop-in replacement for the existing factory signature in app.ts.
export function createRateLimitMiddleware(
  bucket: BucketName,
  limitOverride?: number,
): MiddlewareHandler<{ Bindings: Bindings; Variables: Variables }>;

// Health probe used by the smoke test and future /health extension.
export function rateLimitHealth(): Promise<{ backend: "memory" | "upstash"; ok: boolean; error?: string }>;
```

Failure modes:

- **Upstash unreachable / 5xx / timeout** (satisfies R4.5): `fail-open.ts` swallows the error, logs `[rate-limit] upstash unavailable: <error.message>` at most once per 60 s, and returns `{ allowed: true, remaining: limit, resetAtEpochMs: now + window }`. The request proceeds.
- **Missing `UPSTASH_REDIS_REST_URL` / `_TOKEN` at startup**: `upstash.ts` refuses to construct the backend; the module logs a warning and silently falls back to the memory backend for the lifetime of the process. This covers operators who flip `RATE_LIMIT_BACKEND=upstash` before provisioning.
- **Key collision across buckets**: impossible by construction — keys are `${bucket}:${clientId}` (R4.4) and `bucket` is a compile-time literal.
- **Exempt routes**: `/health` and `/openapi.json` (R4.9) never reach the factory; they are registered before the rate-limit `app.use` calls and use distinct path prefixes.

### `apps/api/src/observability/sentry.ts`

```ts
export function initSentry(): void;          // idempotent; no-op when SENTRY_DSN is falsy
export function attachSentryToHono(app: Hono): void; // registers error handler only after init
export function scrubEvent(event: Sentry.Event): Sentry.Event; // strips `idea` / `constraints`
```

Failure modes:

- **`SENTRY_DSN` missing or empty** (R7.3): `initSentry()` returns immediately; the module exposes a sentinel `isEnabled = false`; `attachSentryToHono` becomes a no-op; no global hooks register. Tests assert that `Sentry.getCurrentHub().getClient()` remains `undefined`.
- **Double init** (R7.4): a module-level `initialized` flag guards the call; second invocation with the same args is a silent no-op. If the second invocation passes a different DSN, the second call is rejected with a warning — the first client stays active.
- **Scrub** (R7.5): `beforeSend` reads `event.request?.data` and, if it looks like a JSON body, deletes `idea` and `constraints` keys before returning the event. The original handler object is never mutated.
- **Release tag** (R7.6): reads `process.env.RAILWAY_GIT_COMMIT_SHA || process.env.SENTRY_RELEASE` and passes it as `release`. If both are unset in production, logs a warning but still inits.

### `apps/web/src/lib/sentry.ts`

```ts
export function initSentry(): void; // idempotent; no-op when import.meta.env.VITE_SENTRY_DSN is falsy
```

Same idempotence and no-op rules as the API side. Reads `import.meta.env.VITE_SENTRY_DSN` and `VITE_APP_RELEASE` so the browser bundle never sees server secrets. `apps/web/src/main.tsx` calls this before `createRoot` so React error boundaries pick up the hub.

### `apps/api/src/middleware/auth.ts` — tightened per R11

The existing `canBypassAuthForLocalDev(env)` already gates bypass on `!isProduction(env)`. R11 narrows it further: in production, `requireSession()` MUST fail closed with HTTP 503 whenever the auth subsystem is not ready, regardless of `ALLOW_AUTH_BYPASS`. The edit is a two-line guard added at the top of `requireSession`:

```ts
if (isProduction(c.env) && !auth) {
  return c.json({ error: "Authentication is not configured", requestId: c.get("requestId") }, 503);
}
```

This ordering matters: the production check runs before the bypass check so setting `ALLOW_AUTH_BYPASS=true` in prod by mistake cannot open a hole. The contract test at `app.test.ts:46` (`fails protected generation closed in production when auth is unavailable`) already covers this path and stays green.

## Configuration surface

The table consolidates every env var that exists in any environment. The "Who provisions" column names the system of record; the operator still sets the value in Railway. Cross-reference ADR 003 § 6 for the production column — this table extends it with Upstash and Sentry rows and adds the "local/staging" variants.

| Variable | Prod | Staging | Local | Required | Who provisions |
|---|---|---|---|---|---|
| `PORT` | set by Railway | set by Railway | `3000` | yes | Railway |
| `NODE_ENV` | `production` | `production` | `development` | yes | Operator (Railway) |
| `CORS_ORIGIN` | `https://stackfast.app` | `https://staging.stackfast.app` | `http://localhost:5173` | yes | Operator |
| `DATABASE_URL` | Neon prod branch pooled | Neon staging branch pooled | unset or Neon dev branch | yes in prod | Neon |
| `BETTER_AUTH_SECRET` | 32-byte random | 32-byte random (distinct) | any 32-byte random | yes | Operator |
| `BETTER_AUTH_URL` | `https://api.stackfast.app` | `https://api.staging.stackfast.app` | `http://localhost:3000` | yes | Operator |
| `ALLOW_AUTH_BYPASS` | `false` | `false` | `true` | yes (R11.1, R13.5) | Operator |
| `GITHUB_CLIENT_ID` / `_SECRET` | prod OAuth app | staging OAuth app (distinct) | dev OAuth app | yes in prod | GitHub |
| `ADMIN_API_KEY` | 32-byte random | 32-byte random (distinct) | any value for tests | yes | Operator |
| `AI_PROVIDER` | `azure-openai` | `azure-openai` or `heuristic` | `heuristic` | yes | Operator |
| `AZURE_OPENAI_RESOURCE_NAME` / `_API_KEY` / `_DEPLOYMENT` | Foundry resource | Foundry resource | unset | when provider = `azure-openai` | Azure Foundry |
| `GEMINI_API_KEY` | set for fallback | set for fallback | unset | optional | Google |
| `UPSTASH_REDIS_REST_URL` / `_TOKEN` | Upstash prod DB | Upstash staging DB | unset | required when `RATE_LIMIT_BACKEND=upstash` | Upstash |
| `RATE_LIMIT_BACKEND` | `upstash` | `upstash` | `memory` or unset | optional (defaults to `memory`) | Operator |
| `SENTRY_DSN` | prod DSN or unset | staging DSN or unset | unset | optional (R7.3) | Sentry |
| `VITE_SENTRY_DSN` | prod DSN or unset | staging DSN or unset | unset | optional | Sentry |
| `SENTRY_AUTH_TOKEN` | org-scoped auth token | org-scoped auth token | unset | required for source-map upload | Sentry |
| `SENTRY_ORG` / `SENTRY_PROJECT_API` / `SENTRY_PROJECT_WEB` | Sentry org + project slugs | same | unset | required for source-map upload | Sentry |
| `RAILWAY_GIT_COMMIT_SHA` | injected | injected | unset | optional (release tag) | Railway |
| `VITE_APP_RELEASE` | injected at build | injected at build | unset | optional | Operator (build step) |
| `VITE_API_URL` | `https://api.stackfast.app/api/v1` | staging equivalent | `/api/v1` (proxy) | yes | Operator (build step) |
| `VITE_AUTH_URL` | `https://api.stackfast.app` | staging equivalent | `/` (proxy) | yes | Operator (build step) |

`.env.example` gains entries for every new row (Upstash, Sentry, `RATE_LIMIT_BACKEND`) with short comments pointing at ADR 003. `BETTER_AUTH_SECRET` and `ADMIN_API_KEY` remain distinct values per environment (R3.5, R8.2, R13.4).

## Railway service topology

### API Service — `stackfast-api`

- **Root directory**: repo root; Railway runs pnpm from there so workspace filters resolve.
- **Build command**: `pnpm install --frozen-lockfile --filter @stackfast/api... && pnpm --filter @stackfast/api build`.
- **Start command**: `pnpm --filter @stackfast/api start`.
- **Health check path**: `/health` (R5). Railway's healthcheck polls this every 30 s; failure marks the instance unhealthy.
- **Custom domain**: `api.stackfast.app` (R9.2, R9.4) with Railway-issued TLS. HTTP-to-HTTPS redirect provided by the Railway edge (R9.5).
- **Env vars needed**: `PORT`, `NODE_ENV=production`, `CORS_ORIGIN`, `DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `ALLOW_AUTH_BYPASS=false`, `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `ADMIN_API_KEY`, `AI_PROVIDER`, `AZURE_OPENAI_*`, optional `GEMINI_API_KEY`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, `RATE_LIMIT_BACKEND=upstash`, optional `SENTRY_DSN`, `RAILWAY_GIT_COMMIT_SHA` (Railway-injected).
- **Manifest**: `apps/api/railway.toml` pins the Node 20 runtime, the build/start commands, and the healthcheck path so `railway up` is deterministic.

### Web Service — `stackfast-web`

- **Root directory**: repo root.
- **Build command**: `pnpm install --frozen-lockfile --filter @stackfast/web... && pnpm --filter @stackfast/web build`.
- **Start command**: Railway's static hosting serving `apps/web/dist`. No Node process at runtime.
- **Health check path**: `/` (the static index). A 200 on the SPA entry point is enough signal for a static bundle.
- **Custom domain**: `stackfast.app` (R9.1, R9.3) with Railway-issued TLS.
- **Env vars needed at build time**: `VITE_API_URL=https://api.stackfast.app/api/v1`, `VITE_AUTH_URL=https://api.stackfast.app`, optional `VITE_SENTRY_DSN`, `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT_WEB`, `VITE_APP_RELEASE` (set to the Railway commit SHA).
- **Manifest**: `apps/web/railway.toml`.

### Migration one-shot

Drizzle migrations run as a Railway one-shot deploy, not as part of the API start script (R2.4). The one-shot reuses the `stackfast-api` image and overrides the command to `pnpm --filter @stackfast/api exec tsx scripts/deploy/migrate.ts`. The script wraps `drizzle-kit push` (or `migrate`, once a migrations folder exists) with a 30 s connection retry loop (R2.3) and exits non-zero on any failure. The operator runs it via `railway run --service stackfast-api -- pnpm exec tsx scripts/deploy/migrate.ts` before flipping traffic; on rollback, the operator intentionally does not re-run migrations (R2.5, R12.3).

### End-to-end `railway link` → deployed story

The operator, from a fresh clone, runs:

1. `railway login` (browser round trip to Railway's SSO).
2. `railway link` inside the repo root, selecting the existing Railway project.
3. `railway environment production` (or `staging`) to select the environment.
4. Sets every env var in the table above via `railway variables set KEY=VALUE --service stackfast-api` (and `stackfast-web`). The operator scripts this with a single shell file they keep outside the repo.
5. `railway up --service stackfast-api` — builds and deploys the API. Waits for healthcheck to go green.
6. `railway run --service stackfast-api -- pnpm exec tsx scripts/deploy/migrate.ts` — applies any pending migrations against the Neon production branch.
7. `railway up --service stackfast-web` — builds and deploys the web bundle. Static hosting is live on Railway's default subdomain.
8. Attaches the custom domains via the Railway dashboard or `railway domain add` for each service (R9.3, R9.4).
9. Runs `pnpm exec tsx scripts/deploy/smoke.ts --base https://api.stackfast.app --web https://stackfast.app` to satisfy R5.4 and R6.1-R6.3.

Staging follows the exact same sequence with `railway environment staging` (R13.1).

## Data flow — cross-origin cookie round trip

When a signed-out user on `https://stackfast.app` clicks "Sign in with GitHub":

1. The SPA, via `better-auth/react`'s `signIn.social({ provider: "github", callbackURL: "https://stackfast.app" })`, issues a `POST https://api.stackfast.app/api/auth/sign-in/social` with `credentials: "include"`. The request is cross-origin; the preflight `OPTIONS` is served by Hono's `cors()` middleware returning `Access-Control-Allow-Origin: https://stackfast.app` and `Access-Control-Allow-Credentials: true` (R10.2, R10.3). No wildcard is ever emitted in production because `CORS_ORIGIN` is set to the exact origin (R10.1).
2. Better Auth responds with a 302 whose `Location` is the GitHub authorize URL. The SPA follows the redirect, landing on `https://github.com/login/oauth/authorize?...&redirect_uri=https%3A%2F%2Fapi.stackfast.app%2Fapi%2Fauth%2Fcallback%2Fgithub` (R3.1).
3. The user authorizes. GitHub redirects the browser to `https://api.stackfast.app/api/auth/callback/github?code=...`.
4. The API's Better Auth handler exchanges the code for a GitHub token, upserts the `user` / `account` / `session` rows in the Neon production branch, and responds with a 302 back to `https://stackfast.app`. The response sets the session cookie with the exact attribute tuple `Set-Cookie: better-auth.session_token=...; Domain=.stackfast.app; Path=/; Secure; HttpOnly; SameSite=None` (R3.3, R3.4). `Domain=.stackfast.app` is the critical bit — it is what lets the browser send the cookie to both origins on subsequent calls.
5. The browser lands back on `https://stackfast.app`. The SPA renders with the session cookie already stored. `useSession()` hydrates by issuing `GET https://api.stackfast.app/api/auth/get-session` with `credentials: "include"`; the browser attaches the session cookie because the request origin is `stackfast.app` and the cookie's `Domain` matches. The API reads the cookie, validates against the `session` table, and returns the user record. This is where R3.8 is satisfied end-to-end.
6. Subsequent authenticated XHRs from the SPA (`POST /api/v1/blueprints`, `POST /api/v1/scaffolds`) likewise send the cookie thanks to `credentials: "include"` (already set in `apps/web/src/lib/api-client.ts`). `requireSession()` resolves the user via `auth.api.getSession` and the handler runs.

The exact enforcement points:

- R3.3 / R3.4 cookie attributes are set by Better Auth's config. Cookie `Domain` is configured in `apps/api/src/middleware/auth.ts` via Better Auth's `advanced.crossSubDomainCookies` option, gated on `isProduction`. Local dev continues to use host-only cookies (R3.6).
- R10.2 headers are emitted by `hono/cors` keyed off `CORS_ORIGIN`. R10.3 is enforced by the middleware refusing to echo `*` when `credentials: true` is set — this is inherent to the library, asserted in contract tests.
- R3.7 (web must not proxy in prod) is enforced at build time by `VITE_API_URL` pointing at the absolute `api.stackfast.app` URL; there is no Railway-side proxy rewrite.

## Failure modes and fail-open/fail-closed matrix

| Dependency | Failure signal | Behavior | Requirement |
|---|---|---|---|
| Neon Postgres | `DATABASE_URL` unset | `requireSession()` returns 503 in prod; local dev catalog-only path still works | R11.2, R11.3 |
| Neon Postgres | connection times out on first request | retry for up to 30 s before erroring | R2.3 |
| Neon Postgres | down mid-request | 500 from the route handler; Sentry captures if enabled | implicit |
| Upstash Redis | 5xx, timeout, network error | fail-open: allow the request, log once, bucket accounting resumes on recovery | R4.5 |
| Upstash Redis | credentials missing at startup | silently fall back to memory backend for process lifetime, log warning | implicit from R4.5 / ADR 003 § 3 |
| Azure OpenAI | any error or timeout | Gemini fallback per `FallbackExplainer` wrapper | ADR 002 |
| Gemini | any error or timeout | heuristic fallback per `FallbackExplainer` wrapper | ADR 002 |
| Sentry | DSN missing | `initSentry()` is a no-op; no transport registered | R7.3 |
| Sentry | transport failure at runtime | swallowed by the SDK; request path unaffected | ADR 003 § 5 |
| GitHub OAuth | callback hits closed client | Better Auth returns 4xx; SPA shows sign-in error; no partial session is persisted | implicit |
| Better Auth init | throws at construction | `requireSession()` returns 503 in prod on every call; R11.4 |
| Admin API key | missing / mismatched | 401 before any downstream middleware; Rate Limiter and handlers never run | R8.1, R8.3, R8.5 |

The matrix is the single source of truth for what "down" means per dependency. Every row corresponds to at least one testable assertion in section 8.


## Testing strategy

The strategy maps each requirement to a layer: pure unit, Hono contract (the existing `apps/api/src/app.test.ts` suite stays green and gains new cases), property-based (fast-check), Playwright E2E, and a post-deploy smoke script. The property-based tests will run with the standard property-testing warning flagged by the test harness — noted explicitly below.

### Unit tests (Vitest)

Lives in-package. New files sit next to the code they cover.

- `apps/api/src/rate-limit/buckets.test.ts` — pure functions: bucket names, window ms, limit values. Satisfies R4.2, R4.3.
- `apps/api/src/rate-limit/client-id.test.ts` — header resolution order (`x-forwarded-for` → `cf-connecting-ip` → `"local"`). Satisfies R4.4.
- `apps/api/src/rate-limit/fail-open.test.ts` — injects a backend whose `check()` rejects; asserts the middleware calls `next()` and logs once. Satisfies R4.5.
- `apps/api/src/rate-limit/memory.test.ts` — deterministic in-process accounting, `resetAt` rollover. Regression net for the code path that existing contract tests still exercise.
- `apps/api/src/observability/sentry.test.ts` — three branches: DSN unset (no-op, no transport registered), DSN set (one `Sentry.init` call, release matches `RAILWAY_GIT_COMMIT_SHA`), double-init (still one client). PII scrubber removes `idea` / `constraints` fields from a crafted event payload. Satisfies R7.3, R7.4, R7.5, R7.6.
- `apps/web/src/lib/sentry.test.ts` — same DSN-unset and idempotence coverage on the browser side. Satisfies R7.3, R7.4 (web).

Modules needing mocks:

- `@upstash/redis` — mocked wholesale in `fail-open.test.ts` and in the PBT suite. The real client is exercised only by the post-deploy smoke script.
- `@sentry/node` and `@sentry/react` — imported normally, but every assertion reads `Sentry.getCurrentHub().getClient()` so no network call is ever made.
- `better-auth` — not mocked; the existing test setup clears `DATABASE_URL` so Better Auth simply is not initialized.

Vitest config: API tests keep using `apps/api/vitest.config.ts` and the existing `test-setup.ts` file, which is already safe for PBT runs because it clears all secrets before each file.

### Contract tests (Hono `app.request` — `apps/api/src/app.test.ts`)

The existing 40+ cases stay green. New cases added:

- **Admin 401 before any downstream middleware runs.** Send `POST /admin/tools/import` without any header and assert status 401 AND that no rate-limit counter was incremented (via backend fake). Satisfies R8.1.
- **CORS never wildcard in prod.** Call any `GET /api/v1/*` path with `NODE_ENV=production` and `CORS_ORIGIN=https://stackfast.app`, asserting `access-control-allow-origin` equals the exact origin for a matching `Origin` header and is absent for a non-matching one. Satisfies R10.3, R10.4.
- **Prod auth 503 when Better Auth init fails.** Force `getAuth()` to throw (temporary monkey-patch), call `POST /api/v1/blueprints` with `NODE_ENV=production`, expect 503. Satisfies R11.4.
- **Rate-limit bucket counts survive restart.** With `RATE_LIMIT_BACKEND=upstash` and an in-memory fake Upstash, issue 20 generation requests, swap the middleware's backend instance (simulating a restart), issue 11 more, expect the 31st to 429. Satisfies R6.4.
- **Exempt routes.** `/health` and `/openapi.json` never consume a bucket token — assert the fake backend recorded zero calls for those paths. Satisfies R4.9.
- **Retry-After only on 429.** `Retry-After` is present on 429 responses and absent on 200/401 responses. Satisfies R4.7, R4.8.

### Property-based tests (fast-check)

> Any PBT code added here will be flagged by the test harness and run with the property-testing warning. The five properties below cover the correctness invariants called out in the requirements intro (fail-open limiter, Sentry init idempotence + no-op, CORS never wildcard, admin-key gating, fail-closed auth in prod).

File: `apps/api/src/rate-limit/rate-limit.pbt.test.ts` (plus a sibling `apps/api/src/observability/sentry.pbt.test.ts` for Sentry properties).

**Property 1 — Upstash failures never produce a 429 (fail-open).**
- Plain English: for any sequence of requests against a backend that sometimes throws, the middleware never returns HTTP 429 when the throw occurred for that specific request.
- fast-check generator: `fc.array(fc.record({ shouldThrow: fc.boolean(), bucket: fc.constantFrom("generation", "read"), clientId: fc.webSegment() }), { maxLength: 200 })`.
- Oracle: replay the sequence through `createRateLimitMiddleware` with a stubbed backend whose `check()` throws iff `shouldThrow` is true. Assert that for every indexed request where `shouldThrow` was true, the response status is in `{200, 401, 404}` and is never 429.
- Edge cases / shrinking targets: empty sequence, single throw, all throws, alternating throw patterns. fast-check will shrink toward the minimum sequence length that violates the invariant if the fail-open wrapper is buggy.

**Property 2 — Sentry init is idempotent and a no-op without DSN.**
- Plain English: for any interleaving of `initSentry()` calls and any combination of DSN presence/absence, the active Sentry client count is 0 when DSN is falsy and exactly 1 when DSN is set at least once.
- fast-check generator: `fc.array(fc.oneof(fc.constant("init"), fc.record({ kind: fc.constant("set-dsn"), dsn: fc.option(fc.webUrl()) })), { maxLength: 20 })`.
- Oracle: after each event, `Sentry.getCurrentHub().getClient()` is defined iff at least one `set-dsn` has provided a non-empty URL before the most recent `init`, and `hub.getClient()` returns the same reference across repeat inits.
- Edge cases: DSN set then cleared then `init` — expected no-op (R7.3); multiple inits with same DSN — expected single client (R7.4). Shrinks toward a 2-step sequence showing the double-init bug.

**Property 3 — CORS never echoes `*` with credentials in production.**
- Plain English: for any request Origin header and any configured `CORS_ORIGIN` value, the response's `Access-Control-Allow-Origin` is either exactly `CORS_ORIGIN` or absent, and `Access-Control-Allow-Credentials` is `true` whenever `ACAO` is present.
- fast-check generator: `fc.record({ configuredOrigin: fc.constantFrom("https://stackfast.app", "https://staging.stackfast.app"), requestOrigin: fc.option(fc.webUrl()), method: fc.constantFrom("GET", "POST", "OPTIONS") })`.
- Oracle: issue `app.request` with the generated `Origin` and `CORS_ORIGIN=configuredOrigin, NODE_ENV=production`. Assert: `acao` is never the literal `*`; if `acao` is set it equals `configuredOrigin`; if `acao` is set, `acac` is `true`.
- Edge cases: missing Origin, mismatched Origin, preflight `OPTIONS`, Origin equal to `null`. Shrinks toward a `requestOrigin` that would lure a buggy CORS config into echoing.

**Property 4 — Admin key gating precedes every other middleware.**
- Plain English: for any path under `/admin/*` or `/internal/*` and any header combination, a missing or mismatched key results in status 401 AND no rate-limit token was consumed AND no handler was invoked.
- fast-check generator: `fc.record({ path: fc.constantFrom("/admin/tools/import", "/admin/compatibility/recompute", "/internal/enrich-tool"), providedKey: fc.option(fc.string({ minLength: 1, maxLength: 40 })), configuredKey: fc.string({ minLength: 1, maxLength: 40 }), headerStyle: fc.constantFrom("x-admin", "bearer", "none") })`.
- Oracle: assert `status === 401` whenever `providedKey !== configuredKey`; assert the rate-limit backend fake recorded zero calls for those 401 runs; assert the handler sentinel (a per-test counter wired into each admin route) was not incremented. Conversely, `providedKey === configuredKey` via either header style yields status in `{200, 202}` and increments the handler counter. Satisfies R8.1, R8.3, R8.4, R8.6.
- Edge cases: empty configured key (R8.5 — must 401 every time regardless of provided key), case variants of `Bearer`, prefix/suffix whitespace. Shrinks toward `providedKey=""` and empty configured key.

**Property 5 — Production auth fails closed whenever the auth subsystem is not ready.**
- Plain English: in `NODE_ENV=production`, a request to any `requireSession()`-wrapped route returns 503 whenever `auth` is not initialized or its init threw, regardless of `ALLOW_AUTH_BYPASS`.
- fast-check generator: `fc.record({ allowBypass: fc.constantFrom("true", "false", undefined), databaseUrlPresent: fc.boolean(), authInitThrows: fc.boolean(), route: fc.constantFrom("/api/v1/blueprints", "/api/v1/scaffolds") })`.
- Oracle: `status === 503` whenever `!databaseUrlPresent || authInitThrows`, regardless of `allowBypass`. If `databaseUrlPresent && !authInitThrows`, status is 401 for a missing session (because the real session check will reject the unauthenticated call). Satisfies R11.2, R11.3, R11.4.
- Edge cases: `allowBypass="true"` in production — must still 503; `ALLOW_AUTH_BYPASS` unset — must still 503; route variants to exercise both `requireSession()` registrations. Shrinks toward the minimal configuration that leaks.

### End-to-end (Playwright — `tests/e2e/`)

New files under the existing `tests/e2e/` directory, registered automatically by `playwright.config.ts` because it globs `./tests/e2e`:

- `deploy-cross-origin-auth.spec.ts` — happy path for R3.8. Drives a headless Chromium against a Playwright-managed two-origin environment. It does NOT hit the real GitHub — it stubs the OAuth round trip via `page.route("**/github.com/**", ...)`. The test asserts the session cookie is readable on both `stackfast.app` and `api.stackfast.app` origins (via `page.context().cookies()`), and that a subsequent `fetch('/api/v1/blueprints', { credentials: 'include' })` from the SPA origin receives a non-401 response.
- `deploy-rate-limit.spec.ts` — satisfies R6.1, R6.2, R6.3 against the local test deployment. Fires 31 POSTs to `/api/v1/blueprints` from a fixed `x-forwarded-for` and asserts the last status is 429 with a `Retry-After` header; fires 101 GETs against `/api/v1/tools/search` and asserts the 101st is 429. Uses the in-memory backend in this E2E pass — the Upstash path is covered by the post-deploy smoke script.
- `deploy-health.spec.ts` — satisfies R5.1, R5.3. Hits `/health` from an unauthenticated client and asserts `status === 200 && body === "OK"`. Also asserts the response does NOT require cookies.
- `deploy-admin-401.spec.ts` — satisfies R8.1, R8.3. Hits `/admin/compatibility/recompute` and `/internal/enrich-tool` with no headers, with a wrong `X-Admin-API-Key`, and with a wrong `Bearer` token, asserting 401 on every variant and a correct 202 on the matching key.

### Deploy smoke

`scripts/deploy/smoke.ts` is a standalone TypeScript script runnable as `pnpm exec tsx scripts/deploy/smoke.ts --base <api-url> --web <web-url>`. It implements:

- R5.4 — `GET ${base}/health` and records status + body in the smoke report.
- R6.1 — 31 `POST ${base}/api/v1/blueprints` from a fixed IP; asserts the 31st returns 429.
- R6.3 — 101 `GET ${base}/api/v1/tools/search`; asserts 429.
- R8.3 — `POST ${base}/admin/compatibility/recompute` with a wrong key; asserts 401.
- R10.2 — `OPTIONS ${base}/api/v1/tools/search` with `Origin: ${web}`; asserts exact-match ACAO.
- R10.3 — `OPTIONS ${base}/api/v1/tools/search` with `Origin: https://evil.example`; asserts absent or non-matching ACAO.

The script exits 0 on full pass, non-zero otherwise, and prints a one-line JSON summary for the operator's runbook. It does not depend on Playwright; it runs anywhere Node 20 runs.


## Migration plan for the rate limiter

The replacement of the in-memory `Map` is staged so each step is independently deployable and reversible. The feature flag `RATE_LIMIT_BACKEND=memory|upstash` (default `memory`) gates the switch.

1. **Ship the new module with the memory backend as default.** Add `apps/api/src/rate-limit/` with `memory.ts`, `fail-open.ts`, `client-id.ts`, `buckets.ts`, and `index.ts`. `createRateLimitMiddleware(bucket)` reads `process.env.RATE_LIMIT_BACKEND`; absent or `memory` picks `memory.ts`, which preserves today's exact behavior. `apps/api/src/app.ts` replaces the inline `rateLimit(bucket, limit)` factory body with a one-liner that calls `createRateLimitMiddleware(bucket, limit)`. `apps/api/src/index.ts` removes the dead `setInterval` cleanup because the memory backend does its own lazy rollover per request. Existing contract tests stay green because the observable behavior is identical. This ship is deployable with zero new env vars.
2. **Provision Upstash Redis.** Operator creates a database in Upstash, copies `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` into Railway. No code change required.
3. **Flip the flag in staging.** Set `RATE_LIMIT_BACKEND=upstash` on `stackfast-api` staging. Run the Playwright and smoke suites; verify that a forced 503 on Upstash (simulated by a bad URL) yields fail-open behavior per Property 1.
4. **Flip the flag in production.** Same one env var change. Roll back to memory by flipping the variable back — no deploy needed (Railway restarts the instance on env var change, which takes seconds).
5. **Sunset the memory backend.** Deferred to a follow-up once the Upstash path has soaked in production for a release cycle. The backend stays present for tests (`@stackfast/api`'s Vitest suite and the PBT fail-open property both need a deterministic backend).

This gives the operator four independently-reversible steps; no single action is irreversible, and the rate-limit outage blast radius at each step is bounded.

## Rollback, observability, and runbook notes

The design introduces the following operational knobs, each of which the Task phase will turn into a checklist item.

- **Per-service rollback** (R12.1, R12.2, R12.6, R12.7): `scripts/deploy/rollback.md` documents `railway rollback --service stackfast-api` and `railway rollback --service stackfast-web`. Web rollbacks are always safe (static bundle). API rollbacks are only safe when the schema is compatible — the runbook tells the operator to verify the rollback target's migration expectations against the current Neon branch before running (R12.3, R12.4).
- **Schema compatibility rule** (R2.6, R2.7): column drops and renames ship in two sequential deploys. The first deploy adds the new column and keeps reading both; the second deploy removes the old column. This is a process rule the runbook states — the Phase 8 tasks do not introduce tooling to enforce it automatically; that is a v1.x candidate.
- **Rate-limit feature flag** (section 9): the runbook documents both `RATE_LIMIT_BACKEND` values and how to flip them.
- **Sentry feature flag** (R7.3): documented as "unset the DSN to disable" in the runbook. There is no code path difference between "never enabled" and "disabled after being enabled" — both result in no transport.
- **Health-check evidence** (R5.4): the smoke script captures status and body into a timestamped file in `test-results/deploy-smoke-<timestamp>.json`. Operator attaches this to the deploy PR as verification.
- **Log signals** (R4.5): the fail-open wrapper emits `[rate-limit] upstash unavailable: ...` on degrade and `[rate-limit] upstash recovered` on the next successful check. Operator watches these in Railway's log stream.
- **Request ID propagation**: today's `X-Request-ID` middleware is untouched. Sentry is configured to read `request.headers['x-request-id']` and tag the event with it so log lines and Sentry events correlate.

## Open questions

None remaining. The three questions surfaced during drafting have been resolved:

1. **Staging DNS subdomain.** Decision: `staging.stackfast.app` + `api.staging.stackfast.app`. Shared `Domain=.stackfast.app` keeps Better Auth's cookie config single-branch, which is consistent with the production setup. The alternative (`stackfast-staging.app` or similar) would force a second cookie-domain branch for marginal isolation benefit.
2. **Migration tool command.** Decision: `drizzle-kit push` for Phase 8. The repo has no `drizzle/` migrations folder yet, and inventing one just to run `drizzle-kit migrate` adds process weight without value. `scripts/deploy/migrate.ts` wraps `push` with the 30-second connection-retry loop (R2.3). Promote to `drizzle-kit migrate` when the first real migration history appears (likely a feature-driven schema change post-MVP).
3. **Retry-After on exempt routes.** Decision: `/health` and `/openapi.json` are registered before the rate-limit `app.use` calls, so they never reach the rate-limit middleware, never consume a token, and never produce a `Retry-After`. R4.8 is satisfied by construction.
