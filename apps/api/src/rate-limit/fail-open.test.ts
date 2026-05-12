import { describe, expect, it, vi } from "vitest";
import { BUCKETS } from "./buckets.js";
import { wrapFailOpen } from "./fail-open.js";
import type {
  RateLimitBackend,
  RateLimitCheckArgs,
  RateLimitDecision,
} from "./types.js";

/**
 * Deterministic clock — same shape used by memory.test.ts.
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

/**
 * Scriptable backend: each call consumes the next entry from `script`.
 *   - function → called with `args`, its return/throw becomes the result
 *   - "throw"  → rejects with a default Error
 *   - "sync-throw" → throws synchronously (not a rejected promise)
 *   - otherwise → resolves with the literal decision
 *
 * Keeps the test harness explicit about what the inner backend does on
 * each call so the log-gate / recovery paths can be driven precisely.
 */
type ScriptStep =
  | RateLimitDecision
  | "throw"
  | "sync-throw"
  | ((args: RateLimitCheckArgs) => Promise<RateLimitDecision> | RateLimitDecision);

function makeScriptedBackend(
  script: ScriptStep[],
  name: RateLimitBackend["name"] = "upstash",
): { backend: RateLimitBackend; calls: RateLimitCheckArgs[] } {
  const calls: RateLimitCheckArgs[] = [];
  let index = 0;
  const backend: RateLimitBackend = {
    name,
    check(args) {
      calls.push(args);
      if (index >= script.length) {
        throw new Error(`scripted backend ran out of steps at call #${index + 1}`);
      }
      const step = script[index++];
      if (step === "throw") {
        return Promise.reject(new Error("upstash 503"));
      }
      if (step === "sync-throw") {
        throw new Error("synchronous boom");
      }
      if (typeof step === "function") {
        const result = step(args);
        return Promise.resolve(result);
      }
      return Promise.resolve(step);
    },
  };
  return { backend, calls };
}

function okDecision(bucket: RateLimitCheckArgs["bucket"], nowMs: number): RateLimitDecision {
  return {
    allowed: true,
    remaining: BUCKETS[bucket].limit - 1,
    limit: BUCKETS[bucket].limit,
    resetAtEpochMs: nowMs + BUCKETS[bucket].windowMs,
  };
}

