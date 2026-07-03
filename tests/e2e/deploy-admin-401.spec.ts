import { expect, test } from "@playwright/test";

/**
 * Deploy E2E — admin/internal key gating (Phase 8 C4).
 *
 * Validates:
 *   - R8.1 — requests to `/admin/*` and `/internal/*` with no auth header are
 *     rejected with HTTP 401 before any downstream middleware or handler runs.
 *   - R8.3 — a wrong `X-Admin-API-Key` and a wrong `Authorization: Bearer`
 *     token are both rejected with 401.
 *
 * The 401 variants are the security-critical path and run unconditionally.
 *
 * The matching-key 202 case requires the test runner to know the server's
 * `ADMIN_API_KEY`. Under a bare `pnpm test:e2e` the runner process does not
 * load `.env` (only the API webServer does, via `dotenv -e ../../.env`), so
 * the key is unavailable to the runner and the matching-key assertion is
 * skipped here — that path is already covered by the API contract suite
 * (`apps/api/src/app.test.ts`: "accepts /internal/enrich-tool with valid API
 * key" and "protects admin routes"). When the key IS provided to the runner
 * (e.g. `dotenv -e .env -- pnpm test:e2e`, or the staging run in G5), the 202
 * assertions execute.
 */

const API_ORIGIN = (process.env.E2E_API_URL ?? "http://127.0.0.1:3100/api/v1").replace(/\/api\/v1\/?$/, "");

// Both protected prefixes. `/admin/compatibility/recompute` takes no body;
// `/internal/enrich-tool` validates a body, but the admin gate runs first so
// the 401 variants never reach body parsing.
const ADMIN_PATHS = [
  "/admin/compatibility/recompute",
  "/internal/enrich-tool",
] as const;

const WRONG_KEY = "definitely-not-the-admin-key";

test.describe("deploy: admin/internal 401 enforcement (R8.1, R8.3)", () => {
  for (const path of ADMIN_PATHS) {
    test(`POST ${path} returns 401 with no auth header`, async ({ request }) => {
      const response = await request.post(`${API_ORIGIN}${path}`, {
        headers: { "Content-Type": "application/json" },
        // Body is irrelevant: the admin gate (R8.1) rejects before parsing.
        data: {},
      });
      expect(response.status()).toBe(401);
    });

    test(`POST ${path} returns 401 with a wrong X-Admin-API-Key`, async ({ request }) => {
      const response = await request.post(`${API_ORIGIN}${path}`, {
        headers: { "Content-Type": "application/json", "X-Admin-API-Key": WRONG_KEY },
        data: {},
      });
      expect(response.status()).toBe(401);
    });

    test(`POST ${path} returns 401 with a wrong Bearer token`, async ({ request }) => {
      const response = await request.post(`${API_ORIGIN}${path}`, {
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${WRONG_KEY}` },
        data: {},
      });
      expect(response.status()).toBe(401);
    });
  }

  test("matching admin key authorizes (202) via X-Admin-API-Key and Bearer", async ({ request }) => {
    const adminKey = process.env.ADMIN_API_KEY;
    test.skip(
      !adminKey,
      "ADMIN_API_KEY is not available to the Playwright runner; the matching-key 202 path is covered by apps/api/src/app.test.ts. Provide the key (e.g. `dotenv -e .env -- pnpm test:e2e`) to exercise it here.",
    );

    // X-Admin-API-Key header on the no-body admin route.
    const viaHeader = await request.post(`${API_ORIGIN}/admin/compatibility/recompute`, {
      headers: { "Content-Type": "application/json", "X-Admin-API-Key": adminKey! },
      data: {},
    });
    expect(viaHeader.status()).toBe(202);

    // Authorization: Bearer <key> on the body-validated internal route. A real
    // tool id is required so the handler reaches its 202 (not a 404/400).
    const viaBearer = await request.post(`${API_ORIGIN}/internal/enrich-tool`, {
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminKey!}` },
      data: { toolId: "nextjs" },
    });
    expect(viaBearer.status()).toBe(202);
  });
});
