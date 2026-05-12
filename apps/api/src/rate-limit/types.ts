/**
 * Shared types for the rate-limit module.
 *
 * Lives in its own file so the memory backend (A2), the fail-open wrapper
 * (A3), and the Upstash backend (A4) can all import `RateLimitBackend` and
 * `RateLimitDecision` without creating an import cycle through the concrete
 * backend implementations.
 */

import type { BucketName } from "./buckets.js";

/**
 * Result of a single `check()` call on any `RateLimitBackend`.
 *
 * - `allowed` is `true` when the request is within quota (count ≤ limit).
 * - `remaining` is the non-negative remaining quota for the current window.
 * - `limit` echoes the bucket's configured limit so callers do not need to
 *   look it up again when building `X-RateLimit-*` headers.
 * - `resetAtEpochMs` is the absolute epoch-ms at which the current window
 *   rolls over.
 */
export interface RateLimitDecision {
  readonly allowed: boolean;
  readonly remaining: number;
  readonly limit: number;
  readonly resetAtEpochMs: number;
}

/**
 * Arguments to `RateLimitBackend.check()`. Grouped as an object so call
 * sites read as `check({ bucket, clientId })` rather than two positional
 * strings that are easy to swap.
 */
export interface RateLimitCheckArgs {
  readonly bucket: BucketName;
  readonly clientId: string;
}

/**
 * Contract every rate-limit backend implements.
 *
 * `name` tags the backend for logging and health checks (design § 3).
 * `check()` is the single hot-path entry point and MUST be idempotent-safe
 * with respect to errors — the fail-open wrapper (A3) assumes that a
 * rejected promise means the request should be allowed through.
 */
export interface RateLimitBackend {
  readonly name: "memory" | "upstash";
  check(args: RateLimitCheckArgs): Promise<RateLimitDecision>;
}
