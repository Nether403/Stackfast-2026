/**
 * Upstash Redis backend for the rate limiter.
 *
 * Purpose
 * -------
 * Implements the `RateLimitBackend` contract on top of `@upstash/ratelimit`
 * (sliding-window counter) + `@upstash/redis` (REST client). This is the
 * backend that ships to Railway in production and staging once
 * `RATE_LIMIT_BACKEND=upstash` is set (design § 9 step 3-4). The A6 factory
 * picks between this and `memory.ts` based on the env flag, so this module
 * is deliberately decoupled from `app.ts` — nothing here mutates
 * process-wide state or reaches for Hono.
 *
 * Construction contract
 * ---------------------
 * `createUpstashBackend()` returns `RateLimitBackend | null`. When the
 * Upstash credentials (`UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`)
 * are missing it returns `null` — design § 9 step 2 is the spec: the
 * factory silently falls back to the memory backend instead of throwing,
 * so that flipping `RATE_LIMIT_BACKEND=upstash` without provisioning
 * credentials never breaks boot. The factory (A6) detects the `null` and
 * logs the fallback.
 *
 * Dependency injection
 * --------------------
 * The options accept `redisCtor` and `ratelimitCtor` factory functions so
 * unit tests can inject fakes without `vi.mock()` on `@upstash/*`. Defaults
 * construct the real `Redis` and `Ratelimit` classes. No module-level
 * `new Redis()` call exists — clients are only built inside
 * `createUpstashBackend()` once the credentials are confirmed present.
 *
 * Key layout
 * ----------
 * Keys are `${bucket}:${clientId}` with a short `"rl"` prefix applied by
 * the `Ratelimit` instance itself. This matches the `{bucket}:{clientId}`
 * shape required by R4.4 and keeps the generation and read buckets in
 * disjoint keyspaces (the bucket name is part of the key and one
 * `Ratelimit` instance is constructed per bucket).
 *
 * Response mapping
 * ----------------
 * `Ratelimit.limit()` returns `{ success, remaining, reset, limit, ... }`
 * where `reset` is already epoch-ms per the library. We map:
 *   - `allowed`          ← `response.success`
 *   - `remaining`        ← `max(0, response.remaining)`
 *   - `limit`            ← `BUCKETS[bucket].limit` (echo our config; we do
 *                          NOT trust the response here in case the server
 *                          ever returns a different number for a given
 *                          window — we are the source of truth for the
 *                          bucket sizes)
 *   - `resetAtEpochMs`   ← `response.reset`
 */

import { Ratelimit as RatelimitImpl } from "@upstash/ratelimit";
import { Redis as RedisImpl } from "@upstash/redis";

import { BUCKETS, BUCKET_NAMES, type BucketName } from "./buckets.js";
import type {
  RateLimitBackend,
  RateLimitCheckArgs,
  RateLimitDecision,
} from "./types.js";

/**
 * Observable shape of `Ratelimit.limit()`'s response. Declared locally so
 * the tests can produce matching objects without importing the full
 * `@upstash/ratelimit` types.
 */
export interface RatelimitResponse {
  readonly success: boolean;
  readonly remaining: number;
  /** Epoch milliseconds at which the current window resets. */
  readonly reset: number;
  readonly limit: number;
}

export interface RatelimitInstance {
  limit(identifier: string): Promise<RatelimitResponse>;
}

export type RedisCtor = (config: { url: string; token: string }) => unknown;

export type RatelimitCtor = (config: {
  redis: unknown;
  limiter: unknown;
  prefix?: string;
}) => RatelimitInstance;

export interface UpstashBackendOptions {
  /** Defaults to `process.env.UPSTASH_REDIS_REST_URL`. */
  url?: string;
  /** Defaults to `process.env.UPSTASH_REDIS_REST_TOKEN`. */
  token?: string;
  /**
   * Injected Redis client factory. Defaults to `new Redis(config)` from
   * `@upstash/redis`. Tests pass a stub that returns an opaque sentinel.
   */
  redisCtor?: RedisCtor;
  /**
   * Injected Ratelimit instance factory. Defaults to `new Ratelimit(config)`
   * from `@upstash/ratelimit`. Tests pass a stub that returns
   * `{ limit: async () => <canned response> }`.
   */
  ratelimitCtor?: RatelimitCtor;
}

const KEY_PREFIX = "rl";

function defaultRedisCtor(config: { url: string; token: string }): unknown {
  return new RedisImpl(config);
}

function defaultRatelimitCtor(config: {
  redis: unknown;
  limiter: unknown;
  prefix?: string;
}): RatelimitInstance {
  // The real `Ratelimit` constructor expects a `Redis` instance and a
  // `limiter` produced by one of its static helpers (slidingWindow,
  // fixedWindow, etc). The cast keeps the DI seam clean without pulling
  // the library's internal types into our public surface.
  return new RatelimitImpl(
    config as unknown as ConstructorParameters<typeof RatelimitImpl>[0],
  ) as unknown as RatelimitInstance;
}

/**
 * Build an Upstash-backed rate-limit backend.
 *
 * Returns `null` when either `UPSTASH_REDIS_REST_URL` or
 * `UPSTASH_REDIS_REST_TOKEN` is missing — the caller (the A6 factory) is
 * responsible for falling back to the memory backend in that case. We
 * deliberately do not throw: flipping `RATE_LIMIT_BACKEND=upstash` before
 * provisioning credentials must not crash the API on boot.
 */
export function createUpstashBackend(
  options: UpstashBackendOptions = {},
): RateLimitBackend | null {
  const url = options.url ?? process.env.UPSTASH_REDIS_REST_URL;
  const token = options.token ?? process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    return null;
  }

  const redisCtor = options.redisCtor ?? defaultRedisCtor;
  const ratelimitCtor = options.ratelimitCtor ?? defaultRatelimitCtor;

  // One Redis client reused across every bucket — the REST transport is
  // stateless and there is no connection pool to share, but re-using the
  // instance avoids duplicate configuration validation in the library.
  const redis = redisCtor({ url, token });

  // One `Ratelimit` instance per bucket. The limiter encodes both the
  // quota and the window, so the two buckets cannot share one instance.
  // The sliding-window helper takes a duration string like `"60 s"` —
  // we round up to the nearest whole second (windowMs is always a
  // multiple of 1000 in BUCKETS, but Math.max(1, ...) keeps us honest
  // against future sub-second configs).
  const limiters = {} as Record<BucketName, RatelimitInstance>;
  for (const bucket of BUCKET_NAMES) {
    const { limit, windowMs } = BUCKETS[bucket];
    const seconds = Math.max(1, Math.round(windowMs / 1000));
    const limiter = RatelimitImpl.slidingWindow(limit, `${seconds} s`);
    limiters[bucket] = ratelimitCtor({
      redis,
      limiter,
      prefix: KEY_PREFIX,
    });
  }

  return {
    name: "upstash",
    async check({ bucket, clientId }: RateLimitCheckArgs): Promise<RateLimitDecision> {
      const limiter = limiters[bucket];
      const response = await limiter.limit(`${bucket}:${clientId}`);
      const { limit } = BUCKETS[bucket];
      return {
        allowed: response.success,
        remaining: Math.max(0, response.remaining),
        limit,
        resetAtEpochMs: response.reset,
      };
    },
  };
}
