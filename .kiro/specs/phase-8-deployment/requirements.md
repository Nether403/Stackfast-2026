# Requirements Document

## Introduction

Phase 8 takes Stackfast 2026 from a green-on-`main` MVP codebase to a running production deployment at `stackfast.app` + `api.stackfast.app`. ADR 003 ("Deployment architecture for MVP") already decided every architecture choice — split Railway web/API services, Neon Postgres, Upstash Redis for rate limiting, cross-origin cookie strategy with Better Auth, Sentry behind a feature flag, and the rollback procedure. This spec does not re-open those decisions. It translates them into testable requirements that Phase 8 tasks can execute mechanically.

The requirements cover the nine Phase 8 deliverables from `ROADMAP.md`, the cross-cutting operational constraints, and the correctness properties worth surfacing for property-based testing where the implementation warrants it (fail-open rate limiter, Sentry init idempotence + no-op, CORS never wildcard in prod, admin-key gating, fail-closed auth in prod).

Referenced decisions: ADR 001 (Better Auth + GitHub OAuth), ADR 002 (AI provider strategy — Azure OpenAI primary, Gemini fallback, heuristic ultimate fallback), ADR 003 (deployment architecture).

## Non-Goals

The following are explicitly out of scope for Phase 8 and MUST NOT be implemented as part of this work. They are v1.x+ candidates.

- Per-pull-request preview environments
- Zero-downtime blue/green deploys
- Multi-region failover
- A custom CDN in front of Railway
- APM or distributed tracing
- Status-page tooling
- Self-hosting path (Stackfast is a single-operator hosted deployment)

## Glossary

- **API Service**: the `stackfast-api` Railway service — a Node 20 long-running Hono process built from `apps/api` and started with `pnpm --filter @stackfast/api start`.
- **Web Service**: the `stackfast-web` Railway service — Railway static hosting serving `apps/web/dist` built from `apps/web`.
- **Production Environment**: the Railway environment that serves `https://stackfast.app` (Web Service) and `https://api.stackfast.app` (API Service).
- **Staging Environment**: a Railway environment that mirrors Production with its own Neon branch, GitHub OAuth app, and secrets.
- **Deployment Operator**: the human operator driving deployments via the Railway CLI (`railway up`, `railway link`, `railway rollback`).
- **Auth Subsystem**: the Better Auth integration in the API Service (see `apps/api/src/middleware/auth.ts` and ADR 001).
- **CORS Middleware**: the Hono `cors()` middleware configured in `apps/api/src/app.ts`.
- **Admin Middleware**: the `requireAdminApiKey()` middleware in `apps/api/src/app.ts` that protects `/admin/*` and `/internal/*`.
- **Rate Limiter**: the middleware in the API Service that enforces per-client request quotas.
- **Upstash Client**: the `@upstash/ratelimit` + `@upstash/redis` integration used by the Rate Limiter.
- **Sentry Subsystem**: the error-tracking wiring in the API Service (`@sentry/node`) and Web Service (`@sentry/react`), gated on `SENTRY_DSN`.
- **Production GitHub OAuth App**: the GitHub OAuth application registered for the Production Environment with callback URL `https://api.stackfast.app/api/auth/callback/github`.
- **Neon Production Branch**: the Neon Postgres branch named `main` designated as the production database.
- **Rollback Procedure**: the Railway CLI operation that redeploys the immediately previous successful build of a single Railway service.

## Requirements

### Requirement 1: Split Railway Services

**User Story:** As a Deployment Operator, I want the web and API deployed as two independent Railway services inside one Railway project, so that each can be built, redeployed, and rolled back without cycling the other.

#### Acceptance Criteria

