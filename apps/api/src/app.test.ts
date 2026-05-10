import { describe, expect, it } from "vitest";
import app from "./app.js";

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
    expect(body.difficulty).toBe("high");
    expect(body.caveats.length).toBeGreaterThan(0);
  });

  it("handles same-category migration", async () => {
    const response = await app.request("/api/v1/migrations/prisma/drizzle");
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.difficulty).toBe("moderate");
    expect(body.caveats).toEqual([]);
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
});