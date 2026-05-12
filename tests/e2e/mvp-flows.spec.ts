import { expect, test } from "@playwright/test";

test.describe("Stackfast MVP flows", () => {
  test("searches the tool catalog", async ({ page }) => {
    await page.goto("/catalog");

    await expect(page.getByRole("heading", { name: "Tool Catalog" })).toBeVisible();
    await page.getByPlaceholder("Search tools...").last().fill("next.js");

    await expect(page.getByRole("heading", { name: "Next.js" })).toBeVisible();
  });

  test("generates an idea-to-stack blueprint", async ({ page }) => {
    await page.goto("/blueprint");

    await page.getByLabel(/What are you building/i).fill(
      "A subscription dashboard with login, billing, and email notifications",
    );
    await page.getByRole("button", { name: /Generate Blueprint/i }).click();

    await expect(page.getByRole("heading", { name: "Recommended Architecture" })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText("Primary Stack")).toBeVisible();
    await expect(page.getByText("Harmony Score")).toBeVisible();
  });

  test("analyzes pairwise compatibility", async ({ page }) => {
    await page.goto("/compatibility");

    const toolSelectors = page.getByRole("combobox");
    await toolSelectors.first().selectOption("nextjs");
    await toolSelectors.nth(1).selectOption("vercel");

    await expect(page.getByText("Harmony Score")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole("heading", { name: "Integration Analysis" })).toBeVisible();
  });

  test("shows a basic migration path", async ({ page }) => {
    await page.goto("/migration");

    const migrationSelectors = page.getByRole("combobox");
    await migrationSelectors.first().selectOption("prisma");
    await migrationSelectors.nth(1).selectOption("drizzle");

    await expect(page.getByRole("heading", { name: "Migration Strategy" })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText("Inventory current Prisma usage and configuration")).toBeVisible();
  });
});
