/**
 * Fail-open wrapper around any `RateLimitBackend`.
 *
 * Purpose
 * -------
 * R4.5 requires that rate-limit backend failures (Upstash unreachable,
 * timeout, 5xx, or any other rejection from `check()`) MUST NOT turn into
 * HTTP 429. The request has to be allowed through, and the failure must be
 * logged at most once per 60 s window so a sustained outage does not drown
 * the stdout of the API service.
 *
 * This module takes a backend and returns a new backend with the same
 * `name` but a `check()` that:
 *
 *   1. Awaits the inner `check()` inside a try/catch. This catches both
 *      rejected promises and synchronous throws from the inner function.
 *   2. On success: passes the decision through unchanged and resets the
 *      log-gate so that the next failure logs again immediately. This is
 *      what design § 9 step 2 calls "restores normal accounting on the
 *      next successful check".
 *   3. On failure: emits `"[rate-limit] upstash unavailable"` (optionally
 *      followed by `": <error message>"`) through the injected logger and
 *      returns a synthetic allow decision sized from `BUCKETS[bucket]`.
 *      The synthetic `remaining` is set to the bucket limit because we
 *      have no way to know the real remaining quota without the backend.
 *      This is explicitly what design § 3 ("fail-open.ts") specifies.
 *
 * Log-gate semantics
 * ------------------
 * A minimal clock-gated counter tracks the epoch-ms of the last emitted
 * log line. Any failure whose timestamp is <= lastLoggedAt + 60_000 is
 * swallowed silently. A successful call clears `lastLoggedAt` (sets it to
 * `null`) so that the *next* failure, regardless of how soon it happens,
 * produces a fresh log line — the limiter has recovered and we want to
 * know the moment it breaks again.
 *
 * No timers, no setInterval — the gate is evaluated lazily on every
 * `check()`, matching the lazy-rollover style used by the memory backend.
 *
 * Tests inject both `now` and `logger` so assertions never touch
 * `console.warn` globally.
 */

import { BUCKETS } from "./buckets.js";
import type {
  RateLimitBackend,
  RateLimitCheckArgs,
  RateLimitDecision,
} from "./types.js";

const LOG_WINDOW_MS = 60_000;
const LOG_MESSAGE = "[rate-limit] upstash unavailable";

export interface FailOpenOptions {
  /**
   * Clock injection for deterministic tests. Defaults to `Date.now`.
   */
  now?: () => number;
  /**
   * Logger injection for deterministic tests. Defaults to `console.warn`.
   * The wrapper calls `logger(message, error)` on the first failure inside
   * each 60 s window; the `error` argument lets callers preserve the
   * original stack if they want to.
   */
  logger?: (message: string, error?: unknown) => void;
}

function defaultLogger(message: string, error?: unknown): void {
  // Keep the production default quiet unless there is actually something
  // to say. We forward the error as a second argument so structured log
  // collectors (Railway, pino) can attach it.
  // eslint-disable-next-line no-console
  console.warn(message, error);
}

function errorMessage(error: unknown): string {
  if (error instanceof Error && typeof error.message === "string" && error.message.length > 0) {
    return error.message;
  }
  try {
    return String(error);
  } catch {
    return "unknown error";
  }
}

/**
 * Wrap any `RateLimitBackend` with fail-open behavior.
 *
 * The returned backend keeps the inner backend's `name` — we are
 * decorating, not introducing a new backend type.
 */
export function wrapFailOpen(
  backend: RateLimitBackend,
  options: FailOpenOptions = {},
): RateLimitBackend {
  const now = options.now ?? Date.now;
  const logger = options.logger ?? defaultLogger;

  // `null` means "the gate is open — the next failure logs". A number
  // means "we logged at this epoch-ms; suppress further failures until
  // `lastLoggedAt + LOG_WINDOW_MS`".
  let lastLoggedAt: number | null = null;

  return {
    name: backend.name,
    async check(args: RateLimitCheckArgs): Promise<RateLimitDecision> {
      let decision: RateLimitDecision;
      try {
        // Awaiting inside the try/catch collapses both rejected promises
        // and synchronous throws from the inner `check()` into a single
        // failure path.
        decision = await backend.check(args);
      } catch (error) {
        const nowMs = now();
        if (lastLoggedAt === null || nowMs - lastLoggedAt >= LOG_WINDOW_MS) {
          logger(`${LOG_MESSAGE}: ${errorMessage(error)}`, error);
          lastLoggedAt = nowMs;
        }

        const config = BUCKETS[args.bucket];
        return {
          allowed: true,
          remaining: config.limit,
          limit: config.limit,
          resetAtEpochMs: nowMs + config.windowMs,
        };
      }

      // Successful check — the backend is healthy, so reset the log-gate
      // so the next failure produces a fresh warning instead of silently
      // waiting out the remainder of the previous 60 s window.
      lastLoggedAt = null;
      return decision;
    },
  };
}