1. THE Deployment Operator SHALL deploy the API Service as a Railway service running Node 20, built with `pnpm install --filter @stackfast/api... && pnpm --filter @stackfast/api build`, and started with `pnpm --filter @stackfast/api start`.
2. THE Deployment Operator SHALL deploy the Web Service as a Railway static hosting service, built with `pnpm install --filter @stackfast/web... && pnpm --filter @stackfast/web build`, serving the contents of `apps/web/dist`.
3. THE API Service and the Web Service SHALL be provisioned as distinct Railway services within a single Railway project.
4. THE Deployment Operator SHALL provision and deploy the API Service and Web Service via the Railway CLI.
5. WHEN the Web Service is redeployed, THE API Service SHALL continue serving traffic without a restart.
6. WHEN the API Service is redeployed, THE Web Service SHALL continue serving traffic without a restart.

### Requirement 2: Neon Postgres Production Branch

**User Story:** As a Deployment Operator, I want a dedicated Neon production branch wired to the API Service, so that production traffic uses an isolated database with deterministic connection configuration.

#### Acceptance Criteria

1. THE Deployment Operator SHALL provision the Neon Production Branch as the Neon branch named `main`.
2. THE Deployment Operator SHALL set the API Service `DATABASE_URL` environment variable to the pooled connection string for the Neon Production Branch.
3. WHEN the API Service receives its first request to a route that requires the database in the Production Environment, THE API Service SHALL attempt to establish a connection to the Neon Production Branch and SHALL retry transient connection failures for up to 30 seconds before returning an error response.
4. THE Deployment Operator SHALL run Drizzle migrations against the Neon Production Branch as a one-shot Railway deploy command, separate from the API Service start script.
5. THE Drizzle migrations SHALL be forward-only in the Production Environment.
6. IF a Drizzle migration drops or renames a column in the Production Environment, THEN THE Deployment Operator SHALL ship the change across two sequential deploys so that the previous API Service build remains schema-compatible.
7. WHERE a Drizzle migration only adds new columns, new tables, new indexes, or otherwise makes no change that breaks the current API Service build, THE Deployment Operator MAY ship the migration in a single deploy.
8. WHERE the environment is the Production Environment, THE Deployment Operator SHALL NOT bypass the Neon Production Branch requirement, and the API Service MUST use the Neon Production Branch as its `DATABASE_URL` target.
9. WHERE the environment is not the Production Environment, the requirement to use the Neon Production Branch SHALL NOT apply, and staging and local environments MAY use their own Neon branches or connection configurations.

### Requirement 3: Better Auth + GitHub OAuth in Production

**User Story:** As a Stackfast user, I want to sign in with GitHub on `stackfast.app` and have my session persist across calls to `api.stackfast.app`, so that authenticated features work end-to-end in production.

#### Acceptance Criteria

1. THE Deployment Operator SHALL register the Production GitHub OAuth App with callback URL `https://api.stackfast.app/api/auth/callback/github`.
2. THE API Service SHALL set `BETTER_AUTH_URL` to `https://api.stackfast.app` in the Production Environment.
3. WHEN the Auth Subsystem issues a session cookie in the Production Environment, THE Auth Subsystem SHALL set the cookie attributes `Secure`, `HttpOnly`, and `SameSite=None`.
4. WHEN the Auth Subsystem issues a session cookie in the Production Environment, THE Auth Subsystem SHALL set the cookie `Domain` attribute to `.stackfast.app`.
5. THE API Service SHALL set `BETTER_AUTH_SECRET` to a 32-byte random value distinct from every other deploy environment.
6. WHERE the environment is local development, THE Auth Subsystem SHALL continue using Vite's same-origin proxy without `SameSite=None`.
7. WHERE the environment is the Production Environment, THE Web Service SHALL NOT proxy API requests and SHALL call `https://api.stackfast.app` directly so that the cross-origin cookie attributes defined in AC 3 and AC 4 take effect.
8. WHEN a user completes the GitHub OAuth round trip in the Production Environment, THE API Service SHALL return a valid session for subsequent cross-origin requests from `https://stackfast.app` with `credentials: "include"`.

### Requirement 4: Upstash Redis Rate Limiter

**User Story:** As a platform operator, I want the rate limiter backed by Upstash Redis instead of an in-memory `Map`, so that rate limits survive API Service restarts and remain correct under future multi-instance scale-out.

#### Acceptance Criteria

