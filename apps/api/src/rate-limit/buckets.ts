/**
 * Rate-limit bucket configuration.
 *
 * Two buckets per R4.2 / R4.3:
 *   - `generation` — 30 requests per 60s, applied to POST /api/v1/blueprints
 *     and POST /api/v1/scaffolds.
 *   - `read`       — 100 requests per 60s, applied to the remaining /api/v1/*
 *     routes.
 *
 * Kept as a pure module so both backends (memory and Upstash, landing in A2
 * and A4) and the fail-open wrapper (A3) can import it without pulling in
 * Hono, Redis, or any other runtime dependency.
 */

export type BucketName = "generation" | "read";

export interface BucketConfig {
  readonly limit: number;
  readonly windowMs: number;
}

export const BUCKETS: Readonly<Record<BucketName, BucketConfig>> = {
  generation: { limit: 30, windowMs: 60_000 },
  read: { limit: 100, windowMs: 60_000 },
} as const;

export const BUCKET_NAMES: readonly BucketName[] = ["generation", "read"] as const;
