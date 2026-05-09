import { describe, expect, it } from "vitest";
import { CatalogLoader, defaultCatalog, validateDefaultCatalog } from "./index";

describe("registry", () => {
  it("validates the bundled catalog", () => {
    expect(validateDefaultCatalog().ok).toBe(true);
  });

  it("loads expected catalog counts", () => {
    expect(defaultCatalog.tools).toHaveLength(33);
    expect(defaultCatalog.categories).toHaveLength(10);
    expect(defaultCatalog.rules).toHaveLength(53);
  });

  it("enriches every tool with Phase 2 metadata", () => {
    for (const tool of defaultCatalog.tools) {
      expect(tool.lastVerified).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(tool.sourceUrls.length).toBeGreaterThan(0);
      expect(tool.confidence).toBeGreaterThanOrEqual(0);
      expect(tool.confidence).toBeLessThanOrEqual(1);
      expect(tool.capabilities.length).toBeGreaterThan(0);
      expect(tool.deprecated).toBe(false);
    }
  });

  it("provides typed lookup helpers", () => {
    const loader = new CatalogLoader(defaultCatalog);

    expect(loader.requireTool("nextjs").name).toBe("Next.js");
    expect(loader.getToolsByCategory("frontend").map((tool) => tool.id)).toContain("nextjs");
    expect(loader.searchTools("postgres").map((tool) => tool.id)).toContain("postgres");
  });
});