1. THE API Service SHALL replace the in-memory `rateLimitBuckets` `Map` in `apps/api/src/app.ts` with a Rate Limiter backed by `@upstash/ratelimit` + `@upstash/redis`.
2. THE Rate Limiter SHALL enforce a generation bucket of 30 requests per 60 seconds on `POST /api/v1/blueprints` and `POST /api/v1/scaffolds`.
3. THE Rate Limiter SHALL enforce a read bucket of 100 requests per 60 seconds on the remaining `/api/v1/*` routes.
4. THE Rate Limiter SHALL compose bucket keys as `{bucket}:{clientId}` where `{clientId}` is the `x-forwarded-for` header value, falling back to `cf-connecting-ip`, falling back to the literal string `local`.
5. IF the Upstash Client cannot reach Upstash Redis, times out, or returns an error for a given request, THEN THE Rate Limiter SHALL allow the request and emit a single warning log entry identifying the failure.
6. THE API Service SHALL read Upstash credentials from the `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` environment variables.
7. WHEN a request exceeds its rate-limit bucket, THE Rate Limiter SHALL return HTTP 429 with a `Retry-After` header whose value is the remaining seconds until the bucket resets.
8. THE Rate Limiter SHALL NOT emit `Retry-After` headers on responses that are not HTTP 429.
9. THE Rate Limiter SHALL exclude `GET /health` and `GET /openapi.json` from rate-limit accounting.

### Requirement 5: Production Health Check

**User Story:** As a Deployment Operator, I want a verified health check on the production API, so that I can confirm reachability and basic liveness after each deploy.

#### Acceptance Criteria

1. THE API Service SHALL expose `GET /health` returning HTTP 200 with body `OK`.
2. WHEN the API Service starts in the Production Environment, THE API Service SHALL respond to `GET https://api.stackfast.app/health` with HTTP 200 within 15 seconds of the container marking ready.
3. THE `GET /health` route SHALL be accessible without authentication headers.
4. THE Deployment Operator SHALL record the HTTP status and response body of `GET https://api.stackfast.app/health` as part of each Production Environment deploy verification.

### Requirement 6: Rate Limiting Verified in Production

**User Story:** As a Deployment Operator, I want rate limiting smoke-tested against the production API after each deploy, so that I have evidence the Upstash-backed limiter is wired correctly end-to-end.

#### Acceptance Criteria

1. THE Deployment Operator SHALL execute a post-deploy verification that issues 31 authenticated `POST https://api.stackfast.app/api/v1/blueprints` requests from a single client IP within 60 seconds.
2. WHEN the verification procedure issues its 31st generation request within 60 seconds, THE API Service SHALL respond with HTTP 429 and a `Retry-After` header.
3. WHEN the verification procedure issues its 101st read request to `GET https://api.stackfast.app/api/v1/tools/search` within 60 seconds from a single client IP, THE API Service SHALL respond with HTTP 429.
4. WHEN the API Service is restarted during the verification procedure, THE Rate Limiter SHALL preserve the per-client bucket count across the restart.

### Requirement 7: Sentry Feature-Flagged Error Tracking

**User Story:** As a platform operator, I want Sentry wired behind a `SENTRY_DSN` feature flag and configured to scrub user payloads, so that I can enable error tracking later without a code change and without forwarding user ideas to a third party.

#### Acceptance Criteria

1. WHEN `SENTRY_DSN` is set to a non-empty string at API Service startup, THE Sentry Subsystem SHALL initialize `@sentry/node` with error sample rate 1.0 and trace sample rate 0.0.
2. WHEN `SENTRY_DSN` is set to a non-empty string at Web Service build time, THE Sentry Subsystem SHALL initialize `@sentry/react` with the Vite source-map plugin uploading source maps for the build.
3. IF `SENTRY_DSN` is missing, empty, or undefined, THEN THE Sentry Subsystem SHALL skip initialization and SHALL NOT register any Sentry handler, transport, or global hook.
4. WHEN the Sentry Subsystem initialization function is invoked more than once with the same configuration, THE Sentry Subsystem SHALL leave exactly one active Sentry client.
5. WHEN the Sentry Subsystem captures an error originating from the API Service, THE Sentry Subsystem SHALL remove the `idea` and `constraints` fields from the captured event payload before transmission.
6. THE Sentry Subsystem SHALL set the release identifier to the Git SHA injected by Railway into the API Service and Web Service environments.

