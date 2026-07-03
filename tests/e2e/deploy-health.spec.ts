import { expect, test } from "@playwright/test";

/**
 * Deploy E2E — health check (Phase 8 C4).
 *
 * Validates:
 *   - R5.1 — `GET /health` returns HTTP 200 with body `OK`.
 *   - R5.3 — `/health` is reachable without authentication headers / cookies.
 *
 * These assertions hit the API origin directly (no web UI), so they use the
 * `request` fixture rather than driving a page. The `request` fixture is a
 * standalone APIRequestContext that carries no browser cookies, which is
 * exactly what R5.3 ("accessible without authentication headers") requires:
 * an unauthenticated, cookie-less client must still get 200 OK.
 *
 * Locally these run against `pnpm dev` (the Playwright-managed API webServer);
 * in G5 the same spec runs against the staging origin.
 */

// `playwright.config.ts` exposes the API base as `E2E_API_URL` including the
// `/api/v1` suffix. `/health` lives at the API root, so strip the suffix to
// derive the origin. Default mirrors the config's API port (3100).
const API_ORIGIN = (process.env.E2E_API_URL ?? "http://127.0.0.1:3100/api/v1").replace(/\/api\/v1\/?$/, "");

test.describe("deploy: health check (R5.1, R5.3)", () => {
  test("GET /health returns 200 with body OK and requires no auth", async ({ request }) => {
    const response = await request.get(`${API_ORIGIN}/health`);

    // R5.1 — exact status + body contract the Railway healthcheck depends on.
    expect(response.status()).toBe(200);
    const body = await response.text();
    expect(body).toBe("OK");

    // R5.3 — the request above sent no Authorization header and no session
    // cookie (the `request` fixture has an empty cookie jar), so a 200 here
    // proves the route is open. Belt-and-suspenders: the response must not
    // challenge for credentials.
    expect(response.status()).not.toBe(401);
    expect(response.headers()["www-authenticate"]).toBeUndefined();
  });
});
