# Phase 8 Deployment — Tasks

## How to use this document

This file is consumed by the `spec-task-execution` sub-agent one task at a time. Each task is self-contained: a short title, a one- or two-sentence description, the acceptance criteria (R-IDs from [`requirements.md`](./requirements.md)), the files touched (from [`design.md`](./design.md) § 2), a verification line, and an explicit dependency list. Tasks are dependency-ordered: when starting a batch, pick the lowest-numbered task whose dependencies are all closed and execute it end-to-end before moving on.

Tags used below:

- `[docs]` — pure documentation change; no code quality gate required.
- `[external]` — requires an external provisioning action (Railway, Neon, Upstash, Sentry, GitHub, DNS). Operator drives; no code lands.
- `[pbt]` — adds or runs property-based tests; the test harness will surface its property-testing warning and the run is slower than a normal unit test.

Design cross-references: [§ 2 Code layout](./design.md#code-layout), [§ 8 Testing strategy](./design.md#testing-strategy), [§ 9 Migration plan for the rate limiter](./design.md#migration-plan-for-the-rate-limiter), and [ADR 003](../../../docs/decisions/003-deployment-architecture.md).

---

## Batch A — Rate limiter module (memory backend default)

- [ ] **A1** Add bucket config and client-id helpers
  - Description: Create the pure helpers that underpin every backend — `BucketName` type, per-bucket limit + window constants, and the header-resolution function that returns the client id.
  - Files: `apps/api/src/rate-limit/buckets.ts` (new), `apps/api/src/rate-limit/client-id.ts` (new), `apps/api/src/rate-limit/buckets.test.ts` (new), `apps/api/src/rate-limit/client-id.test.ts` (new).
  - Acceptance criteria: R4.2, R4.3, R4.4.
  - Verification: unit tests assert `generation = 30/60s`, `read = 100/60s`, and header precedence `x-forwarded-for → cf-connecting-ip → "local"`; `pnpm --filter @stackfast/api test` passes.
  - Dependencies: none.

- [ ] **A2** Add memory backend
  - Description: Port today's in-`Map` accounting behind the `RateLimitBackend` interface so the existing contract tests stay green and tests have a deterministic backend.
  - Files: `apps/api/src/rate-limit/memory.ts` (new), `apps/api/src/rate-limit/memory.test.ts` (new).
  - Acceptance criteria: preserves the observable behavior asserted by the existing `rate limits generation endpoints` case in `apps/api/src/app.test.ts`; regression net for R4.2, R4.3.
  - Verification: unit tests cover lazy rollover at `resetAt`, cross-bucket key isolation, and per-client isolation; `pnpm --filter @stackfast/api test` passes.
  - Dependencies: A1.

- [ ] **A3** Add fail-open wrapper
  - Description: Wrap any backend so `check()` errors are swallowed, logged at most once per 60s, and the request is allowed through (R4.5).
  - Files: `apps/api/src/rate-limit/fail-open.ts` (new), `apps/api/src/rate-limit/fail-open.test.ts` (new).
  - Acceptance criteria: R4.5.
  - Verification: unit tests inject a backend whose `check()` rejects; assert the middleware calls `next()`, emits exactly one `[rate-limit] upstash unavailable` log inside a 60s window, and restores normal accounting on the next successful check.
  - Dependencies: A1, A2.

- [ ] **A4** Add Upstash backend (module only, no env wiring yet)
  - Description: Implement `@upstash/ratelimit` + `@upstash/redis` sliding-window counter behind the `RateLimitBackend` interface. Do not switch `apps/api/src/app.ts` to it yet — the factory in A6 picks the backend from `RATE_LIMIT_BACKEND`.
  - Files: `apps/api/src/rate-limit/upstash.ts` (new), `apps/api/src/rate-limit/upstash.test.ts` (new), `apps/api/package.json` (edit: add `@upstash/ratelimit`, `@upstash/redis`).
  - Acceptance criteria: R4.1, R4.6.
  - Verification: unit tests mock `@upstash/redis`, assert that missing `UPSTASH_REDIS_REST_URL` / `_TOKEN` causes the factory to refuse construction (silently falling back to memory per design § 9), and that a successful response returns a `RateLimitDecision` whose `resetAtEpochMs` matches the window. `pnpm --filter @stackfast/api test` passes.
  - Dependencies: A1, A3.

- [ ] **A5** Add property-based test suite for the rate limiter `[pbt]`
  - Description: Add the fast-check suite covering Property 1 from design § 8 — "Upstash failures never produce a 429 (fail-open)". This is the rate-limit PBT file; the Sentry PBT (Property 2) lands in B2 and the app-level PBTs (Properties 3–5) land in C2 and alongside them.
  - Files: `apps/api/src/rate-limit/rate-limit.pbt.test.ts` (new), root Vitest wiring if fast-check is not yet registered: `apps/api/package.json` (edit: add `fast-check` devDependency).
  - Acceptance criteria: R4.5 (as a property, not just the unit test from A3).
  - Verification: fast-check suite runs for the generator in design § 8 Property 1; every indexed request whose injected backend threw has final status in `{200, 401, 404}` and never `429`. Note that the test harness will flag the property-testing warning on this run.
  - Dependencies: A3, A4.

- [ ] **A6** Wire the new factory into the app and tighten contract tests
  - Description: Replace the inline `rateLimit(bucket, limit)` factory body in `apps/api/src/app.ts` with a call to `createRateLimitMiddleware(bucket, limit)` (default backend = memory via `RATE_LIMIT_BACKEND`). Delete the dead `rateLimitBuckets` export and the `setInterval` cleanup in `apps/api/src/index.ts` — the memory backend rolls over lazily per request (design § 9 step 1). Add the four contract test cases named in design § 8.
  - Files: `apps/api/src/app.ts` (edit: swap factory body, drop `rateLimitBuckets` export), `apps/api/src/index.ts` (edit: remove `setInterval` and the stale-key cleanup TODO), `apps/api/src/app.test.ts` (edit: add cases `admin 401 before rate-limit counter increments`, `Retry-After only on 429`, `exempt routes never counted`, `bucket count survives backend swap`), `apps/api/src/rate-limit/index.ts` (new: public barrel exporting `createRateLimitMiddleware`, `rateLimitHealth`).
  - Acceptance criteria: R4.1, R4.7, R4.8, R4.9, R6.4, R8.1.
  - Verification: `pnpm --filter @stackfast/api test` passes with the four new contract cases green; existing `rate limits generation endpoints` test stays green; `pnpm --filter @stackfast/api type-check` + `lint` + `build` stay green.
  - Dependencies: A1, A2, A3, A4, A5.

---

## Batch B — Sentry wiring behind `SENTRY_DSN`

- [ ] **B1** Add API Sentry module (init, scrubber, attach helper)
  - Description: Add `apps/api/src/observability/sentry.ts` exposing `initSentry()`, `attachSentryToHono(app)`, and `scrubEvent(event)`. Module is a no-op whenever `SENTRY_DSN` is falsy and idempotent across repeat calls.
  - Files: `apps/api/src/observability/sentry.ts` (new), `apps/api/src/observability/sentry.test.ts` (new), `apps/api/package.json` (edit: add `@sentry/node`).
  - Acceptance criteria: R7.1, R7.3, R7.4, R7.5, R7.6.
  - Verification: unit tests assert `Sentry.getCurrentHub().getClient()` is `undefined` when DSN is unset; exactly one client after any number of `initSentry()` calls with the same DSN; `release` equals `process.env.RAILWAY_GIT_COMMIT_SHA`; `scrubEvent` strips `idea` and `constraints` keys from `event.request.data` without mutating the input reference.
  - Dependencies: none (parallel with Batch A).

- [ ] **B2** Add property-based test for Sentry init idempotence `[pbt]`
  - Description: Add fast-check Property 2 from design § 8 — "Sentry init is idempotent and a no-op without DSN".
  - Files: `apps/api/src/observability/sentry.pbt.test.ts` (new).
  - Acceptance criteria: R7.3, R7.4.
  - Verification: fast-check replays any interleaving of `init` / `set-dsn` events and asserts the active-client invariant (0 clients when DSN always falsy, exactly 1 client once any non-empty DSN has been set). Note that the test harness will surface the property-testing warning on this run.
  - Dependencies: B1.

- [ ] **B3** Wire Sentry into the API process
  - Description: Call `initSentry()` in `apps/api/src/index.ts` before `serve()`, and call `attachSentryToHono(app)` in `apps/api/src/app.ts` so captured events include `requestId`. No-op stays silent when DSN is unset.
  - Files: `apps/api/src/index.ts` (edit), `apps/api/src/app.ts` (edit).
  - Acceptance criteria: R7.1, R7.3.
  - Verification: contract test asserts that with `SENTRY_DSN` unset, `Sentry.getCurrentHub().getClient()` is still `undefined` after `app.request("/health")`. With a stubbed DSN, one client is registered and a thrown error inside a route produces a captured event whose payload has `idea` / `constraints` removed.
  - Dependencies: B1, B2.

- [ ] **B4** Add web Sentry module
  - Description: Add `apps/web/src/lib/sentry.ts` exposing a browser `initSentry()` that reads `import.meta.env.VITE_SENTRY_DSN` and `VITE_APP_RELEASE`. Idempotent; no-op when DSN is missing.
  - Files: `apps/web/src/lib/sentry.ts` (new), `apps/web/src/lib/sentry.test.ts` (new), `apps/web/package.json` (edit: add `@sentry/react`, `@sentry/vite-plugin`).
  - Acceptance criteria: R7.2, R7.3, R7.4.
  - Verification: unit tests cover the DSN-unset and double-init branches on the browser side the same way B1 does for the API.
  - Dependencies: none (can parallel B1).

- [ ] **B5** Wire Sentry into the web build and entrypoint
  - Description: Call `initSentry()` in `apps/web/src/main.tsx` before `ReactDOM.createRoot`. Register `sentryVitePlugin` conditionally in `apps/web/vite.config.ts` — enabled only when `SENTRY_DSN`, `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, and `SENTRY_PROJECT_WEB` are all set at build time.
  - Files: `apps/web/src/main.tsx` (edit), `apps/web/vite.config.ts` (edit).
  - Acceptance criteria: R7.2, R7.3, R7.6.
  - Verification: `pnpm --filter @stackfast/web build` with no Sentry env vars builds cleanly (plugin not registered, source maps still emitted locally via `build.sourcemap: true`). Running the build with all four env vars set loads the Sentry Vite plugin once — asserted via a local dry-run script that greps `dist/assets/*.map.sentry*` metadata.
  - Dependencies: B4.

---

## Batch C — Auth fail-closed tightening (R11)

- [ ] **C1** Add production-first fail-closed guard in `requireSession()`
  - Description: Apply the two-line edit described in design § 3 ("Module boundaries — auth middleware"): at the very top of `requireSession`, return HTTP 503 when `isProduction(c.env)` is true and `getAuth()` yields a null/throwing result, regardless of the `ALLOW_AUTH_BYPASS` value. The non-production bypass path is unchanged.
  - Files: `apps/api/src/middleware/auth.ts` (edit).
  - Acceptance criteria: R11.2, R11.3, R11.4, R11.5.
  - Verification: existing test case `fails protected generation closed in production when auth is unavailable` stays green; the local-dev bypass path still works with the default `.env.example` values.
  - Dependencies: none (parallel with A and B).

- [ ] **C2** Add fail-closed contract + property tests `[pbt]`
  - Description: Add the app-level contract tests for "admin 401 before any middleware", "CORS never wildcard in prod", and "prod auth 503 when Better Auth init throws" (design § 8). Add the fast-check suites for Properties 3 (CORS never wildcard), 4 (admin-key gating), and 5 (auth fail-closed in prod) since these target app-level behavior rather than a single rate-limit module.
  - Files: `apps/api/src/app.test.ts` (edit: add the three contract cases), `apps/api/src/app.pbt.test.ts` (new: holds Properties 3, 4, 5).
  - Acceptance criteria: R8.1, R10.3, R10.4, R11.4 (contract), R10.3, R8.1, R8.3, R8.4, R8.5, R8.6, R11.2, R11.3, R11.4 (properties).
  - Verification: `pnpm --filter @stackfast/api test` passes; the PBT run triggers the property-testing warning for the new `.pbt.test.ts` file.
  - Dependencies: C1.

---

## Batch D — Railway manifests + runbook scripts

- [ ] **D1** Add API service Railway manifest
  - Description: Declare the Node 20 runtime, build/start commands, and `/health` healthcheck path for `stackfast-api` so `railway up` is deterministic regardless of Railway's autodetection.
  - Files: `apps/api/railway.toml` (new).
  - Acceptance criteria: R1.1, R5.1.
  - Verification: `railway up --service stackfast-api --dry-run` against a local Railway link (or a `railway config validate` equivalent) reports the manifest as valid. File is reviewed against ADR 003 § 1 and design § "API Service".
  - Dependencies: A6 (must not ship the manifest before the rate-limit module that the service will run).

- [ ] **D2** Add Web service Railway manifest
  - Description: Declare the static-hosting build and serve configuration for `stackfast-web` so the web service is redeployable by `railway up` with no manual dashboard fiddling.
  - Files: `apps/web/railway.toml` (new).
  - Acceptance criteria: R1.2.
  - Verification: manifest is reviewed against design § "Web Service"; `railway up --service stackfast-web --dry-run` reports valid.
  - Dependencies: B5 (web Sentry wiring must exist before the manifest declares the build that will upload source maps).

- [ ] **D3** Add migration one-shot script
  - Description: Add `scripts/deploy/migrate.ts` — a `tsx`-runnable wrapper around `drizzle-kit push` with a 30-second connection-retry loop per R2.3. Exits non-zero on any failure.
  - Files: `scripts/deploy/migrate.ts` (new).
  - Acceptance criteria: R2.3, R2.4, R2.5.
  - Verification: running `pnpm exec tsx scripts/deploy/migrate.ts --dry-run` against a local Neon branch prints the pending DDL (or "no changes"); forcing `DATABASE_URL` to an unreachable host causes the script to retry for ~30s before exiting non-zero; exit code is captured in the runbook.
  - Dependencies: none (parallel with D1, D2).

- [ ] **D4** Add post-deploy smoke script
  - Description: Add `scripts/deploy/smoke.ts` implementing the six assertions in design § 8 "Deploy smoke" — health, 31-req generation burst, 101-req read burst, admin 401, same-origin CORS ACAO, evil-origin ACAO absent. Exits 0/non-zero, prints a one-line JSON summary, and writes a timestamped report to `test-results/deploy-smoke-<timestamp>.json`.
  - Files: `scripts/deploy/smoke.ts` (new).
  - Acceptance criteria: R5.4, R6.1, R6.2, R6.3, R8.3, R10.2, R10.3.
  - Verification: run against the local dev server (`pnpm dev` + `pnpm exec tsx scripts/deploy/smoke.ts --base http://localhost:3000 --web http://localhost:5173`); all six assertions pass, the JSON summary lands in `test-results/`, and the script exits 0. A second run with the API stopped exits non-zero and the summary marks the health assertion as failed.
  - Dependencies: A6 (rate limiter wired in so R6.1/R6.3 are testable), C1 (admin + CORS behavior finalized), D3 (so `migrate` → `smoke` order is clear in the runbook).

- [ ] **D5** Add rollback runbook `[docs]`
  - Description: Document `railway rollback --service stackfast-api` and `railway rollback --service stackfast-web`, the two-phase schema-compatibility rule from design § "Rollback, observability, and runbook notes", and the manual intervention point from R12.4.
  - Files: `scripts/deploy/rollback.md` (new).
  - Acceptance criteria: R12.1, R12.2, R12.3, R12.4, R12.5, R12.6, R12.7.
  - Verification: operator reviewer confirms each R12 acceptance criterion has a named step in the runbook and that the runbook cross-references ADR 003 § "Rollback strategy".
  - Dependencies: D1, D2 (rollback applies per-service, so manifests must exist).

---

## Batch E — `.env.example` and README `[docs]`

- [ ] **E1** Extend `.env.example` with Phase 8 variables `[docs]`
  - Description: Add the new rows from design § "Configuration surface" — `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, `RATE_LIMIT_BACKEND`, `SENTRY_DSN`, `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT_API`, `SENTRY_PROJECT_WEB`, `RAILWAY_GIT_COMMIT_SHA`, `VITE_SENTRY_DSN`, `VITE_APP_RELEASE`. Each row has a short comment linking to ADR 003 § 3 (Upstash) or § 5 (Sentry).
  - Files: `.env.example` (edit).
  - Acceptance criteria: R14.1.
  - Verification: reviewer diffs `.env.example` against design § "Configuration surface" and confirms every new row is present with a comment.
  - Dependencies: none (parallel with A–D).

- [ ] **E2** Add production-deployment section to the README `[docs]`
  - Description: Add the Railway CLI deploy flow (steps 1-9 from design § "End-to-end `railway link` → deployed story"), the Drizzle one-shot migration command, the per-service rollback commands, and the full production env var table. Link to ADR 001, ADR 002, and ADR 003.
  - Files: `readme.md` (edit).
  - Acceptance criteria: R14.1, R14.2, R14.3, R14.4, R14.5.
  - Verification: reviewer confirms every R14 acceptance criterion is addressed by a named subsection; the three ADR links resolve.
  - Dependencies: D3, D4, D5 (README cites the scripts and runbook by path).

---

## Batch F — External provisioning `[external]`

- [ ] **F1** Provision Railway project + production and staging environments `[external]`
  - Description: Create (or link to) the `stackfast` Railway project; create `production` and `staging` Railway environments inside it; link the repo from the operator's workstation with `railway link`.
  - Preconditions: Railway account, Railway CLI installed and `railway login` completed, operator has project-create permission in the target team/workspace.
  - Acceptance criteria: R1.3, R1.4, R13.1.
  - Verification: operator records the project id, environment names, and the output of `railway status` (showing both services attached to both environments) in the deploy log. No code lands.
  - Dependencies: E1, E2 (docs must match the variables the operator is about to set).

- [ ] **F2** Provision Neon production branch `[external]`
  - Description: Confirm the Neon Postgres project exists (pre-existing per ADR 003 § 2); select the `main` branch as the Neon Production Branch; retrieve the pooled connection string.
  - Preconditions: Neon account, existing Neon project.
  - Acceptance criteria: R2.1, R2.2.
  - Verification: operator records the Neon project id and the pooled connection string's host-only fragment (never the full secret) in the deploy log.
  - Dependencies: F1.

- [ ] **F3** Provision Neon staging branch `[external]`
  - Description: Create a branch named `staging` off `main`; enable aggressive auto-suspend; retrieve the staging pooled connection string.
  - Preconditions: F2.
  - Acceptance criteria: R13.2.
  - Verification: operator records the staging branch name and host-only fragment; `neon branches list` shows both branches.
  - Dependencies: F2.

- [ ] **F4** Provision Upstash Redis (production + staging) `[external]`
  - Description: Create two Upstash Redis databases — one named `stackfast-prod`, one `stackfast-staging`. Copy `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` for each into the operator's secrets store.
  - Preconditions: Upstash account.
  - Acceptance criteria: R4.6, R13.4.
  - Verification: operator records database ids and region; the tokens themselves are stored only in Railway env vars (F→G/H tasks).
  - Dependencies: F1.

- [ ] **F5** Provision Sentry projects (API + web) `[external]`
  - Description: Create two Sentry projects — `stackfast-api` (Node) and `stackfast-web` (React). Generate an org-scoped auth token for source-map upload. Record DSNs for each project and each environment (prod and staging).
  - Preconditions: Sentry account, Sentry org chosen.
  - Acceptance criteria: R7.1, R7.2.
  - Verification: operator records project slugs, DSNs (host-only fragment), and the auth-token scope in the deploy log. DSNs are stored only in Railway env vars.
  - Dependencies: F1.

- [ ] **F6** Register Production GitHub OAuth app `[external]`
  - Description: Create a GitHub OAuth application with callback URL `https://api.stackfast.app/api/auth/callback/github`. Copy `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET`.
  - Preconditions: GitHub account with permission to register OAuth apps in the target org/personal account.
  - Acceptance criteria: R3.1.
  - Verification: operator records the OAuth app name, client id, and the registered callback URL; client secret is stored only in Railway env vars.
  - Dependencies: F1.

- [ ] **F7** Register Staging GitHub OAuth app `[external]`
  - Description: Create a second GitHub OAuth application distinct from F6 with callback URL matching the staging API host (`https://api.staging.stackfast.app/api/auth/callback/github`). Copy its own client id and secret.
  - Preconditions: same as F6.
  - Acceptance criteria: R13.3.
  - Verification: operator records the staging app name, client id, callback URL; the secret is stored only in Railway staging env vars.
  - Dependencies: F1.

- [ ] **F8** Configure DNS and attach custom domains `[external]`
  - Description: Point `stackfast.app` at the Web Service and `api.stackfast.app` at the API Service (production). Repeat for `staging.stackfast.app` and `api.staging.stackfast.app`. Attach the domains to the corresponding Railway services; confirm TLS certificate issuance; verify HTTP→HTTPS redirect.
  - Preconditions: F1, domain owner access, DNS management access for `stackfast.app`.
  - Acceptance criteria: R9.1, R9.2, R9.3, R9.4, R9.5.
  - Verification: `dig api.stackfast.app` and `dig stackfast.app` resolve to Railway edge; `curl -I http://stackfast.app` returns 301 or 308 to the HTTPS URL; TLS certificate on both origins is Railway-issued.
  - Dependencies: F1.

---

## Batch G — Staging cutover

- [ ] **G1** Set staging environment variables in Railway `[external]`
  - Description: Set every variable in the "Staging" column of design § "Configuration surface" on both `stackfast-api` and `stackfast-web` in the Railway staging environment. Leave `RATE_LIMIT_BACKEND` at its default (`memory`) for this first deploy; leave `SENTRY_DSN` optional.
  - Preconditions: F1, F3, F4, F5, F7.
  - Acceptance criteria: R3.2, R3.5, R11.1, R13.2, R13.3, R13.4, R13.5.
  - Verification: `railway variables list --service stackfast-api --environment staging` reports every required variable (operator redacts secrets); `ALLOW_AUTH_BYPASS=false`.
  - Dependencies: F1, F3, F4, F5, F7.

- [ ] **G2** Deploy API and Web to staging `[external]`
  - Description: `railway up --service stackfast-api --environment staging` and `railway up --service stackfast-web --environment staging`. Confirm both services reach healthy state.
  - Preconditions: D1, D2, G1.
  - Acceptance criteria: R1.1, R1.2, R1.4, R5.1, R5.2.
  - Verification: operator records the two `railway up` build ids; `GET https://api.staging.stackfast.app/health` returns 200 `OK` within 15 seconds of the container marking ready.
  - Dependencies: D1, D2, G1.

- [ ] **G3** Run migrations against Neon staging branch `[external]`
  - Description: Execute `railway run --service stackfast-api --environment staging -- pnpm exec tsx scripts/deploy/migrate.ts`. Capture stdout/stderr.
  - Preconditions: D3, F3, G2.
  - Acceptance criteria: R2.4, R2.5.
  - Verification: script exits 0; output is attached to the deploy log; Neon staging branch reflects the expected schema.
  - Dependencies: D3, F3, G2.

- [ ] **G4** Flip `RATE_LIMIT_BACKEND=upstash` in staging `[external]`
  - Description: Set `RATE_LIMIT_BACKEND=upstash`, `UPSTASH_REDIS_REST_URL`, and `UPSTASH_REDIS_REST_TOKEN` on the staging API service. Railway restarts the instance automatically.
  - Preconditions: A6 (factory reads the flag), F4, G2.
  - Acceptance criteria: R4.1, R4.6, design § 9 step 3.
  - Verification: `railway logs --service stackfast-api --environment staging` shows no `[rate-limit] upstash unavailable` entries in the minute after restart.
  - Dependencies: A6, F4, G2.

- [ ] **G5** Run deploy smoke + Playwright E2E against staging `[external]`
  - Description: Run `pnpm exec tsx scripts/deploy/smoke.ts --base https://api.staging.stackfast.app --web https://staging.stackfast.app` and `E2E_BASE_URL=https://staging.stackfast.app E2E_API_URL=https://api.staging.stackfast.app/api/v1 pnpm test:e2e`. File the resulting `test-results/deploy-smoke-*.json` in the deploy log.
  - Preconditions: D4, G3, G4.
  - Acceptance criteria: R5.4, R6.1, R6.2, R6.3, R8.3, R10.2, R10.3, R3.8.
  - Verification: smoke script exits 0 and the JSON report shows six passing assertions; Playwright reports all specs green against the staging origins.
  - Dependencies: D4, G3, G4.

- [ ] **G6** Soak the rate-limit properties against real Upstash `[external] [pbt]`
  - Description: Re-run the rate-limit property-based suite with `RATE_LIMIT_BACKEND=upstash` and the real staging Upstash credentials in the local environment — design § 9 step 3 calls out confirming Property 1 holds end-to-end. The test harness surfaces its property-testing warning on this run.
  - Preconditions: A5, F4, G4.
  - Acceptance criteria: R4.5 (end-to-end against the real backend), design § 9 step 3.
  - Verification: `pnpm --filter @stackfast/api test src/rate-limit/rate-limit.pbt.test.ts` passes with the staging Upstash URL/token exported locally; run duration and seed are recorded in the deploy log.
  - Dependencies: A5, F4, G4.

---

## Batch H — Production cutover

- [ ] **H1** Set production environment variables in Railway `[external]`
  - Description: Set every variable in the "Prod" column of design § "Configuration surface" on both services. Leave `RATE_LIMIT_BACKEND=memory` for the first deploy — the flag flip happens after the smoke in H6. Set `ALLOW_AUTH_BYPASS=false`.
  - Preconditions: F1, F2, F4, F5, F6.
  - Acceptance criteria: R3.2, R3.5, R8.2, R10.1, R11.1.
  - Verification: `railway variables list --service stackfast-api --environment production` shows every required var; admin and auth secrets are distinct from `BETTER_AUTH_SECRET`.
  - Dependencies: F1, F2, F4, F5, F6.

- [ ] **H2** Deploy API and Web to production `[external]`
  - Description: `railway up --service stackfast-api --environment production` and `railway up --service stackfast-web --environment production`.
  - Preconditions: D1, D2, G5 (staging must have fully passed), H1.
  - Acceptance criteria: R1.1, R1.2, R1.4.
  - Verification: both services report healthy; operator records the production build ids.
  - Dependencies: D1, D2, G5, H1.

- [ ] **H3** Run migrations against Neon production branch `[external]`
  - Description: Execute `railway run --service stackfast-api --environment production -- pnpm exec tsx scripts/deploy/migrate.ts`. Capture stdout/stderr. Do not re-run on rollback.
  - Preconditions: D3, F2, H2.
  - Acceptance criteria: R2.4, R2.5, R2.8.
  - Verification: script exits 0; output attached to the deploy log; Neon production branch schema matches the expected state.
  - Dependencies: D3, F2, H2.

- [ ] **H4** Confirm DNS cutover for production `[external]`
  - Description: Ensure `stackfast.app` and `api.stackfast.app` resolve to the Railway edge, TLS is healthy, and the HTTP→HTTPS redirect fires. If F8 already flipped DNS, verify it here; otherwise flip now.
  - Preconditions: F8, H2.
  - Acceptance criteria: R9.1, R9.2, R9.3, R9.4, R9.5.
  - Verification: `dig api.stackfast.app +short` matches the Railway edge; `curl -I https://stackfast.app` returns 200; `curl -I http://stackfast.app` returns 301/308 to `https://stackfast.app`.
  - Dependencies: F8, H2.

- [ ] **H5** Run production smoke and record `/health` evidence `[external]`
  - Description: Run `pnpm exec tsx scripts/deploy/smoke.ts --base https://api.stackfast.app --web https://stackfast.app`. Operator attaches `test-results/deploy-smoke-<timestamp>.json` to the deploy PR and records the `/health` status + body in the deploy log per R5.4.
  - Preconditions: D4, H3, H4.
  - Acceptance criteria: R5.4, R8.3, R10.2, R10.3.
  - Verification: smoke exits 0 with the six assertions passing; `GET https://api.stackfast.app/health` → `200 OK` captured in the deploy log.
  - Dependencies: D4, H3, H4.

- [ ] **H6** Flip `RATE_LIMIT_BACKEND=upstash` in production `[external]`
  - Description: Set `RATE_LIMIT_BACKEND=upstash` plus `UPSTASH_REDIS_REST_URL` / `_TOKEN` on the production API service. Railway restarts the instance. Per design § 9 step 4 this is reversible by flipping the flag back to `memory`.
  - Preconditions: F4, H5.
  - Acceptance criteria: R4.1, R4.6, design § 9 step 4.
  - Verification: post-restart `railway logs` show no fail-open warning in the first minute; a single `GET /api/v1/tools/search` round-trip responds 200.
  - Dependencies: F4, H5.

- [ ] **H7** Verify production rate limiting end-to-end `[external]`
  - Description: Re-run the smoke's rate-limit assertions against the production origins to confirm the Upstash path behaves identically to staging. Assert R6.1–R6.3 specifically against production.
  - Preconditions: D4, H6.
  - Acceptance criteria: R6.1, R6.2, R6.3, R6.4.
  - Verification: `pnpm exec tsx scripts/deploy/smoke.ts --base https://api.stackfast.app --web https://stackfast.app --only rate-limit` exits 0; the JSON report is attached to the deploy log.
  - Dependencies: D4, H6.

---

## Batch I — Post-deploy cleanup

- [ ] **I1** Post-deploy verification of dead-code removal
  - Description: Confirm, after production has been running on `RATE_LIMIT_BACKEND=upstash`, that the `setInterval` cleanup removed in A6 is not being reintroduced and that `rateLimitBuckets` is not imported anywhere outside the memory backend and its tests. Purely a verification task — the removal itself landed in A6.
  - Files: none edited; verification only.
  - Acceptance criteria: design § 9 step 1.
  - Verification: `grep -R "rateLimitBuckets" apps/api/src` returns only matches under `apps/api/src/rate-limit/memory*`; `grep -R "setInterval" apps/api/src/index.ts` returns no matches; Railway production logs show no `[rate-limit] Cleaned` lines since H6.
  - Dependencies: H7.

- [ ] **I2** Drop memory-mode rows from production-facing docs and configs `[docs]`
  - Description: Remove any remaining `RATE_LIMIT_BACKEND=memory` example rows from the production column of `.env.example` and the README production section. The memory backend stays in the codebase for tests (design § 9 step 5) — only the prod-facing docs are trimmed.
  - Files: `.env.example` (edit), `readme.md` (edit).
  - Acceptance criteria: R14.1, design § 9 step 5.
  - Verification: reviewer diffs the updated docs and confirms the production column lists `RATE_LIMIT_BACKEND=upstash` unambiguously.
  - Dependencies: I1.

- [ ] **I3** Tick the ROADMAP Phase 8 checkbox `[docs]`
  - Description: Mark Phase 8 deployment complete in `ROADMAP.md`; add a one-line entry to `CHANGELOG.md` summarizing the cutover.
  - Files: `ROADMAP.md` (edit), `CHANGELOG.md` (edit if present, otherwise create a root-level entry).
  - Acceptance criteria: closes the Phase 8 deliverable per ADR 003 § "Implementation notes".
  - Verification: reviewer confirms the Phase 8 checkbox is ticked and the CHANGELOG entry cites ADR 003 and this spec.
  - Dependencies: I2.
