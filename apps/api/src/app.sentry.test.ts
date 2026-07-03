import { afterEach, beforeEach, describe, expect, it } from "vitest";
import * as Sentry from "@sentry/node";
import app from "./app.js";
import { __resetSentryForTests, initSentry } from "./observability/sentry.js";

/**
 * Contract tests for B3 — Sentry wired into the API process.
 *
 * Covers the wiring guarantees the unit suites can't reach on their own:
 *   - With SENTRY_DSN unset, no client is registered after a real request
 *     hits the app (R7.3) — i.e. `initSentry()` at startup is a true no-op and
 *     the request path never lazily installs a client.
 *   - With a stubbed DSN, exactly one client is registered (R7.1) and a thrown
 *     error inside a route produces a single captured event tagged with the
 *     request id, while the existing JSON error envelope is still rendered.
 *   - The wired client's `beforeSend` (= `scrubEvent`) strips `idea` /
 *     `constraints` from the captured event payload (R7.5).
 *
 * A syntactically valid but inert DSN is used so `Sentry.init` accepts it
 * without ever reaching the network. Captures are observed by wrapping the
 * active client's `captureException`; no transport is exercised.
 */

const TEST_DSN = "https://examplePublicKey@o0.ingest.sentry.io/0";

let savedDsn: string | undefined;
let savedNodeEnv: string | undefined;

beforeEach(() => {
  savedDsn = process.env.SENTRY_DSN;
  savedNodeEnv = process.env.NODE_ENV;
  delete process.env.SENTRY_DSN;
  __resetSentryForTests();
});

afterEach(() => {
  __resetSentryForTests();
  if (savedDsn === undefined) {
    delete process.env.SENTRY_DSN;
  } else {
    process.env.SENTRY_DSN = savedDsn;
  }
  if (savedNodeEnv === undefined) {
    delete process.env.NODE_ENV;
  } else {
    process.env.NODE_ENV = savedNodeEnv;
  }
});

describe("Sentry API wiring (B3 — R7.1, R7.3, R7.5)", () => {
  it("registers no client when SENTRY_DSN is unset, even after a request (R7.3)", async () => {
    // Mirrors index.ts startup with no DSN configured.
    initSentry();

    const res = await app.request("/health");
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("OK");

    expect(Sentry.getClient()).toBeUndefined();
  });

  it("keeps the client undefined after a route error when DSN is unset (R7.3)", async () => {
    initSentry();

    // A thrown error inside a route still renders the JSON envelope...
    const res = await app.request("/api/v1/stacks/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not-json",
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("Invalid JSON");

    // ...and no Sentry client was lazily installed.
    expect(Sentry.getClient()).toBeUndefined();
  });

  it("registers exactly one client when a DSN is set (R7.1)", () => {
    initSentry({ dsn: TEST_DSN });
    expect(Sentry.getClient()).toBeDefined();
  });

  it("captures a route error once, tagged with requestId, and still renders the JSON envelope (R7.1)", async () => {
    initSentry({ dsn: TEST_DSN });
    const client = Sentry.getClient();
    expect(client).toBeDefined();

    const captures: Array<{ error: unknown; context: unknown }> = [];
    const orig = client!.captureException.bind(client);
    (client as unknown as { captureException: typeof orig }).captureException = ((
      error: Parameters<typeof orig>[0],
      context?: Parameters<typeof orig>[1],
    ) => {
      captures.push({ error, context });
      return orig(error, context);
    }) as typeof orig;

    // Malformed JSON makes parseJson throw an Error that reaches onError —
    // a thrown error originating inside a route.
    const res = await app.request("/api/v1/stacks/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Request-ID": "rid-sentry-1" },
      body: "not-json",
    });

    // The JSON error envelope is preserved (capture did not clobber it).
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("Invalid JSON");
    expect(body.requestId).toBe("rid-sentry-1");

    // Exactly one capture, tagged with the request id (R7.1). The top-level
    // `Sentry.captureException(err, { tags })` routes through the current
    // scope, which forwards the capture context to the client under
    // `hint.captureContext`.
    expect(captures).toHaveLength(1);
    const hint = captures[0]?.context as
      | { captureContext?: { tags?: Record<string, unknown> } }
      | undefined;
    expect(hint?.captureContext?.tags?.requestId).toBe("rid-sentry-1");
  });

  it("scrubs idea/constraints from captured event payloads via the wired beforeSend (R7.5)", () => {
    initSentry({ dsn: TEST_DSN });
    const beforeSend = Sentry.getClient()?.getOptions().beforeSend;
    expect(typeof beforeSend).toBe("function");

    const event = {
      request: { data: { idea: "a secret idea", constraints: ["budget"], keep: "me" } },
    } as Sentry.ErrorEvent;

    const processed = beforeSend!(event, {}) as Sentry.ErrorEvent;

    expect(processed.request?.data).toEqual({ keep: "me" });
    expect(processed.request?.data).not.toHaveProperty("idea");
    expect(processed.request?.data).not.toHaveProperty("constraints");
  });
});
