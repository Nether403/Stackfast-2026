import { CatalogLoader } from "@stackfast/registry";
import { ExportRecipeMetadataSchema } from "@stackfast/schemas";
import { describe, expect, it } from "vitest";
import { generateExport, generateExportAsText } from "./export-generator";
import { recipes } from "./recipes";

const loader = new CatalogLoader();

describe("exporter", () => {
  it("validates all recipe metadata against the shared schema", () => {
    for (const recipe of recipes) {
      expect(() => ExportRecipeMetadataSchema.parse(recipe)).not.toThrow();
    }
  });

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

  it("generates Drizzle, Tailwind, hosting, email, and storage scaffolds", async () => {
    const tools = [
      loader.requireTool("nextjs"),
      loader.requireTool("postgres"),
      loader.requireTool("drizzle"),
      loader.requireTool("tailwind"),
      loader.requireTool("vercel"),
      loader.requireTool("resend"),
      loader.requireTool("s3"),
    ];

    const exportData = await generateExport(tools, [], "zip", "1.0.0", "phase-two-app");
    const paths = exportData.files.map((file) => file.path);

    expect(exportData.meta.recipeOrder).toEqual(expect.arrayContaining([
      "nextjs-base",
      "nextjs-drizzle-postgres",
      "tailwind-nextjs",
      "vercel-deployment",
      "resend-email",
      "s3-storage",
    ]));
    expect(paths).toEqual(expect.arrayContaining([
      "drizzle.config.ts",
      "src/db/schema.ts",
      "tailwind.config.ts",
      "vercel.json",
      "src/email/resend.ts",
      "src/storage/s3.ts",
      ".env.example",
    ]));
  });
});