describe("wrapFailOpen", () => {
  it("passes a successful decision through unchanged and does not log (Validates: Requirements R4.5)", async () => {
    const clock = makeClock();
    const logger = vi.fn();
    const decision = okDecision("generation", clock.now());
    const { backend } = makeScriptedBackend([decision]);

    const wrapped = wrapFailOpen(backend, { now: clock.now, logger });
    const out = await wrapped.check({ bucket: "generation", clientId: "alice" });

    expect(out).toEqual(decision);
    expect(logger).not.toHaveBeenCalled();
  });

  it("allows the request when the inner backend rejects and returns a bucket-sized synthetic decision (Validates: Requirements R4.5)", async () => {
    const clock = makeClock();
    const logger = vi.fn();
    const { backend } = makeScriptedBackend(["throw"]);

    const wrapped = wrapFailOpen(backend, { now: clock.now, logger });
    const out = await wrapped.check({ bucket: "generation", clientId: "alice" });

    expect(out.allowed).toBe(true);
    expect(out.limit).toBe(BUCKETS.generation.limit);
    expect(out.remaining).toBe(BUCKETS.generation.limit);
    expect(out.resetAtEpochMs).toBe(clock.now() + BUCKETS.generation.windowMs);
  });

  it("logs exactly once across multiple failures inside a 60 s window (Validates: Requirements R4.5)", async () => {
    const clock = makeClock();
    const logger = vi.fn();
    const { backend } = makeScriptedBackend(["throw", "throw", "throw", "throw"]);

    const wrapped = wrapFailOpen(backend, { now: clock.now, logger });

    await wrapped.check({ bucket: "generation", clientId: "alice" });
    clock.advance(10_000);
    await wrapped.check({ bucket: "generation", clientId: "alice" });
    clock.advance(20_000);
    await wrapped.check({ bucket: "read", clientId: "bob" });
    clock.advance(29_999); // still inside the first 60 s window (total 59_999 ms)
    await wrapped.check({ bucket: "read", clientId: "bob" });

    const matching = logger.mock.calls.filter(
      (call) =>
        typeof call[0] === "string" &&
        (call[0] as string).startsWith("[rate-limit] upstash unavailable"),
    );
    expect(matching).toHaveLength(1);
  });

  it("logs again once a full 60 s has elapsed since the last log line (Validates: Requirements R4.5)", async () => {
    const clock = makeClock();
    const logger = vi.fn();
    const { backend } = makeScriptedBackend(["throw", "throw", "throw"]);

    const wrapped = wrapFailOpen(backend, { now: clock.now, logger });

    await wrapped.check({ bucket: "generation", clientId: "alice" }); // logs
    clock.advance(30_000);
    await wrapped.check({ bucket: "generation", clientId: "alice" }); // suppressed
    clock.advance(30_000); // total 60_000 ms since first log
    await wrapped.check({ bucket: "generation", clientId: "alice" }); // logs again

    const matching = logger.mock.calls.filter(
      (call) =>
        typeof call[0] === "string" &&
        (call[0] as string).startsWith("[rate-limit] upstash unavailable"),
    );
    expect(matching).toHaveLength(2);
  });

  it("resets the log-gate on a successful check so the next failure logs immediately (Validates: Requirements R4.5)", async () => {
    const clock = makeClock();
    const logger = vi.fn();
    const decision = okDecision("generation", clock.now() + 5_000);
    const { backend } = makeScriptedBackend(["throw", decision, "throw"]);

    const wrapped = wrapFailOpen(backend, { now: clock.now, logger });

    await wrapped.check({ bucket: "generation", clientId: "alice" }); // failure → log #1
    clock.advance(5_000);
    const recovered = await wrapped.check({ bucket: "generation", clientId: "alice" }); // success → reset
    expect(recovered).toEqual(decision);

    clock.advance(1_000); // well under 60 s since log #1
    await wrapped.check({ bucket: "generation", clientId: "alice" }); // failure → log #2 (not suppressed)

    const matching = logger.mock.calls.filter(
      (call) =>
        typeof call[0] === "string" &&
        (call[0] as string).startsWith("[rate-limit] upstash unavailable"),
    );
    expect(matching).toHaveLength(2);
  });

  it("treats a synchronous throw from the inner check() the same as a rejected promise (Validates: Requirements R4.5)", async () => {
    const clock = makeClock();
    const logger = vi.fn();
    const { backend } = makeScriptedBackend(["sync-throw"]);

    const wrapped = wrapFailOpen(backend, { now: clock.now, logger });
    const out = await wrapped.check({ bucket: "read", clientId: "carol" });

    expect(out.allowed).toBe(true);
    expect(out.limit).toBe(BUCKETS.read.limit);
    expect(out.remaining).toBe(BUCKETS.read.limit);
    expect(out.resetAtEpochMs).toBe(clock.now() + BUCKETS.read.windowMs);

    const matching = logger.mock.calls.filter(
      (call) =>
        typeof call[0] === "string" &&
        (call[0] as string).startsWith("[rate-limit] upstash unavailable"),
    );
    expect(matching).toHaveLength(1);
  });

  it("preserves the inner backend's name (memory or upstash)", () => {
    const logger = vi.fn();
    const memoryInner: RateLimitBackend = {
      name: "memory",
      check: async () => okDecision("read", 0),
    };
    const upstreamInner: RateLimitBackend = {
      name: "upstash",
      check: async () => okDecision("read", 0),
    };

    expect(wrapFailOpen(memoryInner, { logger }).name).toBe("memory");
    expect(wrapFailOpen(upstreamInner, { logger }).name).toBe("upstash");
  });
});
