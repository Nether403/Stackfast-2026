import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as Sentry from "@sentry/node";
import {
  __resetSentryForTests,
  attachSentryToHono,
  initSentry,
  isEnabled,
  scrubEvent,
} from "./sentry.js";

/**
 * Unit tests for the API Sentry module (design § "apps/api/src/observability/sentry.ts",
 * requirements R7.1, R7.3, R7.4, R7.5, R7.6).
 *
 * Every assertion reads `Sentry.getClient()` (the Sentry v10 accessor for the
 * client bound to the current scope) rather than making any network call, so
 * the suite is hermetic. A syntactically valid but inert DSN is used so
 * `Sentry.init` accepts it without attempting a real transport.
 */

// A syntactically valid DSN. Sentry parses but never reaches the network in tests.
const TEST_DSN = "https://examplePublicKey@o0.ingest.sentry.io/0";
const OTHER_DSN = "https://otherPublicKey@o1.ingest.sentry.io/1";

const ENV_KEYS = [
  "SENTRY_DSN",
  "SENTRY_RELEASE",
  "RAILWAY_GIT_COMMIT_SHA",
  "NODE_ENV",
] as const;

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

describe("initSentry — DSN gating (R7.3)", () => {
  it("is a no-op when SENTRY_DSN is unset", () => {
    initSentry();

    expect(Sentry.getClient()).toBeUndefined();
    expect(isEnabled()).toBe(false);
  });

  it("is a no-op when SENTRY_DSN is the empty string", () => {
    process.env.SENTRY_DSN = "";
    initSentry();

    expect(Sentry.getClient()).toBeUndefined();
    expect(isEnabled()).toBe(false);
  });

  it("does not register a client when an explicit empty dsn option is passed", () => {
    initSentry({ dsn: "" });

    expect(Sentry.getClient()).toBeUndefined();
    expect(isEnabled()).toBe(false);
  });
});

describe("initSentry — initialization and idempotence (R7.1, R7.4)", () => {
  it("initializes exactly one client when a DSN is present", () => {
    initSentry({ dsn: TEST_DSN });

    expect(Sentry.getClient()).toBeDefined();
    expect(isEnabled()).toBe(true);
  });

  it("leaves exactly one active client after any number of init calls with the same DSN", () => {
    initSentry({ dsn: TEST_DSN });
    const firstClient = Sentry.getClient();

    initSentry({ dsn: TEST_DSN });
    initSentry({ dsn: TEST_DSN });
    initSentry({ dsn: TEST_DSN });

    expect(Sentry.getClient()).toBe(firstClient);
    expect(isEnabled()).toBe(true);
  });

  it("keeps the first client and warns when a repeat call passes a different DSN", () => {
    const logger = vi.fn();
    initSentry({ dsn: TEST_DSN, logger });
    const firstClient = Sentry.getClient();

    initSentry({ dsn: OTHER_DSN, logger });

    expect(Sentry.getClient()).toBe(firstClient);
    expect(logger).toHaveBeenCalledTimes(1);
    expect(String(logger.mock.calls[0]?.[0])).toContain("different DSN");
  });

  it("reads the DSN from process.env.SENTRY_DSN when no option is given", () => {
    process.env.SENTRY_DSN = TEST_DSN;
    initSentry();

    expect(Sentry.getClient()).toBeDefined();
    expect(isEnabled()).toBe(true);
  });
});

