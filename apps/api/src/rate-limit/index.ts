/**
 * Public barrel for the rate-limit module.
 *
 * Exposes:
 *   - `createRateLimitMiddleware(bucket, limitOverride?)` — Hono middleware
 *     factory that the API mounts per route family (see `apps/api/src/app.ts`).
 *   - `rateLimitHealth()` — best-effort health probe used by the deploy
 *     smoke script (D4) and future `/health` extensions.
 *   - `__resetBackendForTests(backend?)` — test-only hook that lets the
 *     contract tests swap the process-wide backend instance per test so
 *     accounting is isolated. The leading `__` marks it as not-part-of-the
 *     -public-API; production code never imports this.
 *
 * Backend selection (design § 3, § 9):
 *   - `process.env.RATE_LIMIT_BACKEND === "upstash"` → Upstash + fail-open.
 *   - Any other value (including unset) → memory + fail-open.
 *   - If `upstash` is selected but `createUpstashBackend()` returns `null`
 *     (missing `UPSTASH_REDIS_REST_URL` / `_TOKEN`), the module falls back
 *     to the memory backend and logs a single warning with the exact
 *     string `[rate-limit] upstash env missing, falling back to memory`
 *     so log collectors can grep for it.
 *
 * One process-wide backend instance is held so the three `app.use(...)`
 * calls (generation + read + `/api/v1/*`) share accounting across routes.
 */

import type { MiddlewareHandler } from "hono/types";
import type { ContentfulStatusCode } from "hono/utils/http-status";

import { BUCKETS, type BucketName } from "./buckets.js";
import { resolveClientId } from "./client-id.js";
import { createMemoryBackend } from "./memory.js";
import { createUpstashBackend } from "./upstash.js";
import { wrapFailOpen } from "./fail-open.js";
import type { RateLimitBackend } from "./types.js";

type Bindings = {
  ADMIN_API_KEY?: string;
  NODE_ENV?: string;
};

type Variables = {
  requestId: string;
};

/**
 * Process-wide backend instance. `null` means "not yet initialized" — the
 * next call to `getBackend()` will construct one from `process.env`. Tests
 * set this directly via `__resetBackendForTests` to inject spies / fakes.
 */
let activeBackend: RateLimitBackend | null = null;

function selectBackend(): RateLimitBackend {
  const flag = (process.env.RATE_LIMIT_BACKEND ?? "memory").trim().toLowerCase();

  if (flag === "upstash") {
    const upstash = createUpstashBackend();
    if (upstash) {
      return wrapFailOpen(upstash);
    }
    console.warn("[rate-limit] upstash env missing, falling back to memory");
    return wrapFailOpen(createMemoryBackend());
  }

  return wrapFailOpen(createMemoryBackend());
}

function getBackend(): RateLimitBackend {
  if (activeBackend === null) {
    activeBackend = selectBackend();
  }
  return activeBackend;
}

/**
 * Test-only: swap the process-wide backend instance.
 *
 * Pass a specific backend to inject a spy or fake (contract tests in
 * `apps/api/src/app.test.ts` do this). Pass `null` / no argument to clear
 * the instance so the next request lazily rebuilds from `process.env`.
 *
 * The injected backend is used as-is — no fail-open wrapping — so tests
 * can observe the raw backend behavior.
 */
export function __resetBackendForTests(backend: RateLimitBackend | null = null): void {
  activeBackend = backend;
}

/**
 * Build a Hono middleware that consults the process-wide rate-limit backend.
 *
 * The `limitOverride` argument is accepted for API compatibility with the
 * previous inline factory but is deliberately ignored: `BUCKETS` is the
 * single source of truth for per-bucket limits. Any call site passing an
 * override that disagrees with `BUCKETS[bucket].limit` gets a one-time
 * warning so operators notice the mismatch.
 */
export function createRateLimitMiddleware(
  bucket: BucketName,
  limitOverride?: number,
): MiddlewareHandler<{ Bindings: Bindings; Variables: Variables }> {
  if (
    typeof limitOverride === "number" &&
    limitOverride !== BUCKETS[bucket].limit
  ) {
    console.warn(
      `[rate-limit] limitOverride=${limitOverride} for bucket="${bucket}" ignored; using configured limit=${BUCKETS[bucket].limit}`,
    );
  }

  return async (c, next) => {
    const clientId = resolveClientId(c.req.raw.headers);
    const backend = getBackend();

    const decision = await backend.check({ bucket, clientId });

    c.header("X-RateLimit-Limit", String(decision.limit));
    c.header("X-RateLimit-Remaining", String(decision.remaining));
    c.header(
      "X-RateLimit-Reset",
      String(Math.ceil(decision.resetAtEpochMs / 1000)),
    );

    if (!decision.allowed) {
      const retryAfter = Math.max(
        1,
        Math.ceil((decision.resetAtEpochMs - Date.now()) / 1000),
      );
      c.header("Retry-After", String(retryAfter));
      return c.json(
        {
          error: "Rate limit exceeded",
          requestId: c.get("requestId"),
        },
        429 as ContentfulStatusCode,
      );
    }

    await next();
  };
}

/**
 * Best-effort health probe for the active rate-limit backend.
 *
 * Uses a dedicated `clientId` (`"__health__"`) so real client quota is
 * never consumed by a health check. Errors are captured, never thrown —
 * the probe itself must never bring down the `/health` endpoint.
 */
export async function rateLimitHealth(): Promise<{
  backend: "memory" | "upstash";
  ok: boolean;
  error?: string;
}> {
  const backend = getBackend();
  try {
    await backend.check({ bucket: "read", clientId: "__health__" });
    return { backend: backend.name, ok: true };
  } catch (error) {
    return {
      backend: backend.name,
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export type { BucketName } from "./buckets.js";
export type {
  RateLimitBackend,
  RateLimitDecision,
  RateLimitCheckArgs,
} from "./types.js";