### Requirement 8: Admin API Key Enforcement

**User Story:** As the Stackfast operator, I want every request to `/admin/*` and `/internal/*` rejected without a valid admin API key, so that only I can run privileged operations in production.

#### Acceptance Criteria

1. IF a request to a path matching `/admin/*` or `/internal/*` arrives without any authentication header (neither `X-Admin-API-Key` nor `Authorization`), THEN THE Admin Middleware SHALL return HTTP 401 before any downstream middleware or handler runs.
2. THE Deployment Operator SHALL set `ADMIN_API_KEY` to a 32-byte random value distinct from `BETTER_AUTH_SECRET` in the Production Environment.
3. IF a request to a path matching `/admin/*` or `/internal/*` arrives without an `X-Admin-API-Key` header matching `ADMIN_API_KEY` and without an `Authorization: Bearer <token>` header whose `<token>` matches `ADMIN_API_KEY`, THEN THE Admin Middleware SHALL return HTTP 401.
4. WHEN a request to `/admin/*` or `/internal/*` presents an `Authorization: Bearer <token>` header whose `<token>` equals `ADMIN_API_KEY`, THE Admin Middleware SHALL authorize the request.
5. IF `ADMIN_API_KEY` is unset or empty in the Production Environment, THEN THE Admin Middleware SHALL reject every request to `/admin/*` and `/internal/*` with HTTP 401.
6. THE Admin Middleware SHALL be applied to every current and future route under the `/admin` and `/internal` path prefixes.

### Requirement 9: DNS and Custom Domains

**User Story:** As a Stackfast user, I want to reach the web app at `stackfast.app` and the API at `api.stackfast.app` over HTTPS, so that the product has a stable public URL.

#### Acceptance Criteria

1. THE Deployment Operator SHALL configure DNS so that `stackfast.app` resolves to the Web Service.
2. THE Deployment Operator SHALL configure DNS so that `api.stackfast.app` resolves to the API Service.
3. THE Deployment Operator SHALL attach `stackfast.app` as a custom domain on the Web Service with a Railway-issued TLS certificate.
4. THE Deployment Operator SHALL attach `api.stackfast.app` as a custom domain on the API Service with a Railway-issued TLS certificate.
5. WHEN a request arrives at `http://stackfast.app` or `http://api.stackfast.app`, THE Railway edge SHALL redirect the client to the corresponding `https://` URL with HTTP status 301 or 308.

### Requirement 10: CORS and Cross-Origin Policy

**User Story:** As a security-minded operator, I want CORS on the production API locked to `https://stackfast.app` with credentials enabled, so that the SPA's authenticated calls succeed and no other origin can read responses.

#### Acceptance Criteria

1. THE API Service SHALL set the `CORS_ORIGIN` environment variable to `https://stackfast.app` in the Production Environment.
2. WHEN a cross-origin request arrives from `https://stackfast.app`, THE CORS Middleware SHALL respond with `Access-Control-Allow-Origin: https://stackfast.app` and `Access-Control-Allow-Credentials: true`.
3. THE CORS Middleware SHALL NOT emit `Access-Control-Allow-Origin: *` in the Production Environment for any request.
4. WHEN a preflight `OPTIONS` request arrives from an origin other than the configured `CORS_ORIGIN` value, THE CORS Middleware SHALL omit any `Access-Control-Allow-Origin` header naming that origin.
5. THE CORS Middleware SHALL include `X-Admin-API-Key`, `X-Request-ID`, `X-AI-Provider`, `Content-Type`, and `Authorization` in its `Access-Control-Allow-Headers` response.

### Requirement 11: Auth Fails Closed in Production

**User Story:** As the Stackfast operator, I want protected routes to fail closed with HTTP 503 whenever the database is not wired up and the bypass is disabled, so that a misconfigured deploy cannot silently pass unauthenticated traffic through to handlers.

