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

  it("provides typed lookup helpers", () => {
    const loader = new CatalogLoader(defaultCatalog);

    expect(loader.requireTool("nextjs").name).toBe("Next.js");
    expect(loader.getToolsByCategory("frontend").map((tool) => tool.id)).toContain("nextjs");
    expect(loader.searchTools("postgres").map((tool) => tool.id)).toContain("postgres");
  });
});
