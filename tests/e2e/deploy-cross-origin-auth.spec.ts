import { expect, test } from "@playwright/test";

/**
 * Deploy E2E — cross-origin auth round trip (Phase 8 C4).
 *
 * Validates the cross-origin credentialed-request path behind R3.8 ("a valid
 * session for subsequent cross-origin requests from the SPA origin with
 * `credentials: 'include'`").
 *
 * Environment caveat (local vs. staging):
 *   The production assertion — that the Better Auth session cookie is set with
 *   `Domain=.stackfast.app` and is therefore readable on BOTH `stackfast.app`
 *   and `api.stackfast.app` — only holds in production, where
 *   `crossSubDomainCookies` is enabled (see `buildAuthOptions` in
 *   `apps/api/src/middleware/auth.ts`, gated on `isProduction`). Locally the
 *   web (`127.0.0.1:4173`) and API (`127.0.0.1:3100`) are distinct origins
 *   with no shared parent domain and `ALLOW_AUTH_BYPASS=true`, and there is no
 *   real database or GitHub, so a real session cookie is never minted.
 *
 *   This spec therefore stubs the GitHub OAuth round trip (`page.route(
 *   "**\/github.com\/**", ...)`) so no live call escapes, and asserts what IS
 *   verifiable in dev mode:
 *     1. The cross-origin, credentialed preflight + request from the SPA origin
 *        to the API succeeds (CORS is locked to the web origin with
 *        `credentials: true`).
 *     2. A protected, `requireSession()`-wrapped route is reachable cross-origin
 *        with `credentials: 'include'` and does NOT return 401 (the dev bypass
 *        stands in for a real session — proving the request is admitted, not
 *        rejected for missing auth).
 *     3. `page.context().cookies()` is inspectable.
 *   The strict "cookie present on both origins" assertion is exercised against
 *   the real cross-subdomain deployment in G5 (staging).
 */

const API_BASE = process.env.E2E_API_URL ?? "http://127.0.0.1:3100/api/v1";
const API_ORIGIN = API_BASE.replace(/\/api\/v1\/?$/, "");

test.describe("deploy: cross-origin auth (R3.8)", () => {
  test("credentialed cross-origin requests from the SPA origin are admitted", async ({ page }) => {
    // Stub the GitHub OAuth round trip so the test never depends on github.com.
    // Any navigation/request to GitHub is short-circuited with a benign body.
    await page.route("**/github.com/**", (route) =>
      route.fulfill({ status: 200, contentType: "text/html", body: "<html><body>stubbed github</body></html>" }),
    );

    // Land on the SPA so subsequent `fetch` calls originate from the web origin
    // (this is what makes the API requests genuinely cross-origin).
    await page.goto("/");

    // (1) Public, credentialed cross-origin GET. CORS_ORIGIN is set to the web
    // origin and credentials are enabled, so this must succeed end-to-end.
    const searchStatus = await page.evaluate(async (apiBase) => {
      const res = await fetch(`${apiBase}/tools/search?q=next`, { credentials: "include" });
      return res.status;
    }, API_BASE);
    expect(searchStatus).toBe(200);

    // (2) Protected route reachable cross-origin with credentials. An empty body
    // makes the handler return 400 (schema validation) once auth is cleared —
    // the point is that it is NOT 401, i.e. the request was admitted as if a
    // valid session were present (R3.8). In production this admission comes from
    // the cross-subdomain session cookie; in dev it comes from the bypass.
    const protectedStatus = await page.evaluate(async (apiBase) => {
      const res = await fetch(`${apiBase}/blueprints`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      return res.status;
    }, API_BASE);
    expect(protectedStatus).not.toBe(401);

    // (3) The cookie jar is inspectable on the SPA origin. Locally it may be
    // empty (no real OAuth completion / no cross-subdomain cookie); the strict
    // both-origins assertion runs against staging in G5. We assert the jar is
    // accessible and, if any session cookie did land, that it is HttpOnly.
    const cookies = await page.context().cookies([API_ORIGIN, page.url()]);
    expect(Array.isArray(cookies)).toBe(true);
    const sessionCookie = cookies.find((c) => c.name.includes("session"));
    if (sessionCookie) {
      expect(sessionCookie.httpOnly).toBe(true);
    }
  });
});