describe("initSentry — release tag (R7.6)", () => {
  it("sets release to process.env.RAILWAY_GIT_COMMIT_SHA", () => {
    process.env.RAILWAY_GIT_COMMIT_SHA = "abc123def456";
    initSentry({ dsn: TEST_DSN });

    expect(Sentry.getClient()?.getOptions().release).toBe("abc123def456");
  });

  it("prefers an explicit release option over the env var", () => {
    process.env.RAILWAY_GIT_COMMIT_SHA = "from-env";
    initSentry({ dsn: TEST_DSN, release: "from-option" });

    expect(Sentry.getClient()?.getOptions().release).toBe("from-option");
  });

  it("falls back to SENTRY_RELEASE when RAILWAY_GIT_COMMIT_SHA is unset", () => {
    process.env.SENTRY_RELEASE = "fallback-sha";
    initSentry({ dsn: TEST_DSN });

    expect(Sentry.getClient()?.getOptions().release).toBe("fallback-sha");
  });

  it("warns but still initializes when no release tag is set in production", () => {
    process.env.NODE_ENV = "production";
    const logger = vi.fn();
    initSentry({ dsn: TEST_DSN, logger });

    expect(Sentry.getClient()).toBeDefined();
    expect(logger).toHaveBeenCalledTimes(1);
    expect(String(logger.mock.calls[0]?.[0])).toContain("release");
  });
});

describe("initSentry — MVP sampling defaults (R7.1)", () => {
  it("initializes with error sample rate 1.0 and trace sample rate 0.0", () => {
    initSentry({ dsn: TEST_DSN });
    const options = Sentry.getClient()?.getOptions();

    expect(options?.sampleRate).toBe(1.0);
    expect(options?.tracesSampleRate).toBe(0);
    expect(options?.sendDefaultPii).toBe(false);
  });
});

describe("scrubEvent (R7.5)", () => {
  it("strips idea and constraints from event.request.data", () => {
    const event: Sentry.Event = {
      request: {
        data: { idea: "a secret idea", constraints: ["budget"], keep: "me" },
      },
    };

    const scrubbed = scrubEvent(event);

    expect(scrubbed.request?.data).toEqual({ keep: "me" });
    expect(scrubbed.request?.data).not.toHaveProperty("idea");
    expect(scrubbed.request?.data).not.toHaveProperty("constraints");
  });

  it("does not mutate the input event or its nested request.data reference", () => {
    const data = { idea: "a secret idea", constraints: ["budget"], keep: "me" };
    const request = { data };
    const event: Sentry.Event = { request };

    const scrubbed = scrubEvent(event);

    // Original references are untouched.
    expect(event.request).toBe(request);
    expect(event.request?.data).toBe(data);
    expect(data).toEqual({ idea: "a secret idea", constraints: ["budget"], keep: "me" });

    // A new object graph was returned.
    expect(scrubbed).not.toBe(event);
    expect(scrubbed.request).not.toBe(request);
    expect(scrubbed.request?.data).not.toBe(data);
  });

  it("returns the original event reference when there is nothing to scrub", () => {
    const event: Sentry.Event = {
      request: { data: { harmless: "value" } },
    };

    expect(scrubEvent(event)).toBe(event);
  });

  it("returns the original event when request is absent", () => {
    const event: Sentry.Event = { message: "boom" };

    expect(scrubEvent(event)).toBe(event);
  });

  it("returns the original event when request.data is a non-JSON body (string)", () => {
    const event: Sentry.Event = {
      request: { data: "idea=secret&constraints=budget" },
    };

    expect(scrubEvent(event)).toBe(event);
  });

  it("strips only the present sensitive key when just one is set", () => {
    const event: Sentry.Event = {
      request: { data: { idea: "secret", keep: "me" } },
    };

    const scrubbed = scrubEvent(event);

    expect(scrubbed.request?.data).toEqual({ keep: "me" });
  });
});

describe("attachSentryToHono", () => {
  it("is a no-op when Sentry is disabled (no DSN)", () => {
    const onError = vi.fn();
    const fakeApp = { onError } as unknown as Parameters<typeof attachSentryToHono>[0];

    attachSentryToHono(fakeApp);

    expect(onError).not.toHaveBeenCalled();
  });

  it("registers an onError handler once Sentry is initialized", () => {
    initSentry({ dsn: TEST_DSN });
    const onError = vi.fn();
    const fakeApp = { onError } as unknown as Parameters<typeof attachSentryToHono>[0];

    attachSentryToHono(fakeApp);

    expect(onError).toHaveBeenCalledTimes(1);
  });
});