#### Acceptance Criteria

1. THE Deployment Operator SHALL set `ALLOW_AUTH_BYPASS` to `false` in the Production Environment.
2. WHERE the environment is the Production Environment, THE Auth Subsystem SHALL fail closed with HTTP 503 on every request to a `requireSession()`-wrapped route whenever the Auth Subsystem is not ready, regardless of the `ALLOW_AUTH_BYPASS` value.
3. IF `ALLOW_AUTH_BYPASS` equals `false` and `DATABASE_URL` is unset when a request arrives at a route wrapped by `requireSession()`, THEN THE Auth Subsystem SHALL return HTTP 503.
4. IF `ALLOW_AUTH_BYPASS` equals `false` and Better Auth initialization fails, THEN THE Auth Subsystem SHALL return HTTP 503 for every request to a `requireSession()`-wrapped route rather than invoke the downstream handler.
5. WHERE the environment is non-production and `ALLOW_AUTH_BYPASS` is not `false`, THE Auth Subsystem SHALL continue honoring the existing bypass behavior so catalog-only local dev and unit tests remain unaffected.

### Requirement 12: Rollback Procedure

**User Story:** As a Deployment Operator, I want a documented, one-command rollback for each Railway service, so that a bad deploy is recoverable without manual redeploys.

#### Acceptance Criteria

1. THE Deployment Operator SHALL be able to roll back the Web Service to the immediately previous successful Railway build via the Railway CLI.
2. THE Deployment Operator SHALL be able to roll back the API Service to the immediately previous successful Railway build via the Railway CLI.
3. WHEN the API Service is rolled back by exactly one deploy, THE Neon Production Branch schema SHALL remain compatible with the rolled-back API Service build.
4. IF an API Service rollback would target a build whose schema expectations conflict with the current Neon Production Branch schema, THEN THE Deployment Operator SHALL block the automatic rollback and perform a manual forward-migration intervention before retrying.
5. WHERE a rollback spans more than one deploy generation, THE Deployment Operator MAY execute the rollback with the understanding that schema compatibility is not guaranteed and manual reconciliation may be required.
6. THE Web Service rollback SHALL complete without requiring a corresponding rollback of the API Service.
7. THE API Service rollback SHALL complete without requiring a corresponding rollback of the Web Service.

### Requirement 13: Staging Environment Isolation

**User Story:** As a Deployment Operator, I want a Staging Environment that mirrors Production with its own data and credentials, so that I can validate deploys end-to-end before cutting over.

#### Acceptance Criteria

1. THE Deployment Operator SHALL provision the Staging Environment as a Railway environment separate from the Production Environment within the same Railway project.
2. THE Staging Environment SHALL use a Neon branch named `staging` distinct from the Neon Production Branch.
3. THE Staging Environment SHALL use a GitHub OAuth App distinct from the Production GitHub OAuth App, with callback URL matching the Staging API Service's public URL.
4. THE Staging Environment SHALL use `BETTER_AUTH_SECRET`, `ADMIN_API_KEY`, `UPSTASH_REDIS_REST_URL`, and `UPSTASH_REDIS_REST_TOKEN` values distinct from the Production Environment.
5. THE Staging Environment SHALL set `ALLOW_AUTH_BYPASS` to `false`.

### Requirement 14: README Deployment Documentation

**User Story:** As a new contributor, I want the README to document how to deploy Stackfast to Railway, so that I can reproduce or modify the deployment without reverse-engineering it.

#### Acceptance Criteria

1. THE README SHALL document every production environment variable listed in ADR 003's secrets table.
2. THE README SHALL document the Railway CLI commands used to deploy the Web Service and the API Service.
3. THE README SHALL document the Rollback Procedure for each Railway service.
4. THE README SHALL document the one-shot command used to apply Drizzle migrations against the Neon Production Branch.
5. THE README SHALL link to `docs/decisions/001-authentication-strategy.md`, `docs/decisions/002-ai-provider-strategy.md`, and `docs/decisions/003-deployment-architecture.md`.
