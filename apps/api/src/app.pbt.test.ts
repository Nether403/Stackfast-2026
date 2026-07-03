/**
 * App-level property-based tests (Phase 8 — task C2).
 *
 * Scope
 * -----
 * This file holds the three **app-level** properties from
 * [`design.md` § "Testing strategy — Property-based tests"]
 * (../../../../.kiro/specs/phase-8-deployment/design.md). The rate-limit
 * fail-open property (Property 1) lives in `rate-limit/rate-limit.pbt.test.ts`
 * and the Sentry idempotence property (Property 2) lives in
 * `observability/sentry.pbt.test.ts`. The three here target whole-app Hono
 * behavior rather than a single module:
 *
 *   - **Property 3** — CORS never echoes `*` with credentials in production.
 *   - **Property 4** — admin-key gating precedes every other middleware.
 *   - **Property 5** — production auth fails closed whenever the auth
 *     subsystem is not ready.
 *
 * Harness notes
 * -------------
 * Two pieces of app state are captured at module-import time and therefore
 * cannot be varied through `c.env` on a single shared instance:
 *
 *   1. `CORS_ORIGIN` — read once into `configuredCorsOrigin` in `app.ts`.
 *      Property 3 needs to exercise more than one configured origin, so it
 *      pre-builds one fresh `app` per origin via `vi.resetModules()` +
 *      dynamic import (see `buildApp`).
 *   2. The Better Auth `_auth` singleton in `middleware/auth.ts` — once a
 *      successful construction caches it, `getAuth()` stops re-reading the
 *      environment. Property 5 therefore rebuilds a fresh `app` per
 *      generated case so the `authInitThrows` dimension is honored on every
 *      iteration regardless of what the previous case constructed.
 *
 * Property 4 needs neither lever (admin gating is independent of both), so it
 * runs against the statically imported `app` for speed and injects a spy
 * rate-limit backend to prove no token is consumed on a 401.
 */

import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import fc from "fast-check";
import app from "./app.js";
import { BUCKETS } from "./rate-limit/buckets.js";
import { __resetBackendForTests } from "./rate-limit/index.js";
import type {
  RateLimitBackend,
  RateLimitCheckArgs,
  RateLimitDecision,
} from "./rate-limit/types.js";

/**
 * Minimal structural type for a Hono app's `request()` entry point — enough
 * for the fresh, dynamically imported instances without importing Hono's
 * generic surface.
 */
type RequestableApp = {
  request: (
    input: string,
    init?: RequestInit,
    env?: Record<string, unknown>,
  ) => Promise<Response>;
};

/**
 * Rebuild a fresh `app` module with the supplied environment applied at
 * import time. Resets the module registry so `configuredCorsOrigin` and the
 * Better Auth `_auth` singleton are re-evaluated from scratch.
 *
 * Passing `undefined` for a key deletes it from `process.env` so the import
 * sees the unset state rather than a stale value from a previous case.
 */
function restoreEnvVar(
  key: "CORS_ORIGIN" | "DATABASE_URL",
  hadKey: boolean,
  previousValue: string | undefined,
): void {
  if (hadKey) {
    process.env[key] = previousValue;
  } else {
    delete process.env[key];
  }
}

async function buildApp(env: {
  CORS_ORIGIN?: string;
  DATABASE_URL?: string;
}): Promise<RequestableApp> {
  const hadCorsOrigin = "CORS_ORIGIN" in process.env;
  const hadDatabaseUrl = "DATABASE_URL" in process.env;
  const prevCorsOrigin = process.env.CORS_ORIGIN;
  const prevDatabaseUrl = process.env.DATABASE_URL;

  if (env.CORS_ORIGIN === undefined) {
    delete process.env.CORS_ORIGIN;
  } else {
    process.env.CORS_ORIGIN = env.CORS_ORIGIN;
  }
  if (env.DATABASE_URL === undefined) {
    delete process.env.DATABASE_URL;
  } else {
    process.env.DATABASE_URL = env.DATABASE_URL;
  }

  try {
    vi.resetModules();
    const mod = (await import("./app.js")) as { default: RequestableApp };
    return mod.default;
  } catch (error) {
    restoreEnvVar("CORS_ORIGIN", hadCorsOrigin, prevCorsOrigin);
    restoreEnvVar("DATABASE_URL", hadDatabaseUrl, prevDatabaseUrl);
    throw error;
  }
}

