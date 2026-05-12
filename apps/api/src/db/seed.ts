/**
 * Seed script — populates Neon Postgres with catalog data from @stackfast/registry.
 *
 * Usage:
 *   pnpm --filter @stackfast/api seed
 *
 * Requires DATABASE_URL to be set.
 * Idempotent: uses ON CONFLICT DO UPDATE so it's safe to re-run.
 *
 * Uses raw SQL via @neondatabase/serverless to avoid drizzle ORM
 * resolution-mode type issues in the monorepo build.
 */

import { neon } from "@neondatabase/serverless";
import { CatalogLoader } from "@stackfast/registry";

async function seed() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL is not set. Cannot seed without a database connection.");
    process.exit(1);
  }

  const sql = neon(url);
  const catalog = new CatalogLoader();

  console.log("🌱 Seeding database from registry catalog...\n");

  // --- Seed categories ---
  const categories = catalog.getCategories();
  console.log(`  Categories: ${categories.length}`);

  for (const cat of categories) {
    await sql`
      INSERT INTO tool_categories (id, name, description, color)
      VALUES (${cat.id}, ${cat.name}, ${cat.description}, ${"#FF4500"})
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        description = EXCLUDED.description
    `;
  }

  // --- Seed tools ---
  const tools = catalog.getTools();
  console.log(`  Tools: ${tools.length}`);

  for (const tool of tools) {
    const url = tool.homepageUrl ?? tool.docsUrl ?? null;
    const pricing = tool.pricing?.model ?? "free";
    const notes = tool.deprecated ? "DEPRECATED" : null;
    // jsonb columns require serialized JSON — @neondatabase/serverless otherwise
    // sends JS arrays as postgres array literals (e.g. {"nextjs"}).
    const frameworks = JSON.stringify(tool.supports.frameworks ?? []);
    const languages = JSON.stringify(tool.languages ?? []);
    const capabilities = JSON.stringify(tool.capabilities ?? []);
    const integrations = JSON.stringify(tool.integrations ?? []);

    await sql`
      INSERT INTO tools (
        id, name, description, category_id, url,
        frameworks, languages, features, integrations,
        maturity_score, popularity_score, pricing, notes,
        setup_complexity, cost_tier
      ) VALUES (
        ${tool.id}, ${tool.name}, ${tool.description}, ${tool.categoryId}, ${url},
        ${frameworks}::jsonb, ${languages}::jsonb, ${capabilities}::jsonb, ${integrations}::jsonb,
        ${tool.confidence}, ${tool.confidence}, ${pricing}, ${notes},
        ${"medium"}, ${pricing === "paid" ? "paid" : "free"}
      )
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        description = EXCLUDED.description,
        category_id = EXCLUDED.category_id,
        url = EXCLUDED.url,
        frameworks = EXCLUDED.frameworks,
        languages = EXCLUDED.languages,
        features = EXCLUDED.features,
        integrations = EXCLUDED.integrations,
        maturity_score = EXCLUDED.maturity_score,
        pricing = EXCLUDED.pricing
    `;
  }

  // --- Seed compatibility rules ---
  const rules = catalog.getRules();
  let ruleCount = 0;

  for (const rule of rules) {
    if (rule.kind === "hardConflict" || rule.kind === "synergy" || rule.kind === "capabilityCompat") {
      const toolA = catalog.getTool(rule.toolA);
      const toolB = catalog.getTool(rule.toolB);
      if (!toolA || !toolB) continue;

      const score =
        rule.kind === "hardConflict"
          ? Math.max(0, 1 - Math.abs(rule.weight))
          : Math.min(1, 0.7 + rule.weight * 0.3);

      const id = `${rule.toolA}-${rule.toolB}`;
      const difficulty = rule.kind === "hardConflict" ? "hard" : "easy";

      await sql`
        INSERT INTO compatibilities (
          id, tool_one_id, tool_two_id, compatibility_score,
          notes, verified_integration, integration_difficulty
        ) VALUES (
          ${id}, ${rule.toolA}, ${rule.toolB}, ${score},
          ${rule.reason}, ${1}, ${difficulty}
        )
        ON CONFLICT (id) DO UPDATE SET
          compatibility_score = EXCLUDED.compatibility_score,
          notes = EXCLUDED.notes
      `;
      ruleCount++;
    }
  }

  console.log(`  Compatibility rules: ${ruleCount}`);
  console.log("\n✅ Seed complete.");
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
