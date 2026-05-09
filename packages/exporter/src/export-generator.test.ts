import { CatalogLoader } from "@stackfast/registry";
import { describe, expect, it } from "vitest";
import { generateExport, generateExportAsText } from "./export-generator";

const loader = new CatalogLoader();

describe("exporter", () => {
  it("generates a valid Next.js scaffold file structure", async () => {
    const tools = [
      loader.requireTool("nextjs"),
      loader.requireTool("postgres"),
      loader.requireTool("prisma"),
      loader.requireTool("clerk"),
      loader.requireTool("stripe"),
    ];

    const exportData = await generateExport(tools, [], "zip", "1.0.0", "demo-app");
    const paths = exportData.files.map((file) => file.path);

    expect(paths).toEqual(expect.arrayContaining([
      "package.json",
      ".env.example",
      "README.md",
      "setup-guide.md",
      "docs/adr/0001-generated-stack.md",
      "next.config.ts",
      "app/page.tsx",
      "prisma/schema.prisma",
      "middleware.ts",
      "lib/stripe.ts",
      "export-log.json",
    ]));
  });

  it("generates deterministic file paths and recipe order", async () => {
    const tools = [loader.requireTool("nextjs"), loader.requireTool("postgres"), loader.requireTool("prisma")];
    const first = await generateExport(tools, [], "zip", "1.0.0", "demo-app");
    const second = await generateExport(tools, [], "zip", "1.0.0", "demo-app");

    expect(first.meta.recipeOrder).toEqual(second.meta.recipeOrder);
    expect(first.files.map((file) => file.path)).toEqual(second.files.map((file) => file.path));
  });

  it("renders export output as copyable text", async () => {
    const exportData = await generateExport([loader.requireTool("nextjs")], [], "zip", "1.0.0", "demo-app");

    expect(generateExportAsText(exportData)).toContain("## File: package.json");
  });
});
