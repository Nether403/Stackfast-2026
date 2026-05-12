/**
 * In-process memory backend for the rate limiter.
 *
 * This is a faithful port of the inline `rateLimit(bucket, limit)` factory in
 * `apps/api/src/app.ts` — same fixed-window accounting, same lazy rollover,
 * same "first request in a fresh window counts as 1" semantics — lifted
 * behind the `RateLimitBackend` interface so:
 *
 *   - existing contract tests keep passing (regression net for R4.2 / R4.3),
 *   - tests have a deterministic backend when `RATE_LIMIT_BACKEND=memory`,
 *   - the Upstash backend (A4) drops into the same factory without any
 *     changes to `app.ts`.
 *
 * Design references:
 *   - design.md § 3 ("Module boundaries — rate limiter")
 *   - design.md § 9 step 1 (lazy rollover; no `setInterval`)
 */

import { BUCKETS } from "./buckets.js";
import type {
  RateLimitBackend,
  RateLimitCheckArgs,
  RateLimitDecision,
} from "./types.js";

interface MemoryEntry {
  count: number;
  resetAtEpochMs: number;
}

export interface MemoryBackendOptions {
  /**
   * Clock injection for deterministic tests. Defaults to `Date.now` in
   * production. The factory only ever calls this through `opts.now()` so a
   * test can freeze or advance time without touching globals.
   */
  now?: () => number;
}

/**
 * Create a process-local rate-limit backend.
 *
 * Keys are `${bucket}:${clientId}` so the same client id counted in the
 * `generation` bucket cannot consume quota from the `read` bucket
 * (cross-bucket isolation, part of R4.4).
 */
export function createMemoryBackend(
  options: MemoryBackendOptions = {},
): RateLimitBackend {
  const now = options.now ?? Date.now;
  const entries = new Map<string, MemoryEntry>();

  return {
    name: "memory",
    async check({ bucket, clientId }: RateLimitCheckArgs): Promise<RateLimitDecision> {
      const config = BUCKETS[bucket];
      const key = `${bucket}:${clientId}`;
      const nowMs = now();

      let entry = entries.get(key);
      if (!entry || nowMs >= entry.resetAtEpochMs) {
        // Lazy rollover — no setInterval, no background sweep. The previous
        // window is replaced in place by the first request of the new one.
        entry = { count: 1, resetAtEpochMs: nowMs + config.windowMs };
        entries.set(key, entry);
      } else {
        entry.count += 1;
      }

      return {
        allowed: entry.count <= config.limit,
        remaining: Math.max(0, config.limit - entry.count),
        limit: config.limit,
        resetAtEpochMs: entry.resetAtEpochMs,
      };
    },
  };
}
