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

  it("searches tools with pagination", async () => {
    const response = await app.request("/api/v1/tools/search?q=next&limit=5");
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
});