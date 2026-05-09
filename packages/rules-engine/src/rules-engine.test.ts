import { CatalogLoader } from "@stackfast/registry";
import { describe, expect, it } from "vitest";
import { evaluateRulesSync } from "./rules-engine";
import { calculateScore, validateScoreBreakdown } from "./score-calculator";

const loader = new CatalogLoader();
const rules = loader.getRules();

describe("rules engine", () => {
  it("returns the baseline score for an empty selection", () => {
    const result = evaluateRulesSync([], rules);

    expect(result.score).toBe(50);
    expect(result.breakdown.base).toBe(50);
    expect(result.diagnostics).toEqual([]);
  });

  it("is deterministic for the same tools and rules", () => {
    const selections = [loader.requireTool("nextjs"), loader.requireTool("vercel"), loader.requireTool("tailwind")];
    const first = evaluateRulesSync(selections, rules);
    const second = evaluateRulesSync(selections, rules);

    expect(first.score).toBe(second.score);
    expect(first.breakdown).toEqual(second.breakdown);
    expect(first.diagnostics).toEqual(second.diagnostics);
  });

  it("emits a known hard conflict diagnostic", () => {
    const selections = [loader.requireTool("mongodb"), loader.requireTool("postgres")];
    const result = evaluateRulesSync(selections, rules);

    expect(result.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          ruleId: "hard-conflict-mongodb-postgres",
          level: "error",
          category: "conflict",
          weight: -40,
        }),
      ]),
    );
  });

  it("emits a known synergy diagnostic", () => {
    const selections = [loader.requireTool("nextjs"), loader.requireTool("vercel")];
    const result = evaluateRulesSync(selections, rules);

    expect(result.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          ruleId: "synergy-nextjs-vercel",
          level: "success",
          category: "synergy",
          weight: 12,
        }),
      ]),
    );
  });

  it("validates score breakdowns", () => {
    const breakdown = calculateScore([
      { id: "bonus", level: "success", category: "synergy", message: "bonus", weight: 10 },
      { id: "penalty", level: "error", category: "conflict", message: "penalty", weight: -20 },
    ]);

    expect(breakdown.total).toBe(40);
    expect(validateScoreBreakdown(breakdown)).toBe(true);
  });
});
