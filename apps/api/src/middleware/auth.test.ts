import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildAuthOptions, getAuth } from "./auth.js";

/**
 * Phase 8 task C3 — cross-subdomain session cookie configuration.
 *
 * These tests inspect the Better Auth options object produced by
 * `buildAuthOptions(env)` (the pure helper that `createAuth()` spreads into
 * `betterAuth()`), so they assert the production vs. non-production cookie
 * branches without constructing a real Drizzle/Neon connection.
 *
 * Covers R3.3 (Secure/HttpOnly/SameSite=None), R3.4 (Domain=.stackfast.app),
 * and R3.6 (non-production stays host-only same-origin).
 */
describe("buildAuthOptions cookie configuration", () => {
  const originalNodeEnv = process.env.NODE_ENV;

  afterEach(() => {
    // Restore whatever NODE_ENV the suite started with so a test that pokes
    // process.env does not leak into the others.
    if (originalNodeEnv === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = originalNodeEnv;
    }
  });

  describe("production environment (R3.3, R3.4)", () => {
    it("enables cross-subdomain cookies scoped to .stackfast.app", () => {
      const options = buildAuthOptions({ NODE_ENV: "production" });

      expect(options.advanced?.crossSubDomainCookies).toEqual({
        enabled: true,
        domain: ".stackfast.app",
      });
    });

    it("sets Secure, HttpOnly, and SameSite=None default cookie attributes", () => {
      const options = buildAuthOptions({ NODE_ENV: "production" });

      expect(options.advanced?.defaultCookieAttributes).toMatchObject({
        secure: true,
        httpOnly: true,
        sameSite: "none",
      });
    });

    it("honors NODE_ENV from process.env when no env argument is passed", () => {
      process.env.NODE_ENV = "production";

      const options = buildAuthOptions();

      expect(options.advanced?.crossSubDomainCookies?.enabled).toBe(true);
      expect(options.advanced?.crossSubDomainCookies?.domain).toBe(".stackfast.app");
      expect(options.advanced?.defaultCookieAttributes?.sameSite).toBe("none");
    });
  });

  describe("non-production environment (R3.6)", () => {
    it("omits SameSite=None and the cross-subdomain domain in development", () => {
      const options = buildAuthOptions({ NODE_ENV: "development" });

      // No `advanced` block at all -> host-only, same-origin cookies, so Vite's
      // dev proxy and unit tests are unaffected.
      expect(options.advanced).toBeUndefined();
    });

    it("omits the advanced cookie block when NODE_ENV is unset", () => {
      delete process.env.NODE_ENV;

      const options = buildAuthOptions();

      expect(options.advanced).toBeUndefined();
    });

    it("does not enable cross-subdomain cookies for the test environment", () => {
      const options = buildAuthOptions({ NODE_ENV: "test" });

      expect(options.advanced?.crossSubDomainCookies).toBeUndefined();
      expect(options.advanced?.defaultCookieAttributes).toBeUndefined();
    });
  });

  describe("base options shared across environments", () => {
    it("always configures the GitHub social provider and session cookie cache", () => {
      const options = buildAuthOptions({ NODE_ENV: "production" });

      expect(options.socialProviders?.github).toBeDefined();
      expect(options.session?.cookieCache?.enabled).toBe(true);
    });
  });
});

describe("getAuth catalog-only fallback", () => {
  let originalDatabaseUrl: string | undefined;

  beforeEach(() => {
    originalDatabaseUrl = process.env.DATABASE_URL;
  });

  afterEach(() => {
    if (originalDatabaseUrl === undefined) {
      delete process.env.DATABASE_URL;
    } else {
      process.env.DATABASE_URL = originalDatabaseUrl;
    }
  });

  it("returns null when DATABASE_URL is not configured", () => {
    // test-setup.ts deletes DATABASE_URL, so this exercises the catalog-only
    // path that must keep working unchanged after the C3 refactor.
    delete process.env.DATABASE_URL;

    expect(getAuth()).toBeNull();
  });
});
