// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as Sentry from "@sentry/react";
import { __resetSentryForTests, initSentry, isEnabled } from "./sentry";

/**
 * Unit tests for the web (browser) Sentry module (design §
 * "apps/web/src/lib/sentry.ts", requirements R7.2, R7.3, R7.4).
 *
 * Mirrors the API-side suite at `apps/api/src/observability/sentry.test.ts`:
 * every assertion reads `Sentry.getClient()` (the Sentry v10 accessor for the
 * client bound to the current scope) rather than making any network call, so
 * the suite is hermetic. A syntactically valid but inert DSN is used so
 * `Sentry.init` accepts it without attempting a real transport.
 *
 * The browser SDK needs DOM globals, so this file runs under happy-dom.
 */

// A syntactically valid DSN. Sentry parses but never reaches the network in tests.
const TEST_DSN = "https://examplePublicKey@o0.ingest.sentry.io/0";
const OTHER_DSN = "https://otherPublicKey@o1.ingest.sentry.io/1";

beforeEach(() => {
  vi.unstubAllEnvs();
  __resetSentryForTests();
});

afterEach(() => {
  __resetSentryForTests();
  vi.unstubAllEnvs();
});

describe("initSentry — DSN gating (R7.3)", () => {
  it("is a no-op when VITE_SENTRY_DSN is unset", () => {
    initSentry();

    expect(Sentry.getClient()).toBeUndefined();
    expect(isEnabled()).toBe(false);
  });

  it("is a no-op when VITE_SENTRY_DSN is the empty string", () => {
    vi.stubEnv("VITE_SENTRY_DSN", "");
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

describe("initSentry — initialization and idempotence (R7.2, R7.4)", () => {
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

  it("reads the DSN from import.meta.env.VITE_SENTRY_DSN when no option is given", () => {
    vi.stubEnv("VITE_SENTRY_DSN", TEST_DSN);
    initSentry();

    expect(Sentry.getClient()).toBeDefined();
    expect(isEnabled()).toBe(true);
  });
});

describe("initSentry — release tag (R7.2)", () => {
  it("sets release from VITE_APP_RELEASE", () => {
    vi.stubEnv("VITE_APP_RELEASE", "abc123def456");
    initSentry({ dsn: TEST_DSN });

    expect(Sentry.getClient()?.getOptions().release).toBe("abc123def456");
  });

  it("prefers an explicit release option over the env var", () => {
    vi.stubEnv("VITE_APP_RELEASE", "from-env");
    initSentry({ dsn: TEST_DSN, release: "from-option" });

    expect(Sentry.getClient()?.getOptions().release).toBe("from-option");
  });
});

describe("initSentry — MVP sampling defaults (R7.2)", () => {
  it("initializes with error sample rate 1.0 and trace sample rate 0.0", () => {
    initSentry({ dsn: TEST_DSN });
    const options = Sentry.getClient()?.getOptions();

    expect(options?.sampleRate).toBe(1.0);
    expect(options?.tracesSampleRate).toBe(0);
    expect(options?.sendDefaultPii).toBe(false);
  });
});
