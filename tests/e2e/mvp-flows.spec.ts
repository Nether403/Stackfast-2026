import { expect, test } from "@playwright/test";

test.describe("Stackfast MVP flows", () => {
  test("searches the tool catalog", async ({ page }) => {
    await page.goto("/catalog");

    await expect(page.getByRole("heading", { name: "Tool Catalog" })).toBeVisible();
    await page.getByPlaceholder("Search tools...").last().fill("next.js");

    await expect(page.getByRole("heading", { name: "Next.js" })).toBeVisible();
  });

  test("loads the Stack Builder catalog via TanStack Query", async ({ page }) => {
    await page.goto("/stack-builder");

    // The loading spinner shows "Loading StackFast"; we wait for it to clear
    // and the StackBuilder component to render category sections from the
    // catalog. Next.js lives under the "Frontend" category and is always
    // present in the registry, so its name is a stable signal that data
    // flowed through useStackBuilderCatalog.
    await expect(page.getByText("Next.js", { exact: true }).first()).toBeVisible({ timeout: 30_000 });
  });

  test("generates an idea-to-stack blueprint", async ({ page }) => {
    test.setTimeout(180_000);
    await page.goto("/blueprint");

    // Step 1 — idea
    await expect(page.getByRole("heading", { name: "Idea to Stack" })).toBeVisible();
    await expect(page.getByTestId("wizard-progress")).toBeVisible();
    await page.getByLabel(/What are you building/i).fill(
      "A subscription dashboard with login, billing, and email notifications",
    );
    await page.screenshot({ path: "test-results/wizard-step-1-idea.png", fullPage: true });
    await page.getByRole("button", { name: /Next: Constraints/i }).click();

    // Step 2 — constraints (optional)
    await expect(page.getByLabel(/Technical constraints/i)).toBeVisible();
    await page.getByLabel(/Technical constraints/i).fill("Must use TypeScript");
    await page.getByLabel(/Budget/i).selectOption("medium");
    await page.getByLabel(/Timeline/i).selectOption("mvp");
    await page.screenshot({ path: "test-results/wizard-step-2-constraints.png", fullPage: true });
    await page.getByRole("button", { name: /Generate blueprint/i }).click();

    // Step 3 — results
    await expect(page.getByRole("heading", { name: "Recommended Architecture" })).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByText("Primary Stack")).toBeVisible();
    await expect(page.getByText("Harmony Score")).toBeVisible();
    await page.screenshot({ path: "test-results/wizard-step-3-results.png", fullPage: true });

    // Step 4 — export
    await page.getByRole("button", { name: /Continue to export/i }).click();
    const exportStep = page.getByTestId("wizard-export-step");
    await expect(exportStep).toBeVisible({ timeout: 30_000 });
    await expect(exportStep.getByRole("button", { name: /Download ZIP/i })).toBeVisible();
    await page.screenshot({ path: "test-results/wizard-step-4-export.png", fullPage: true });
  });

  test("analyzes pairwise compatibility", async ({ page }) => {
    await page.goto("/compatibility");

    const toolSelectors = page.getByRole("combobox");
    await toolSelectors.first().selectOption("nextjs");
    await toolSelectors.nth(1).selectOption("vercel");

    await expect(page.getByText("Harmony Score")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole("heading", { name: "Integration Analysis" })).toBeVisible();
  });

  test("shows a compatibility matrix across two categories", async ({ page }) => {
    await page.goto("/compatibility");

    await page.getByTestId("compat-tab-matrix").click();

    const heatmap = page.getByTestId("compatibility-heatmap");
    await expect(heatmap).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole("heading", { name: "Compatibility Matrix" })).toBeVisible();

    await page.getByTestId("heatmap-row-select").selectOption("frontend");
    await page.getByTestId("heatmap-col-select").selectOption("hosting");

    const table = page.getByTestId("heatmap-table");
    await expect(table).toBeVisible();
    // At least one cell should render a harmony score. The initial load has
    // frontend × hosting so we expect Next.js × Vercel to be excellent.
    await expect(table.locator("td[data-score]").first()).toBeVisible();
    await expect(table).toContainText("Next.js");
    await expect(table).toContainText("Vercel");
    await page.screenshot({ path: "test-results/compat-matrix.png", fullPage: true });
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
