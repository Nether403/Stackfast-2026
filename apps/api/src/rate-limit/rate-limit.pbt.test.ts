/**
 * Rate-limit property-based tests.
 *
 * Scope
 * -----
 * This file covers **Property 1** from
 * [`design.md` § 8 "Testing strategy — Property-based tests"]
 * (../../../../.kiro/specs/phase-8-deployment/design.md):
 *
 *   > **Property 1 — Upstash failures never produce a 429 (fail-open).**
 *   > For any sequence of generator-produced requests where a random subset
 *   > of them trigger an injected `RateLimitBackend.check()` failure, the
 *   > corresponding responses MUST have status in `{200, 401, 404}` — never
 *   > `429`. All other request indices are unconstrained (they may be 200
 *   > or 429 depending on quota).
 *
 * This is the rate-limit PBT file. The sibling Sentry PBT (Property 2)
 * lands in B2, and the app-level PBTs (Properties 3–5) land in C2
 * alongside `app.pbt.test.ts`.
 *
 * Acceptance criterion
 * --------------------
 * **Validates: Requirements R4.5** — rate-limit backend failures must
 * never produce HTTP 429. A3 already covers the invariant with example
 * unit tests; this file re-asserts the same invariant across the whole
 * input space that fast-check can reach.
 *
 * Harness shape
 * -------------
 * Per the task brief we drive the property through a minimal in-test
 * harness rather than booting the real Hono app. The harness composition
 * mirrors what `apps/api/src/app.ts` will do after A6:
 *
 *   scriptedBackend  — delegates to a real `createMemoryBackend` instance
 *                       when the generator says "do not fail", and rejects
 *                       with an `Error` when the generator says "fail".
 *                       The shared memory instance keeps quota accounting
 *                       realistic so non-failed calls behave like a real
 *                       request would.
 *   wrapFailOpen     — the A3 wrapper under test. Must swallow any inner
 *                       `check()` error and return a synthetic allow.
 *   handler          — the two-line equivalent of the Hono middleware:
 *                       return 429 iff `decision.allowed === false`, else
 *                       return 200. Nothing else can produce a 429 in
 *                       this harness.
 *
 * Because the harness has no auth middleware and no router, statuses
 * `401` and `404` are unreachable here — the design-level allowed set
 * `{200, 401, 404}` collapses to `{200}`. The stricter assertion we
 * actually need for Property 1 is the negative one: **whenever the
 * scripted backend failed for request `i`, the observed status MUST NOT
 * be 429**. That is exactly what design § 8 Property 1 requires.
 *
 * Determinism
 * -----------
 * The harness uses a fixed-seeded deterministic clock (same shape as
 * `memory.test.ts` and `fail-open.test.ts`). Each property run advances
 * the clock by 1 ms per request so the memory backend's lazy rollover
 * behaves predictably across sequence lengths up to the window size.
 * fast-check is invoked with `numRuns: 100` and a fixed seed so failures
 * produce a reproducible counterexample.
 */

import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { BUCKET_NAMES, type BucketName } from "./buckets.js";
import { wrapFailOpen } from "./fail-open.js";
import { createMemoryBackend } from "./memory.js";
import type { RateLimitBackend } from "./types.js";

/**
 * Deterministic clock matching the one in `memory.test.ts` /
 * `fail-open.test.ts`. Starts at a fixed epoch-ms so fast-check
 * counterexamples are reproducible regardless of wall-clock drift.
 */
function makeClock(start = 1_700_000_000_000): {
  now: () => number;
  advance: (ms: number) => void;
} {
  let current = start;
  return {
    now: () => current,
    advance: (ms: number) => {
      current += ms;
    },
  };
}

/**
 * Drive one generator-produced sequence through the harness and collect
 * the observed statuses per request index. Returns the status array so
 * the property assertion can inspect the correspondence between
 * `failures[i]` and `statuses[i]`.
 */
