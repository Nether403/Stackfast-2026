import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { BUCKETS } from "./buckets.js";
import {
  createUpstashBackend,
  type RatelimitInstance,
  type RatelimitResponse,
} from "./upstash.js";

/**
 * Unit tests for the Upstash rate-limit backend.
 *
 * Everything here uses constructor injection (`redisCtor` /
 * `ratelimitCtor`) rather than `vi.mock("@upstash/*")` — the module is
 * designed so tests never need to touch the real library. This keeps the
 * A6 factory decoupled from the Upstash import graph and leaves the door
 * open for the staging soak (G6) to exercise the real client unmocked.
 *
 * Validates: Requirements R4.1, R4.6.
 */

const REAL_URL = process.env.UPSTASH_REDIS_REST_URL;
const REAL_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

beforeEach(() => {
  // Guarantee the test-setup defaults do not leak real credentials into
  // the factory's env-fallback path during this file's runs.
  delete process.env.UPSTASH_REDIS_REST_URL;
  delete process.env.UPSTASH_REDIS_REST_TOKEN;
});

afterEach(() => {
  if (REAL_URL !== undefined) process.env.UPSTASH_REDIS_REST_URL = REAL_URL;
  if (REAL_TOKEN !== undefined) process.env.UPSTASH_REDIS_REST_TOKEN = REAL_TOKEN;
});

function makeFakeLimiter(response: RatelimitResponse): {
  instance: RatelimitInstance;
  calls: string[];
} {
  const calls: string[] = [];
  return {
    calls,
    instance: {
      async limit(identifier: string): Promise<RatelimitResponse> {
        calls.push(identifier);
        return response;
      },
    },
  };
}

describe("createUpstashBackend", () => {
  it("returns null when UPSTASH_REDIS_REST_URL is missing", () => {
    const backend = createUpstashBackend({ token: "t" });
    expect(backend).toBeNull();
  });

  it("returns null when UPSTASH_REDIS_REST_TOKEN is missing", () => {
    const backend = createUpstashBackend({ url: "https://example.upstash.io" });
    expect(backend).toBeNull();
  });

  it("returns null when both URL and token are missing (simulates unset env)", () => {
    const backend = createUpstashBackend();
    expect(backend).toBeNull();
  });

  it("returns null when env vars are set to empty strings", () => {
    process.env.UPSTASH_REDIS_REST_URL = "";
    process.env.UPSTASH_REDIS_REST_TOKEN = "";
    const backend = createUpstashBackend();
    expect(backend).toBeNull();
  });

  it("maps a successful response to a RateLimitDecision whose resetAtEpochMs matches the window", async () => {
    const reset = 1_700_000_060_000;
    const { instance, calls } = makeFakeLimiter({
      success: true,
      remaining: 29,
      reset,
      limit: BUCKETS.generation.limit,
    });

    const backend = createUpstashBackend({
      url: "https://example.upstash.io",
      token: "secret",
      redisCtor: () => ({}),
      ratelimitCtor: () => instance,
    });

    expect(backend).not.toBeNull();
    const decision = await backend!.check({ bucket: "generation", clientId: "alice" });

    expect(decision.allowed).toBe(true);
    expect(decision.remaining).toBe(29);
    // The decision MUST echo our configured limit, not whatever the
    // library reports — we are the source of truth for bucket sizes.
    expect(decision.limit).toBe(BUCKETS.generation.limit);
    expect(decision.resetAtEpochMs).toBe(reset);

    // And the identifier is composed as `${bucket}:${clientId}` per R4.4.
    expect(calls).toEqual(["generation:alice"]);
  });

  it("maps a blocked response to allowed: false, remaining: 0", async () => {
    const { instance } = makeFakeLimiter({
      success: false,
      remaining: -1, // real library can return negative when over quota
      reset: 1_700_000_120_000,
      limit: BUCKETS.generation.limit,
    });

    const backend = createUpstashBackend({
      url: "https://example.upstash.io",
      token: "secret",
      redisCtor: () => ({}),
      ratelimitCtor: () => instance,
    });

    const decision = await backend!.check({ bucket: "generation", clientId: "bob" });
    expect(decision.allowed).toBe(false);
    // remaining must be clamped to >= 0 even if the library returns a
    // negative value.
    expect(decision.remaining).toBe(0);
    expect(decision.limit).toBe(BUCKETS.generation.limit);
    expect(decision.resetAtEpochMs).toBe(1_700_000_120_000);
  });

  it("exposes the backend name as 'upstash' for logging and health checks", () => {
    const { instance } = makeFakeLimiter({
      success: true,
      remaining: 5,
      reset: 1_700_000_000_000,
      limit: BUCKETS.read.limit,
    });

    const backend = createUpstashBackend({
      url: "https://example.upstash.io",
      token: "secret",
      redisCtor: () => ({}),
      ratelimitCtor: () => instance,
    });

    expect(backend).not.toBeNull();
    expect(backend!.name).toBe("upstash");
  });

  it("falls back to process.env credentials when not passed as options", () => {
    process.env.UPSTASH_REDIS_REST_URL = "https://env.upstash.io";
    process.env.UPSTASH_REDIS_REST_TOKEN = "env-token";

    const captured: { url?: string; token?: string } = {};
    const backend = createUpstashBackend({
      redisCtor: (config) => {
        captured.url = config.url;
        captured.token = config.token;
        return {};
      },
      ratelimitCtor: () => ({
        limit: async () => ({
          success: true,
          remaining: 1,
          reset: 1_700_000_000_000,
          limit: BUCKETS.read.limit,
        }),
      }),
    });

    expect(backend).not.toBeNull();
    expect(captured).toEqual({ url: "https://env.upstash.io", token: "env-token" });
  });

  it("uses a distinct ratelimit instance per bucket so keyspaces stay isolated", async () => {
    const generationCalls: string[] = [];
    const readCalls: string[] = [];

    const backend = createUpstashBackend({
      url: "https://example.upstash.io",
      token: "secret",
      redisCtor: () => ({}),
      // Return a different fake limiter per constructor call so we can
      // observe which bucket reached which instance.
      ratelimitCtor: (() => {
        let index = 0;
        return () => {
          const current = index;
          index += 1;
          return {
            async limit(identifier: string): Promise<RatelimitResponse> {
              (current === 0 ? generationCalls : readCalls).push(identifier);
              return {
                success: true,
                remaining: 1,
                reset: 1_700_000_000_000,
                limit: 1,
              };
            },
          };
        };
      })(),
    });

    await backend!.check({ bucket: "generation", clientId: "alice" });
    await backend!.check({ bucket: "read", clientId: "alice" });

    expect(generationCalls).toEqual(["generation:alice"]);
    expect(readCalls).toEqual(["read:alice"]);
  });
});
