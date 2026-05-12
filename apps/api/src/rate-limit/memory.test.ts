import { describe, expect, it } from "vitest";
import { BUCKETS } from "./buckets.js";
import { createMemoryBackend } from "./memory.js";

/**
 * Tiny controllable clock — lets each test advance time deterministically.
 */
function makeClock(start = 1_700_000_000_000) {
  let current = start;
  return {
    now: () => current,
    advance: (ms: number) => {
      current += ms;
    },
    set: (ms: number) => {
      current = ms;
    },
  };
}

describe("createMemoryBackend", () => {
  it("increments the count within the window and decrements remaining", async () => {
    const clock = makeClock();
    const backend = createMemoryBackend({ now: clock.now });

    const first = await backend.check({ bucket: "generation", clientId: "alice" });
    expect(first.allowed).toBe(true);
    expect(first.limit).toBe(BUCKETS.generation.limit);
    expect(first.remaining).toBe(BUCKETS.generation.limit - 1);
    expect(first.resetAtEpochMs).toBe(clock.now() + BUCKETS.generation.windowMs);

    const firstResetAt = first.resetAtEpochMs;

    clock.advance(1_000);
    const second = await backend.check({ bucket: "generation", clientId: "alice" });
    expect(second.allowed).toBe(true);
    expect(second.remaining).toBe(BUCKETS.generation.limit - 2);
    // The reset time must not drift while we are still inside the window.
    expect(second.resetAtEpochMs).toBe(firstResetAt);
  });

  it("rolls the window lazily at exactly resetAtEpochMs (R4.2 preserved)", async () => {
    const clock = makeClock();
    const backend = createMemoryBackend({ now: clock.now });

    const first = await backend.check({ bucket: "generation", clientId: "bob" });
    const firstResetAt = first.resetAtEpochMs;

    // Jump to exactly the reset boundary — the current window must have
    // ended (now >= resetAtEpochMs) and the counter must restart at 1.
    clock.set(firstResetAt);
    const rolled = await backend.check({ bucket: "generation", clientId: "bob" });

    expect(rolled.allowed).toBe(true);
    expect(rolled.remaining).toBe(BUCKETS.generation.limit - 1);
    expect(rolled.resetAtEpochMs).toBe(firstResetAt + BUCKETS.generation.windowMs);
  });

  it("rolls the window lazily after resetAtEpochMs has passed", async () => {
    const clock = makeClock();
    const backend = createMemoryBackend({ now: clock.now });

    const first = await backend.check({ bucket: "read", clientId: "carol" });
    const firstResetAt = first.resetAtEpochMs;

    clock.set(firstResetAt + 5_000);
    const rolled = await backend.check({ bucket: "read", clientId: "carol" });

    expect(rolled.allowed).toBe(true);
    expect(rolled.remaining).toBe(BUCKETS.read.limit - 1);
    expect(rolled.resetAtEpochMs).toBe(firstResetAt + 5_000 + BUCKETS.read.windowMs);
  });

  it("keeps bucket keyspaces isolated: generation does not consume from read", async () => {
    const clock = makeClock();
    const backend = createMemoryBackend({ now: clock.now });

    // Exhaust the generation bucket for one client.
    for (let index = 0; index < BUCKETS.generation.limit; index += 1) {
      await backend.check({ bucket: "generation", clientId: "dave" });
    }
    const genBlocked = await backend.check({ bucket: "generation", clientId: "dave" });
    expect(genBlocked.allowed).toBe(false);
    expect(genBlocked.remaining).toBe(0);

    // The same clientId on the read bucket must start fresh.
    const readFirst = await backend.check({ bucket: "read", clientId: "dave" });
    expect(readFirst.allowed).toBe(true);
    expect(readFirst.remaining).toBe(BUCKETS.read.limit - 1);
    expect(readFirst.limit).toBe(BUCKETS.read.limit);
  });

  it("keeps per-client counts independent within the same bucket", async () => {
    const clock = makeClock();
    const backend = createMemoryBackend({ now: clock.now });

    const a1 = await backend.check({ bucket: "generation", clientId: "alice" });
    const a2 = await backend.check({ bucket: "generation", clientId: "alice" });
    const b1 = await backend.check({ bucket: "generation", clientId: "bob" });

    expect(a1.remaining).toBe(BUCKETS.generation.limit - 1);
    expect(a2.remaining).toBe(BUCKETS.generation.limit - 2);
    // Bob is on his first request regardless of how many Alice spent.
    expect(b1.remaining).toBe(BUCKETS.generation.limit - 1);
    expect(b1.allowed).toBe(true);
  });

  it("allows exactly `limit` requests and blocks the (limit + 1)-th in the same window", async () => {
    const clock = makeClock();
    const backend = createMemoryBackend({ now: clock.now });
    const limit = BUCKETS.generation.limit;

    // First `limit - 1` calls — all allowed, remaining strictly positive.
    for (let index = 1; index <= limit - 1; index += 1) {
      const decision = await backend.check({ bucket: "generation", clientId: "eve" });
      expect(decision.allowed).toBe(true);
      expect(decision.remaining).toBe(limit - index);
    }

    // The `limit`-th call — still allowed (count === limit) with remaining 0.
    const atLimit = await backend.check({ bucket: "generation", clientId: "eve" });
    expect(atLimit.allowed).toBe(true);
    expect(atLimit.remaining).toBe(0);

    // The (limit + 1)-th call — blocked.
    const over = await backend.check({ bucket: "generation", clientId: "eve" });
    expect(over.allowed).toBe(false);
    expect(over.remaining).toBe(0);
    expect(over.limit).toBe(limit);
  });

  it("defaults to Date.now when no clock is injected", async () => {
    const backend = createMemoryBackend();
    const before = Date.now();
    const decision = await backend.check({ bucket: "read", clientId: "frank" });
    const after = Date.now();

    expect(decision.allowed).toBe(true);
    expect(decision.resetAtEpochMs).toBeGreaterThanOrEqual(before + BUCKETS.read.windowMs);
    expect(decision.resetAtEpochMs).toBeLessThanOrEqual(after + BUCKETS.read.windowMs);
  });

  it("exposes the backend name as 'memory' for logging and health checks", () => {
    const backend = createMemoryBackend();
    expect(backend.name).toBe("memory");
  });
});
