/**
 * Sentry init property-based tests.
 *
 * Scope
 * -----
 * This file covers **Property 2** from
 * [`design.md` § "Testing strategy — Property-based tests"]
 * (../../../../.kiro/specs/phase-8-deployment/design.md):
 *
 *   > **Property 2 — Sentry init is idempotent and a no-op without DSN.**
 *   > For any interleaving of `initSentry()` calls and any combination of
 *   > DSN presence/absence, the active Sentry client count is 0 when DSN is
 *   > falsy and exactly 1 once a non-empty DSN has been set at least once
 *   > before an `init`. Repeat inits return the same client reference.
 *
 * This is the Sentry PBT file. The sibling rate-limit PBT (Property 1)
 * lives in `../rate-limit/rate-limit.pbt.test.ts`; the app-level PBTs
 * (Properties 3–5) land in C2 alongside `app.pbt.test.ts`.
 *
 * Acceptance criteria
 * -------------------
 * **Validates: Requirements R7.3, R7.4**
 *   - R7.3 — when `SENTRY_DSN` is missing/empty/undefined, `initSentry()`
 *     skips initialization and registers no client.
 *   - R7.4 — invoking `initSentry()` more than once leaves exactly one
 *     active client.
 *
 * B1 already covers both criteria with example unit tests in
 * `sentry.test.ts`; this file re-asserts the same invariants across the
 * whole interleaving space that fast-check can reach.
 *
 * Model
 * -----
 * The property replays a generated sequence of two event kinds against the
 * real module:
 *
 *   "set-dsn"  — writes (or clears) `process.env.SENTRY_DSN`. A `null` or
 *                empty payload clears it (a falsy DSN); a valid DSN string
 *                sets it.
 *   "init"     — calls `initSentry()`, which reads the *current* env DSN.
 *
 * Because the module latches `initialized = true` on the first successful
 * init and never tears the client down, the oracle is: a client is bound
 * iff some `init` event fired while the env DSN was truthy — and once
 * bound, `Sentry.getClient()` returns the same reference for the rest of
 * the run. Clearing the DSN *after* a successful init does NOT un-init
 * (latched), and inits while the DSN is falsy stay no-ops (R7.3).
 *
 * Every assertion reads `Sentry.getClient()` (the Sentry v10 scope-bound
 * client accessor) so the suite is hermetic — no transport is ever
 * exercised. Valid-shape DSNs are used so `Sentry.init` accepts them
 * without logging an invalid-DSN error; the property only cares about
 * DSN truthiness, not the specific URL.
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import * as Sentry from "@sentry/node";
import fc from "fast-check";
import { __resetSentryForTests, initSentry, isEnabled } from "./sentry.js";

// Two syntactically valid DSNs. Sentry parses but never reaches the network
// in tests, and a valid shape avoids invalid-DSN warnings during shrinking.
const VALID_DSNS = [
  "https://examplePublicKey@o0.ingest.sentry.io/0",
  "https://otherPublicKey@o1.ingest.sentry.io/1",
] as const;

const ENV_KEYS = ["SENTRY_DSN", "SENTRY_RELEASE", "RAILWAY_GIT_COMMIT_SHA", "NODE_ENV"] as const;

let savedEnv: Record<string, string | undefined>;

beforeEach(() => {
  savedEnv = {};
  for (const key of ENV_KEYS) {
    savedEnv[key] = process.env[key];
    delete process.env[key];
  }
  __resetSentryForTests();
});

afterEach(() => {
  __resetSentryForTests();
  for (const key of ENV_KEYS) {
    if (savedEnv[key] === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = savedEnv[key];
    }
  }
});

type SentryEvent = { kind: "init" } | { kind: "set-dsn"; dsn: string | null };

/**
 * Generator for one event. `set-dsn` payloads cover the three meaningful
 * cases: a valid (truthy) DSN, the empty string, and `null` (cleared) —
 * the latter two being the falsy variants R7.3 must treat as no-ops.
 */
const eventArb: fc.Arbitrary<SentryEvent> = fc.oneof(
  fc.constant<SentryEvent>({ kind: "init" }),
  fc
    .oneof(
      fc.constantFrom<string>(...VALID_DSNS),
      fc.constant(""),
      fc.constant<null>(null),
    )
    .map((dsn): SentryEvent => ({ kind: "set-dsn", dsn })),
);

// Silent logger so the "different DSN" / "no release" warnings the module
// emits do not spam output while fast-check shrinks counterexamples.
const silentLogger = () => {
  /* intentionally silent in tests */
};

describe("sentry init idempotence + no-op property (design § Testing strategy Property 2)", () => {
  it("binds exactly one client iff an init fired with a truthy DSN, and never re-binds (Validates: Requirements R7.3, R7.4)", () => {
    fc.assert(
      fc.property(fc.array(eventArb, { minLength: 1, maxLength: 20 }), (events) => {
        // Fresh module + env state per run so `initialized` never leaks
        // across fast-check iterations.
        __resetSentryForTests();
        delete process.env.SENTRY_DSN;

        // Oracle state, mirroring the module's latching behavior.
        let envDsn: string | null = null; // current env DSN (null = unset/cleared)
        let expectInitialized = false; // becomes true on first init-with-truthy-dsn
        let boundClient: ReturnType<typeof Sentry.getClient> | undefined;

        for (const event of events) {
          if (event.kind === "set-dsn") {
            envDsn = event.dsn;
            if (event.dsn === null || event.dsn === "") {
              delete process.env.SENTRY_DSN;
            } else {
              process.env.SENTRY_DSN = event.dsn;
            }
          } else {
            // "init" — reads current env DSN. Latches on first success.
            initSentry({ logger: silentLogger });
            if (!expectInitialized && envDsn !== null && envDsn !== "") {
              expectInitialized = true;
            }
          }

          // Invariant 1: feature-flag state tracks the model exactly.
          expect(isEnabled()).toBe(expectInitialized);

          const client = Sentry.getClient();
          if (expectInitialized) {
            // Invariant 2 (R7.4): exactly one client, stable by reference.
            expect(client).toBeDefined();
            if (boundClient === undefined) {
              boundClient = client;
            } else {
              expect(client).toBe(boundClient);
            }
          } else {
            // Invariant 3 (R7.3): no client while no truthy-DSN init has run.
            expect(client).toBeUndefined();
          }
        }
      }),
      {
        numRuns: 200,
        // Fixed seed so any counterexample is reproducible across CI runs.
        seed: 424242,
        verbose: true,
      },
    );
  });
});
