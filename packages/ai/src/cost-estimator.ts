import type { Tool } from "@stackfast/schemas";
import type { BlueprintCostEstimate, ToolCostEstimate } from "./types.js";

// ---------------------------------------------------------------------------
// Static cost estimates — derived from tool registry pricing data
// ---------------------------------------------------------------------------

/**
 * Static monthly cost lookup table for common developer tools.
 * These are rough estimates for a small-to-medium project (MVP/startup tier).
 * The user confirmed static estimates are fine for MVP.
 */
const STATIC_COST_MAP: Record<string, { cost: number; note: string }> = {
  // Free
  nextjs: { cost: 0, note: "Open-source framework" },
  remix: { cost: 0, note: "Open-source framework" },
  astro: { cost: 0, note: "Open-source framework" },
  sveltekit: { cost: 0, note: "Open-source framework" },
  node: { cost: 0, note: "Open-source runtime" },
  bun: { cost: 0, note: "Open-source runtime" },
  tailwind: { cost: 0, note: "Open-source CSS framework" },
  prisma: { cost: 0, note: "Open-source ORM (Accelerate is paid)" },
  drizzle: { cost: 0, note: "Open-source ORM" },

  // Free tier
  vercel: { cost: 0, note: "Free tier: 100GB bandwidth, serverless" },
  railway: { cost: 5, note: "Hobby plan: $5/mo + usage" },
  netlify: { cost: 0, note: "Free tier: 100GB bandwidth" },
  postgres: { cost: 0, note: "Neon free tier: 0.5GB, auto-suspend" },
  supabase: { cost: 0, note: "Free tier: 500MB, 2 projects" },
  clerk: { cost: 0, note: "Free tier: 10,000 MAU" },
  resend: { cost: 0, note: "Free tier: 3,000 emails/mo" },

  // Paid
  stripe: { cost: 0, note: "No monthly fee, 2.9% + 30¢ per transaction" },
  s3: { cost: 3, note: "~$3/mo for 50GB standard storage" },
  planetscale: { cost: 29, note: "Scaler plan: $29/mo" },
  mongodb: { cost: 0, note: "Free tier: 512MB Atlas" },
};

/**
 * Generate a static cost estimate for a set of tools.
 */
export function estimateCosts(tools: Tool[]): BlueprintCostEstimate {
  const items: ToolCostEstimate[] = tools.map((tool) => {
    const lookup = STATIC_COST_MAP[tool.id];
    const pricingModel = tool.pricing?.model ?? "free";

    if (lookup) {
      return {
        toolId: tool.id,
        toolName: tool.name,
        pricingModel,
        estimatedMonthlyCost: lookup.cost > 0 ? lookup.cost : null,
        note: lookup.note,
      };
    }

    // Fallback: derive from registry pricing field
    return {
      toolId: tool.id,
      toolName: tool.name,
      pricingModel,
      estimatedMonthlyCost: pricingModel === "paid" ? null : null,
      note: tool.pricing?.note ?? `${pricingModel} pricing`,
    };
  });

  const totalMonthly = items.reduce(
    (sum, item) => sum + (item.estimatedMonthlyCost ?? 0),
    0,
  );

  return {
    items,
    totalMonthlyEstimate: totalMonthly,
    totalAnnualEstimate: totalMonthly * 12,
    currency: "USD",
  };
}