async function runSequence(input: {
  failures: readonly boolean[];
  bucket: BucketName;
  clientIds: readonly string[];
}): Promise<number[]> {
  const clock = makeClock();

  // Build a fresh memory backend per run so quota accounting is
  // isolated between property iterations. The scripted backend below
  // delegates into this instance for non-failed calls.
  const memory = createMemoryBackend({ now: clock.now });
  let callIndex = 0;
  const scripted: RateLimitBackend = {
    name: "upstash",
    async check(args) {
      const i = callIndex++;
      if (input.failures[i] === true) {
        throw new Error(`scripted upstash failure at call #${i}`);
      }
      return memory.check(args);
    },
  };

  // Silent logger so the `[rate-limit] upstash unavailable` line does
  // not spam test output during property shrinking.
  const wrapped = wrapFailOpen(scripted, {
    now: clock.now,
    logger: () => {
      /* intentionally silent in tests */
    },
  });

  const statuses: number[] = [];
  for (let i = 0; i < input.failures.length; i += 1) {
    const decision = await wrapped.check({
      bucket: input.bucket,
      clientId: input.clientIds[i] ?? "anon",
    });
    // Middleware-equivalent: a disallowed decision is the only path to
    // 429 in the real Hono middleware. A successful decision yields a
    // handler response, modeled here as 200 (the auth / not-found 401 /
    // 404 exits are not reachable in this minimal harness).
    statuses.push(decision.allowed ? 200 : 429);

    // Advance the clock by 1 ms per request so that, for sequences
    // close to the bucket window size, the memory backend's lazy
    // rollover behaves the same way it will in production without
    // forcing an artificial rollover mid-run.
    clock.advance(1);
  }

  return statuses;
}

describe("rate-limit fail-open property (design § 8 Property 1)", () => {
  // Keep sequences under both bucket limits so that non-failing calls
  // alone cannot legitimately produce a 429 within a run — any 429 we
  // ever see in this harness must come from a truly over-quota
  // non-failing call, which is fine for the property because the
  // invariant only constrains indices where `failures[i]` is true.
  //
  // `numRuns: 100` keeps the whole file well under the ~10 s budget
  // called out in the task brief. The fixed seed makes failures
  // reproducible.
  it("never returns 429 for a request whose backend call failed (Validates: Requirements R4.5)", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          // One boolean per request, minLength 1 so the property
          // always exercises at least one `check()`.
          failures: fc.array(fc.boolean(), { minLength: 1, maxLength: 100 }),
          bucket: fc.constantFrom<BucketName>(...BUCKET_NAMES),
          // Small client-id pool keeps quota contention realistic —
          // some runs will concentrate all traffic on one client,
          // others will spread it across two or three. `fc.webSegment`
          // (per design § 8 Property 1 generator) produces URL-safe
          // strings that match what real `resolveClientId` outputs.
          clientPool: fc.array(fc.webSegment(), { minLength: 1, maxLength: 3 }),
          // Per-request client index into `clientPool` — generated at
          // the same length as `failures` inside the predicate so the
          // two arrays always align.
          clientIndices: fc.array(fc.nat(2), { minLength: 1, maxLength: 100 }),
        }),
        async ({ failures, bucket, clientPool, clientIndices }) => {
          // Align lengths: if the generator produced mismatched
          // lengths, truncate to the shorter so every failure bit has
          // a matching client id.
          const n = Math.min(failures.length, clientIndices.length);
          const trimmedFailures = failures.slice(0, n);
          const clientIds = clientIndices
            .slice(0, n)
            .map((idx) => clientPool[idx % clientPool.length] ?? "anon");

          const statuses = await runSequence({
            failures: trimmedFailures,
            bucket,
            clientIds,
          });

          // The property: for every index where the backend failed,
          // the observed status MUST NOT be 429. (Design § 8 states
          // the allowed set as `{200, 401, 404}`; in this minimal
          // harness 401 / 404 are unreachable, so the invariant
          // collapses to "status === 200" for failed indices.)
          for (let i = 0; i < trimmedFailures.length; i += 1) {
            if (trimmedFailures[i] === true) {
              expect(statuses[i]).not.toBe(429);
              expect(statuses[i]).toBe(200);
            }
          }
        },
      ),
      {
        numRuns: 100,
        // Fixed seed so any counterexample is reproducible across CI
        // runs and local replays. Drop / change this seed to rotate
        // the input space during exploratory runs.
        seed: 424242,
        verbose: true,
      },
    );
  });
});