// ───────────────────────────────────────────────────────────────────────────
// Property 3 — CORS never echoes `*` with credentials in production.
// Validates: Requirements R10.3 (and R8.1 path coverage via prod requests).
// ───────────────────────────────────────────────────────────────────────────

describe("Property 3 — CORS never wildcards in production (design § 8)", () => {
  const ORIGINS = [
    "https://stackfast.app",
    "https://staging.stackfast.app",
  ] as const;

  // One fresh app per configured origin so the module-level CORS_ORIGIN
  // capture matches the generated `configuredOrigin`.
  const appsByOrigin = new Map<string, RequestableApp>();

  beforeAll(async () => {
    for (const origin of ORIGINS) {
      appsByOrigin.set(origin, await buildApp({ CORS_ORIGIN: origin }));
    }
  });

  afterEach(() => {
    delete process.env.CORS_ORIGIN;
  });

  it("ACAO is never '*'; equals the configured origin when present; ACAC is 'true' when ACAO is present (Validates: Requirements R10.3)", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          configuredOrigin: fc.constantFrom(...ORIGINS),
          requestOrigin: fc.option(fc.webUrl(), { nil: undefined }),
          method: fc.constantFrom("GET", "POST", "OPTIONS"),
        }),
        async ({ configuredOrigin, requestOrigin, method }) => {
          const application = appsByOrigin.get(configuredOrigin)!;

          const headers: Record<string, string> = {};
          if (requestOrigin !== undefined) {
            headers.Origin = requestOrigin;
          }
          if (method === "OPTIONS") {
            headers["Access-Control-Request-Method"] = "GET";
          }

          const res = await application.request(
            "/api/v1/tools/search",
            { method, headers },
            { NODE_ENV: "production", CORS_ORIGIN: configuredOrigin },
          );

          const acao = res.headers.get("access-control-allow-origin");

          // Core invariant (R10.3): a credentialed CORS response must never
          // echo the wildcard.
          expect(acao).not.toBe("*");

          // If an allow-origin is emitted it must be the exact configured
          // origin, and credentials must be advertised alongside it.
          if (acao !== null) {
            expect(acao).toBe(configuredOrigin);
            expect(res.headers.get("access-control-allow-credentials")).toBe(
              "true",
            );
          }
        },
      ),
      { numRuns: 100, seed: 73101 },
    );
  });
});

// ───────────────────────────────────────────────────────────────────────────
// Property 4 — admin-key gating precedes every other middleware.
// Validates: Requirements R8.1, R8.3, R8.4, R8.5, R8.6.
// ───────────────────────────────────────────────────────────────────────────

