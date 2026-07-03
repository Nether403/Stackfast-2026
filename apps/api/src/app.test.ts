import { afterEach, describe, expect, it, vi } from "vitest";
import app from "./app.js";
import { BUCKETS } from "./rate-limit/buckets.js";
import {
  __resetBackendForTests,
} from "./rate-limit/index.js";
import type {
  RateLimitBackend,
  RateLimitCheckArgs,
  RateLimitDecision,
} from "./rate-limit/types.js";

describe("api", () => {
  it("returns health status", async () => {
    const response = await app.request("/health");

    expect(response.status).toBe(200);
    expect(await response.text()).toBe("OK");
  });

  it("serves OpenAPI-compatible documentation", async () => {
    const response = await app.request("/openapi.json");
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.openapi).toBe("3.1.0");
    expect(body.paths["/api/v1/blueprints"].post).toBeDefined();
  });

  it("sets a configured CORS origin instead of wildcard", async () => {
    const response = await app.request("/api/v1/tools/search", {
      headers: { Origin: "http://localhost:5173" },
    });

    expect(response.headers.get("access-control-allow-origin")).toBe("http://localhost:5173");
    expect(response.headers.get("access-control-allow-credentials")).toBe("true");
  });

  it("returns the canonical catalog for web clients", async () => {
    const response = await app.request("/api/v1/catalog");
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.version).toBeTruthy();
    expect(body.tools.some((tool: { id: string }) => tool.id === "nextjs")).toBe(true);
    expect(body.categories.length).toBeGreaterThan(0);
    expect(body.rules.length).toBeGreaterThan(0);
  });

  it("fails protected generation closed in production when auth is unavailable", async () => {
    const response = await app.request(
      "/api/v1/blueprints",
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-forwarded-for": "prod-auth-test" },
        body: JSON.stringify({ idea: "a production-only auth test" }),
      },
      { NODE_ENV: "production" },
    );

    expect(response.status).toBe(503);
    const body = await response.json();
    expect(body.error).toContain("Authentication is not configured");
  });

  it("searches tools with pagination", async () => {
    const response = await app.request("/api/v1/tools/search?q=next.js&limit=5");
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.items.some((tool: { id: string }) => tool.id === "nextjs")).toBe(true);
    expect(body.limit).toBe(5);
  });

  it("returns tool details", async () => {
    const response = await app.request("/api/v1/tools/nextjs");
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.id).toBe("nextjs");
    expect(body.sourceUrls.length).toBeGreaterThan(0);
  });

  it("returns categories with tool counts", async () => {
    const response = await app.request("/api/v1/categories");
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.items.length).toBeGreaterThan(0);
    expect(body.items[0].toolCount).toBeGreaterThan(0);
  });

  it("analyzes a stack", async () => {
    const response = await app.request("/api/v1/stacks/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ toolIds: ["nextjs", "node", "vercel", "postgres", "prisma"] }),
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.harmonyScore).toBeGreaterThan(0);
    expect(Array.isArray(body.recommendations)).toBe(true);
  });

  it("returns pairwise compatibility", async () => {
    const response = await app.request("/api/v1/compatibility/nextjs/vercel");
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.toolA).toBe("nextjs");
    expect(body.toolB).toBe("vercel");
    expect(typeof body.compatible).toBe("boolean");
  });

  it("generates scaffold file lists", async () => {
    const response = await app.request("/api/v1/scaffolds", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ toolIds: ["nextjs", "node", "vercel", "tailwind"], projectName: "api-test" }),
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.delivery).toBe("file-list");
    expect(body.files.some((file: { path: string }) => file.path === "package.json")).toBe(true);
  });

  it("generates a blueprint response", async () => {
    const response = await app.request("/api/v1/blueprints", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idea: "A subscription dashboard with user login and email notifications" }),
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.recommendedStack.toolIds).toContain("nextjs");
    expect(Array.isArray(body.alternatives)).toBe(true);
  });

  it("returns migration path information", async () => {
    const response = await app.request("/api/v1/migrations/prisma/drizzle");
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.from).toBe("prisma");
    expect(body.to).toBe("drizzle");
    expect(body.steps.length).toBeGreaterThan(0);
  });

  it("protects admin routes", async () => {
    const rejected = await app.request("/admin/compatibility/recompute", { method: "POST" });
    expect(rejected.status).toBe(401);

    const accepted = await app.request(
      "/admin/compatibility/recompute",
      { method: "POST", headers: { "X-Admin-API-Key": "secret" } },
      { ADMIN_API_KEY: "secret" },
    );
    expect(accepted.status).toBe(202);
  });

  it("rate limits generation endpoints", async () => {
    let lastStatus = 0;
    for (let index = 0; index < 31; index += 1) {
      const response = await app.request("/api/v1/blueprints", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-forwarded-for": "rate-limit-test" },
        body: JSON.stringify({ idea: `Test idea ${index}` }),
      });
      lastStatus = response.status;
    }

    expect(lastStatus).toBe(429);
  });

  // ─── Fix 6: Expanded test coverage ─────────────────────────────

  // Invalid payload tests
  it("rejects blueprints with empty body", async () => {
    const response = await app.request("/api/v1/blueprints", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-forwarded-for": "empty-body-test" },
      body: "{}",
    });
    expect(response.status).toBe(400);
  });

  it("rejects blueprints with missing idea field", async () => {
    const response = await app.request("/api/v1/blueprints", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-forwarded-for": "missing-idea-test" },
      body: JSON.stringify({ constraints: ["fast"] }),
    });
    expect(response.status).toBe(400);
  });

  it("rejects stack analysis with empty toolIds", async () => {
    const response = await app.request("/api/v1/stacks/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ toolIds: [] }),
    });
    expect(response.status).toBe(400);
  });

  it("rejects scaffolds with missing projectName", async () => {
    const response = await app.request("/api/v1/scaffolds", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-forwarded-for": "missing-project-test" },
      body: JSON.stringify({ toolIds: ["nextjs"] }),
    });
    expect(response.status).toBe(400);
  });

  it("rejects malformed JSON body", async () => {
    const response = await app.request("/api/v1/stacks/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not-json",
    });
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toContain("Invalid JSON");
  });

  // Unknown tool 404s
  it("returns 404 for nonexistent tool detail", async () => {
    const response = await app.request("/api/v1/tools/does-not-exist");
    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body.error).toContain("not found");
  });

  it("returns 400 for unknown tool in stack analysis", async () => {
    const response = await app.request("/api/v1/stacks/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ toolIds: ["nextjs", "does-not-exist"] }),
    });
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toContain("does-not-exist");
  });

  it("returns 404 for unknown tool in compatibility", async () => {
    const response = await app.request("/api/v1/compatibility/nextjs/does-not-exist");
    expect(response.status).toBe(404);
  });

  it("returns 404 for unknown tool in migration path", async () => {
    const response = await app.request("/api/v1/migrations/does-not-exist/nextjs");
    expect(response.status).toBe(404);
  });

  // Internal/admin route auth tests
  it("protects /internal/enrich-tool without API key", async () => {
    const response = await app.request("/internal/enrich-tool", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ toolId: "nextjs" }),
    });
    expect(response.status).toBe(401);
  });

  it("protects /admin/tools/import without API key", async () => {
    const response = await app.request("/admin/tools/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tools: [{}] }),
    });
    expect(response.status).toBe(401);
  });

  it("accepts /internal/enrich-tool with valid API key", async () => {
    const response = await app.request(
      "/internal/enrich-tool",
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Admin-API-Key": "test-key" },
        body: JSON.stringify({ toolId: "nextjs" }),
      },
      { ADMIN_API_KEY: "test-key" },
    );
    expect(response.status).toBe(202);
    const body = await response.json();
    expect(body.toolId).toBe("nextjs");
  });

  it("returns 404 for enrich of nonexistent tool", async () => {
    const response = await app.request(
      "/internal/enrich-tool",
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Admin-API-Key": "test-key" },
        body: JSON.stringify({ toolId: "nonexistent" }),
      },
      { ADMIN_API_KEY: "test-key" },
    );
    expect(response.status).toBe(404);
  });

  // OpenAPI schema fidelity
  it("openapi.json contains all required endpoint paths", async () => {
    const response = await app.request("/openapi.json");
    const body = await response.json();

    const requiredPaths = [
      "/health",
      "/api/v1/blueprints",
      "/api/v1/stacks/analyze",
      "/api/v1/tools/search",
      "/api/v1/tools/{id}",
      "/api/v1/catalog",
      "/api/v1/categories",
      "/api/v1/compatibility/{a}/{b}",
      "/api/v1/scaffolds",
      "/api/v1/migrations/{from}/{to}",
      "/admin/tools/import",
      "/admin/compatibility/recompute",
      "/internal/enrich-tool",
    ];

    for (const path of requiredPaths) {
      expect(body.paths[path]).toBeDefined();
    }
  });

  it("openapi.json includes component schemas", async () => {
    const response = await app.request("/openapi.json");
    const body = await response.json();

    expect(body.components.schemas.ErrorResponse).toBeDefined();
    expect(body.components.schemas.BlueprintRequest).toBeDefined();
    expect(body.components.schemas.BlueprintResponse).toBeDefined();
    expect(body.components.schemas.ToolDetail).toBeDefined();
    expect(body.components.schemas.StackAnalyzeRequest).toBeDefined();
    expect(body.components.schemas.StackAnalyzeResponse).toBeDefined();
    expect(body.components.schemas.ScaffoldRequest).toBeDefined();
    expect(body.components.schemas.ScaffoldResponse).toBeDefined();
  });

  it("openapi.json declares security schemes", async () => {
    const response = await app.request("/openapi.json");
    const body = await response.json();

    expect(body.components.securitySchemes.adminApiKey).toBeDefined();
    expect(body.components.securitySchemes.bearerAuth).toBeDefined();
    expect(body.components.securitySchemes.adminApiKey.type).toBe("apiKey");
    expect(body.components.securitySchemes.bearerAuth.type).toBe("http");
  });

  // Edge case tests
  it("returns empty results for search with no matches", async () => {
    const response = await app.request("/api/v1/tools/search?q=xyznonexistenttool99999");
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.items).toEqual([]);
    expect(body.total).toBe(0);
  });

  it("handles cross-category migration", async () => {
    const response = await app.request("/api/v1/migrations/nextjs/postgres");
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.complexity).toBe("high");
    expect(body.estimatedTime).toBe("1-2 weeks");
    expect(body.steps).toContain("Schedule a manual architecture review for this cross-category migration");
  });

  it("handles same-category migration", async () => {
    const response = await app.request("/api/v1/migrations/prisma/drizzle");
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.complexity).toBe("medium");
    expect(body.estimatedTime).toBe("1-3 days");
    expect(body.steps).not.toContain("Review cross-category architecture impact before replacing database with database.");
  });

  // Blueprint response shape validation
  it("blueprint response includes explanation source", async () => {
    const response = await app.request("/api/v1/blueprints", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-forwarded-for": "shape-test" },
      body: JSON.stringify({ idea: "a simple blog" }),
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.recommendedStack.explanationSource).toBe("heuristic");
    expect(typeof body.recommendedStack.rationale).toBe("string");
    expect(body.recommendedStack.rationale.length).toBeGreaterThan(0);
  });

  it("blueprint response includes a populated roadmap", async () => {
    const response = await app.request("/api/v1/blueprints", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-forwarded-for": "roadmap-test" },
      body: JSON.stringify({ idea: "a subscription dashboard with auth and email" }),
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.roadmap).toBeDefined();
    expect(Array.isArray(body.roadmap.phases)).toBe(true);
    expect(body.roadmap.phases.length).toBeGreaterThanOrEqual(2);
    expect(body.roadmap.phases.length).toBeLessThanOrEqual(5);
    expect(typeof body.roadmap.totalEstimate).toBe("string");
    for (const phase of body.roadmap.phases) {
      expect(typeof phase.name).toBe("string");
      expect(typeof phase.duration).toBe("string");
      expect(Array.isArray(phase.tasks)).toBe(true);
      expect(phase.tasks.length).toBeGreaterThan(0);
    }
  });

  it("blueprint alternatives include tradeoff source", async () => {
    const response = await app.request("/api/v1/blueprints", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-forwarded-for": "alt-test" },
      body: JSON.stringify({ idea: "an e-commerce site with payments" }),
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    for (const alt of body.alternatives) {
      expect(alt.tradeoffSource).toBe("heuristic");
      expect(Array.isArray(alt.tradeoffs)).toBe(true);
    }
  });

  it("blueprint alternatives include whyNot explanations", async () => {
    const response = await app.request("/api/v1/blueprints", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-forwarded-for": "whynot-test" },
      body: JSON.stringify({ idea: "a blog with user accounts" }),
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.alternatives.length).toBeGreaterThan(0);
    for (const alt of body.alternatives) {
      expect(alt.whyNot).toBeDefined();
      expect(typeof alt.whyNot.reason).toBe("string");
      expect(alt.whyNot.reason.length).toBeGreaterThan(0);
      // betterFor is optional but should be a string when present
      if (alt.whyNot.betterFor !== undefined) {
        expect(typeof alt.whyNot.betterFor).toBe("string");
      }
    }
  });

  // Request ID header
  it("returns X-Request-ID header on all responses", async () => {
    const response = await app.request("/health");
    expect(response.headers.get("X-Request-ID")).toBeTruthy();
  });

  it("echoes client-provided X-Request-ID", async () => {
    const customId = "test-req-12345";
    const response = await app.request("/health", {
      headers: { "X-Request-ID": customId },
    });
    expect(response.headers.get("X-Request-ID")).toBe(customId);
  });

  // ─── A6 rate-limit contract tests ──────────────────────────────
  //
  // These four cases are named verbatim in design.md § 8 "Testing strategy"
  // and pin down the behavior the factory rewrite in
  // `apps/api/src/rate-limit/index.ts` has to preserve. Every case is
  // self-isolating: each one installs its own backend via
  // `__resetBackendForTests` and restores the default in `afterEach` so a
  // failing case cannot bleed counters into the next.

  describe("rate-limit contract", () => {
    afterEach(() => {
      __resetBackendForTests(null);
    });

    /**
     * Build a `RateLimitBackend` that records every `check()` call it
     * receives into the returned `calls` array. Always returns an allow
     * decision with full remaining quota so the admin/exempt-route checks
     * can focus on "was this called at all?".
     */
    function createSpyBackend(): {
      backend: RateLimitBackend;
      calls: RateLimitCheckArgs[];
    } {
      const calls: RateLimitCheckArgs[] = [];
      const backend: RateLimitBackend = {
        name: "memory",
        async check(args: RateLimitCheckArgs): Promise<RateLimitDecision> {
          calls.push(args);
          return {
            allowed: true,
            remaining: BUCKETS[args.bucket].limit,
            limit: BUCKETS[args.bucket].limit,
            resetAtEpochMs: Date.now() + BUCKETS[args.bucket].windowMs,
          };
        },
      };
      return { backend, calls };
    }

    /**
     * Build a `RateLimitBackend` that delegates to a shared Map. Used by
     * the "bucket count survives backend swap" case to prove that two
     * wrapper instances sharing the same underlying state keep accounting
     * consistent across a simulated restart. Semantics mirror the real
     * memory backend: count is incremented on every call, `allowed` is
     * `count <= limit`, and the window resets lazily at `resetAtEpochMs`.
     */
    function createSharedStateBackend(
      store: Map<string, { count: number; resetAtEpochMs: number }>,
    ): RateLimitBackend {
      return {
        name: "upstash",
        async check({ bucket, clientId }): Promise<RateLimitDecision> {
          const key = `${bucket}:${clientId}`;
          const config = BUCKETS[bucket];
          const now = Date.now();
          let entry = store.get(key);
          if (!entry || now >= entry.resetAtEpochMs) {
            entry = { count: 1, resetAtEpochMs: now + config.windowMs };
            store.set(key, entry);
          } else {
            entry.count += 1;
          }
          return {
            allowed: entry.count <= config.limit,
            remaining: Math.max(0, config.limit - entry.count),
            limit: config.limit,
            resetAtEpochMs: entry.resetAtEpochMs,
          };
        },
      };
    }

    it("admin 401 before rate-limit counter increments (R8.1)", async () => {
      const { backend, calls } = createSpyBackend();
      __resetBackendForTests(backend);

      const response = await app.request("/admin/tools/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tools: [{ id: "whatever" }] }),
      });

      expect(response.status).toBe(401);
      // The admin middleware rejects before any downstream middleware runs.
      // `/admin/*` also isn't under `/api/v1/*`, so the rate-limit
      // middleware cannot match it — the backend is never consulted.
      expect(calls).toHaveLength(0);
    });

    it("Retry-After only on 429 (R4.7, R4.8)", async () => {
      const store = new Map<string, { count: number; resetAtEpochMs: number }>();
      __resetBackendForTests(createSharedStateBackend(store));

      const clientId = "retry-after-test";
      const readLimit = BUCKETS.read.limit;

      // Requests 1..limit should all be 200 and MUST NOT include a
      // Retry-After header. We collect the Retry-After values to assert
      // they are all null in one shot.
      const retryAfterDuringAllowed: (string | null)[] = [];
      for (let i = 0; i < readLimit; i += 1) {
        const ok = await app.request("/api/v1/tools/search", {
          headers: { "x-forwarded-for": clientId },
        });
        expect(ok.status).toBe(200);
        retryAfterDuringAllowed.push(ok.headers.get("Retry-After"));
      }
      expect(retryAfterDuringAllowed.every((v) => v === null)).toBe(true);

      // Request limit+1 trips the rate limit: must return 429 and a
      // positive-integer Retry-After header.
      const blocked = await app.request("/api/v1/tools/search", {
        headers: { "x-forwarded-for": clientId },
      });
      expect(blocked.status).toBe(429);
      const retryAfter = blocked.headers.get("Retry-After");
      expect(retryAfter).not.toBeNull();
      const seconds = Number(retryAfter);
      expect(Number.isInteger(seconds)).toBe(true);
      expect(seconds).toBeGreaterThan(0);
    });

    it("exempt routes never counted (R4.9)", async () => {
      const { backend, calls } = createSpyBackend();
      __resetBackendForTests(backend);

      for (let i = 0; i < 5; i += 1) {
        const health = await app.request("/health");
        expect(health.status).toBe(200);
      }
      for (let i = 0; i < 5; i += 1) {
        const openapi = await app.request("/openapi.json");
        expect(openapi.status).toBe(200);
      }

      expect(calls).toHaveLength(0);
    });

    it("bucket count survives backend swap (R6.4)", async () => {
      const store = new Map<string, { count: number; resetAtEpochMs: number }>();
      __resetBackendForTests(createSharedStateBackend(store));

      const clientId = "backend-swap-test";
      const generationLimit = BUCKETS.generation.limit;
      const preSwap = generationLimit - 10; // 20 of the 30-quota window

      // Fire `preSwap` generation-bucket requests. These exercise both
      // rate-limit middlewares (generation + /api/v1/*), so we just look
      // at the generation counter in the shared store.
      for (let i = 0; i < preSwap; i += 1) {
        const response = await app.request("/api/v1/blueprints", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-forwarded-for": clientId,
          },
          // Empty body intentionally: we want the rate-limit middleware
          // to count every request, but the blueprint handler to short-
          // circuit quickly with a 400 so the test stays fast.
          body: "{}",
        });
        expect(response.status).not.toBe(429);
      }
      expect(
        store.get(`generation:${clientId}`)?.count,
      ).toBe(preSwap);

      // Swap the backend wrapper but keep the SAME shared store — this
      // simulates an API service restart where the underlying Redis
      // keyspace survives. If accounting resets, the next 11 requests
      // would all be 200 and the invariant breaks.
      __resetBackendForTests(createSharedStateBackend(store));

      const postSwapStatuses: number[] = [];
      for (let i = 0; i < 11; i += 1) {
        const response = await app.request("/api/v1/blueprints", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-forwarded-for": clientId,
          },
          body: "{}",
        });
        postSwapStatuses.push(response.status);
      }

      // 20 pre-swap + first 10 post-swap = 30 (still allowed). Request 31
      // (the 11th post-swap) must be 429 because the shared store tracks
      // the cumulative count across the restart.
      expect(postSwapStatuses.slice(0, 10).every((s) => s !== 429)).toBe(true);
      expect(postSwapStatuses[10]).toBe(429);
      expect(
        store.get(`generation:${clientId}`)?.count,
      ).toBe(generationLimit + 1);
    });
  });

  // ─── C2 fail-closed contract tests ─────────────────────────────
  //
  // These four cases are named verbatim in design.md § "Testing strategy"
  // (Contract tests). They pin the security envelope the deploy depends on:
  // admin gating runs before anything else, production CORS never wildcards,
  // the allow-headers list carries every header the SPA sends, and a broken
  // Better Auth init fails closed with 503 in production. The matching
  // app-level property suites live in `app.pbt.test.ts`.

  describe("C2 fail-closed contract", () => {
    const ADMIN_PATHS = [
      "/admin/tools/import",
      "/admin/compatibility/recompute",
      "/internal/enrich-tool",
    ];

    afterEach(() => {
      __resetBackendForTests(null);
      delete process.env.DATABASE_URL;
      delete process.env.CORS_ORIGIN;
    });

    it("admin 401 before any middleware (R8.1)", async () => {
      // A spy backend proves the rate-limit middleware never ran: admin and
      // internal routes are not under /api/v1/*, so the gate rejects before
      // any downstream middleware or handler can execute.
      const calls: RateLimitCheckArgs[] = [];
      const spy: RateLimitBackend = {
        name: "memory",
        async check(args: RateLimitCheckArgs): Promise<RateLimitDecision> {
          calls.push(args);
          return {
            allowed: true,
            remaining: BUCKETS[args.bucket].limit,
            limit: BUCKETS[args.bucket].limit,
            resetAtEpochMs: Date.now() + BUCKETS[args.bucket].windowMs,
          };
        },
      };
      __resetBackendForTests(spy);

      for (const path of ADMIN_PATHS) {
        const response = await app.request(path, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: "{}",
        });
        expect(response.status).toBe(401);
        const body = await response.json();
        expect(body.error).toBe("Unauthorized");
      }

      expect(calls).toHaveLength(0);
    });

    it("CORS never wildcard in prod (R10.3, R10.4)", async () => {
      // CORS_ORIGIN is captured once at module import, so build a fresh app
      // pinned to the production origin.
      process.env.CORS_ORIGIN = "https://stackfast.app";
      delete process.env.DATABASE_URL;
      vi.resetModules();
      const prodApp = (await import("./app.js")).default;

      // Matching origin → exact-match ACAO + credentials, never a wildcard.
      const matching = await prodApp.request(
        "/api/v1/tools/search",
        { headers: { Origin: "https://stackfast.app" } },
        { NODE_ENV: "production" },
      );
      expect(matching.headers.get("access-control-allow-origin")).toBe(
        "https://stackfast.app",
      );
      expect(matching.headers.get("access-control-allow-origin")).not.toBe("*");
      expect(matching.headers.get("access-control-allow-credentials")).toBe(
        "true",
      );

      // Non-matching origin (R10.4) → ACAO must not name the foreign origin
      // and must never be the wildcard.
      const mismatching = await prodApp.request(
        "/api/v1/tools/search",
        { headers: { Origin: "https://evil.example" } },
        { NODE_ENV: "production" },
      );
      const acao = mismatching.headers.get("access-control-allow-origin");
      expect(acao).not.toBe("*");
      expect(acao).not.toBe("https://evil.example");
      expect(acao === null || acao === "https://stackfast.app").toBe(true);
    });

    it("CORS allowed-headers list (R10.5)", async () => {
      // Preflight surfaces Access-Control-Allow-Headers from the configured
      // allowHeaders list. Origin matches the default dev origin so the
      // preflight is fully formed.
      const response = await app.request("/api/v1/tools/search", {
        method: "OPTIONS",
        headers: {
          Origin: "http://localhost:5173",
          "Access-Control-Request-Method": "GET",
          "Access-Control-Request-Headers": "x-admin-api-key",
        },
      });

      const allowHeaders = (
        response.headers.get("access-control-allow-headers") ?? ""
      )
        .split(",")
        .map((header) => header.trim().toLowerCase());

      for (const required of [
        "x-admin-api-key",
        "x-request-id",
        "x-ai-provider",
        "content-type",
        "authorization",
      ]) {
        expect(allowHeaders).toContain(required);
      }
    });

    it("prod auth 503 when Better Auth init throws (R11.4)", async () => {
      // An invalid DATABASE_URL makes neon() throw inside createAuth(), so
      // getAuth() throws. In production requireSession() must fail closed
      // with 503 rather than fall through to the handler.
      process.env.DATABASE_URL = "not-a-valid-connection-string";

      const response = await app.request(
        "/api/v1/blueprints",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-forwarded-for": "init-throws-test",
          },
          body: JSON.stringify({ idea: "better auth init throws" }),
        },
        { NODE_ENV: "production" },
      );

      expect(response.status).toBe(503);
      const body = await response.json();
      expect(body.error).toContain("Authentication is not configured");
    });
  });
});