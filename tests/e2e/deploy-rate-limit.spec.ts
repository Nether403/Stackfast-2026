import { expect, test, type APIRequestContext } from "@playwright/test";

/**
 * Deploy E2E — rate-limit smoke (Phase 8 C4).
 *
 * Validates:
 *   - R6.1 / R6.2 — the 31st `POST /api/v1/blueprints` from one client within
 *     60s returns HTTP 429 with a `Retry-After` header (generation bucket =
 *     30 requests / 60s).
 *   - R6.3 — the 101st `GET /api/v1/tools/search` from one client within 60s
 *     returns HTTP 429 (read bucket = 100 requests / 60s).
 *
 * Runs against the in-memory backend wired by `pnpm dev` (the API webServer
 * leaves `RATE_LIMIT_BACKEND` at its `memory` default). The Upstash path is
 * exercised by the post-deploy smoke script, not here.
 *
 * Client identity is the `x-forwarded-for` header (R4.4). Each test mints a
 * fresh random IP so the buckets start empty even when the API server is
 * reused across Playwright retries, and so the two tests never share a bucket.
 *
 * The generation bucket trips before auth: in `app.ts` the rate-limit
 * middleware is registered ahead of `requireSession()`, so every POST consumes
 * a token regardless of its body or auth outcome. The requests below send an
 * empty body on purpose — once a request clears the limiter it hits the
 * handler's schema validation and returns 400 immediately, which keeps the
 * burst fast (no AI generation) while still exercising the limiter exactly as
 * a real client would.
 */

const API_BASE = process.env.E2E_API_URL ?? "http://127.0.0.1:3100/api/v1";

/** A unique documentation/private-range IP per test run to isolate buckets. */
function freshClientIp(): string {
  const octet = () => Math.floor(Math.random() * 254) + 1;
  return `10.${octet()}.${octet()}.${octet()}`;
}

async function lastStatusOfBurst(
  request: APIRequestContext,
  count: number,
  fire: (i: number) => Promise<{ status: number; retryAfter: string | undefined }>,
): Promise<{ statuses: number[]; retryAfters: (string | undefined)[] }> {
  const statuses: number[] = [];
  const retryAfters: (string | undefined)[] = [];
  for (let i = 0; i < count; i++) {
    const { status, retryAfter } = await fire(i);
    statuses.push(status);
    retryAfters.push(retryAfter);
  }
  return { statuses, retryAfters };
}

test.describe("deploy: rate limiting (R6.1, R6.2, R6.3)", () => {
  test("31st generation POST returns 429 with Retry-After", async ({ request }) => {
    test.setTimeout(60_000);
    const clientIp = freshClientIp();

    const { statuses, retryAfters } = await lastStatusOfBurst(request, 31, async () => {
      const response = await request.post(`${API_BASE}/blueprints`, {
        headers: { "Content-Type": "application/json", "x-forwarded-for": clientIp },
        data: {},
      });
      return { status: response.status(), retryAfter: response.headers()["retry-after"] };
    });

    // The first request must clear the limiter (sanity: the limit is not 0).
    expect(statuses[0]).not.toBe(429);
    // R6.1 / R6.2 — the 31st request (index 30) is the first to exceed the
    // 30/60s generation bucket.
    expect(statuses[30]).toBe(429);
    expect(retryAfters[30]).toBeDefined();
  });

  test("101st read GET returns 429", async ({ request }) => {
    test.setTimeout(60_000);
    const clientIp = freshClientIp();

    const { statuses } = await lastStatusOfBurst(request, 101, async () => {
      const response = await request.get(`${API_BASE}/tools/search?q=next`, {
        headers: { "x-forwarded-for": clientIp },
      });
      return { status: response.status(), retryAfter: response.headers()["retry-after"] };
    });

    // The first 100 reads are allowed; the 101st (index 100) trips the
    // 100/60s read bucket. R6.3.
    expect(statuses[0]).not.toBe(429);
    expect(statuses[100]).toBe(429);
  });
});