describe("Property 4 — admin key gating precedes all middleware (design § 8)", () => {
  // Header-safe alphabet: keys are placed into HTTP header values, so the
  // generator is constrained to ASCII that `Headers` accepts. This keeps the
  // property focused on the gating logic instead of header-encoding errors.
  const KEY_ALPHABET =
    "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_".split("");
  const safeKey = fc
    .array(fc.constantFrom(...KEY_ALPHABET), { minLength: 1, maxLength: 40 })
    .map((chars) => chars.join(""));

  afterEach(() => {
    __resetBackendForTests(null);
  });

  it("mismatched/empty key → 401 with no rate-limit token consumed; matching key → 2xx (Validates: Requirements R8.1, R8.3, R8.4, R8.5, R8.6)", async () => {
    // Spy backend records every check() so we can assert that a 401 path
    // never reached the rate-limit middleware (admin/internal routes are not
    // under /api/v1/*, so the count must stay flat).
    const calls: RateLimitCheckArgs[] = [];
    const spy: RateLimitBackend = {
      name: "memory",
      async check(args: RateLimitCheckArgs): Promise<RateLimitDecision> {
        calls.push(args);
        return {
          allowed: true,
          remaining: BUCKETS[args.bucket].limit,
          limit: BUCKETS[args.bucket].limit,
          resetAtEpochMs: Date.now() + BUCKETS[args.bucket].windowMs,
        };
      },
    };
    __resetBackendForTests(spy);

    await fc.assert(
      fc.asyncProperty(
        fc.record({
          path: fc.constantFrom(
            "/admin/tools/import",
            "/admin/compatibility/recompute",
            "/internal/enrich-tool",
          ),
          providedKey: fc.option(safeKey, { nil: undefined }),
          // `""` exercises R8.5: an empty configured key must reject every
          // request regardless of what was provided.
          configuredKey: fc.oneof(fc.constant(""), safeKey),
          headerStyle: fc.constantFrom("x-admin", "bearer", "none"),
        }),
        async ({ path, providedKey, configuredKey, headerStyle }) => {
          const headers: Record<string, string> = {
            "Content-Type": "application/json",
          };
          if (headerStyle === "x-admin" && providedKey !== undefined) {
            headers["X-Admin-API-Key"] = providedKey;
          } else if (headerStyle === "bearer" && providedKey !== undefined) {
            headers["Authorization"] = `Bearer ${providedKey}`;
          }

          // Per-path valid bodies so the matching-key case reaches a 202
          // handler instead of a 400 body-validation error.
          const body =
            path === "/admin/tools/import"
              ? JSON.stringify({ tools: [{ id: "whatever" }] })
              : path === "/internal/enrich-tool"
                ? JSON.stringify({ toolId: "nextjs" })
                : "{}";

          const callsBefore = calls.length;
          const res = await app.request(
            path,
            { method: "POST", headers, body },
            { ADMIN_API_KEY: configuredKey },
          );

          // Effective provided key: `none` style never sends a credential.
          const sent = headerStyle === "none" ? undefined : providedKey;
          const isMatch =
            configuredKey !== "" && sent !== undefined && sent === configuredKey;

          if (isMatch) {
            // R8.4 / R8.6: a matching key (either header style) authorizes
            // the request and the handler runs.
            expect([200, 202]).toContain(res.status);
          } else {
            // R8.1 / R8.3 / R8.5: every mismatch/empty-key request is 401…
            expect(res.status).toBe(401);
            // …and no rate-limit token was consumed before the rejection.
            expect(calls.length).toBe(callsBefore);
          }
        },
      ),
      { numRuns: 100, seed: 99173 },
    );
  });
});

// ───────────────────────────────────────────────────────────────────────────
// Property 5 — production auth fails closed when the subsystem is not ready.
// Validates: Requirements R11.2, R11.3, R11.4.
// ───────────────────────────────────────────────────────────────────────────

describe("Property 5 — production auth fails closed (design § 8)", () => {
  afterEach(() => {
    delete process.env.DATABASE_URL;
    delete process.env.ALLOW_AUTH_BYPASS;
  });

  it("503 whenever the DB is absent or Better Auth init throws, regardless of bypass; 401 otherwise (Validates: Requirements R11.2, R11.3, R11.4)", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          allowBypass: fc.constantFrom<"true" | "false" | undefined>(
            "true",
            "false",
            undefined,
          ),
          databaseUrlPresent: fc.boolean(),
          authInitThrows: fc.boolean(),
          route: fc.constantFrom(
            "/api/v1/blueprints",
            "/api/v1/scaffolds",
          ),
        }),
        async ({ allowBypass, databaseUrlPresent, authInitThrows, route }) => {
          if (allowBypass === undefined) {
            delete process.env.ALLOW_AUTH_BYPASS;
          } else {
            process.env.ALLOW_AUTH_BYPASS = allowBypass;
          }

          // DATABASE_URL drives the three auth-readiness states:
          //   - absent            → getAuth() returns null            → 503
          //   - present + invalid → neon() throws at construction     → 503
          //   - present + valid   → real Better Auth, no session      → 401
          const databaseUrl = !databaseUrlPresent
            ? undefined
            : authInitThrows
              ? "not-a-valid-connection-string"
              : "postgresql://user:pass@ep-test.us-east-1.aws.neon.tech/db";

          const application = await buildApp({ DATABASE_URL: databaseUrl });

          const res = await application.request(
            route,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                idea: "fail-closed property test",
                toolIds: ["nextjs", "node"],
                projectName: "pbt",
              }),
            },
            { NODE_ENV: "production" },
          );

          const expect503 = !databaseUrlPresent || authInitThrows;
          if (expect503) {
            // R11.2 / R11.3 / R11.4: fail closed regardless of bypass.
            expect(res.status).toBe(503);
          } else {
            // Auth is ready but the request carries no session cookie.
            expect(res.status).toBe(401);
          }
        },
      ),
      { numRuns: 36, seed: 51877 },
    );
  });
});
