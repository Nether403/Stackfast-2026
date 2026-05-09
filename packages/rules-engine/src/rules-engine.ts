import type {
  CapabilityCompatRule,
  CategoryCoverageRule,
  Diagnostic,
  EvaluationResult,
  HardConflictRule,
  MutualExclusiveCategoryRule,
  RequiresToolRule,
  Rule,
  SynergyRule,
  Tool,
} from "@stackfast/schemas";
import { applyCapabilityCompatCap, calculateScore } from "./score-calculator";

export function evaluateRulesSync(selections: Tool[], rules: Rule[]): EvaluationResult {
  const startTime = now();
  const diagnostics: Diagnostic[] = [];

  for (const rule of rules) {
    switch (rule.kind) {
      case "mutualExclusiveCategory":
        evaluateMutualExclusiveCategory(rule, selections, diagnostics);
        break;
      case "hardConflict":
        evaluateHardConflict(rule, selections, diagnostics);
        break;
      case "requiresTool":
        evaluateRequiresTool(rule, selections, diagnostics);
        break;
      case "synergy":
        evaluateSynergy(rule, selections, diagnostics);
        break;
      case "capabilityCompat":
        evaluateCapabilityCompat(rule, selections, diagnostics);
        break;
      case "categoryCoverage":
        evaluateCategoryCoverage(rule, selections, diagnostics);
        break;
    }
  }

  applyCapabilityCompatCap(diagnostics);
  const breakdown = calculateScore(diagnostics);

  return {
    score: breakdown.total,
    breakdown,
    diagnostics,
    evaluationTimeMs: now() - startTime,
  };
}

function evaluateMutualExclusiveCategory(
  rule: MutualExclusiveCategoryRule,
  selections: Tool[],
  diagnostics: Diagnostic[],
): void {
  const toolsInCategory = selections.filter((tool) => tool.categoryId === rule.categoryId);

  if (toolsInCategory.length > 1) {
    diagnostics.push({
      id: `${rule.id}-violation`,
      ruleId: rule.id,
      ruleVersion: rule.version,
      level: "error",
      category: "conflict",
      message: `Only one tool may be selected from ${rule.categoryId} category`,
      toolIds: toolsInCategory.map((tool) => tool.id),
      weight: -50,
    });
  }
}

function evaluateHardConflict(
  rule: HardConflictRule,
  selections: Tool[],
  diagnostics: Diagnostic[],
): void {
  if (hasTool(selections, rule.toolA) && hasTool(selections, rule.toolB)) {
    diagnostics.push({
      id: `${rule.id}-conflict`,
      ruleId: rule.id,
      ruleVersion: rule.version,
      level: "error",
      category: "conflict",
      message: rule.reason,
      toolIds: [rule.toolA, rule.toolB],
      weight: rule.weight,
    });
  }
}

function evaluateRequiresTool(
  rule: RequiresToolRule,
  selections: Tool[],
  diagnostics: Diagnostic[],
): void {
  if (!hasTool(selections, rule.tool)) {
    return;
  }

  const hasRequiredTool = rule.requiresAnyOf.some((requiredId) => hasTool(selections, requiredId));
  if (!hasRequiredTool) {
    diagnostics.push({
      id: `${rule.id}-missing`,
      ruleId: rule.id,
      ruleVersion: rule.version,
      level: rule.severity === "error" ? "error" : "warning",
      category: "requirement",
      message: rule.reason,
      toolIds: [rule.tool],
      weight: rule.severity === "error" ? -40 : -10,
    });
  }
}

function evaluateSynergy(rule: SynergyRule, selections: Tool[], diagnostics: Diagnostic[]): void {
  if (hasTool(selections, rule.toolA) && hasTool(selections, rule.toolB)) {
    diagnostics.push({
      id: `${rule.id}-synergy`,
      ruleId: rule.id,
      ruleVersion: rule.version,
      level: "success",
      category: "synergy",
      message: rule.reason,
      toolIds: [rule.toolA, rule.toolB],
      weight: rule.weight,
    });
  }
}

function evaluateCapabilityCompat(
  rule: CapabilityCompatRule,
  selections: Tool[],
  diagnostics: Diagnostic[],
): void {
  if (hasTool(selections, rule.toolA) && hasTool(selections, rule.toolB)) {
    diagnostics.push({
      id: `${rule.id}-compat`,
      ruleId: rule.id,
      ruleVersion: rule.version,
      level: "info",
      category: "synergy",
      message: rule.reason,
      toolIds: [rule.toolA, rule.toolB],
      weight: rule.weight,
    });
  }
}

function evaluateCategoryCoverage(
  rule: CategoryCoverageRule,
  selections: Tool[],
  diagnostics: Diagnostic[],
): void {
  const toolsInCategory = selections.filter((tool) => tool.categoryId === rule.categoryId);
  if (toolsInCategory.length > 0) {
    diagnostics.push({
      id: `${rule.id}-coverage`,
      ruleId: rule.id,
      ruleVersion: rule.version,
      level: "info",
      category: "coverage",
      message: `Selected tool from ${rule.categoryId} category`,
      toolIds: toolsInCategory.map((tool) => tool.id),
      weight: rule.weight,
    });
  }
}

function hasTool(selections: Tool[], id: string): boolean {
  return selections.some((tool) => tool.id === id);
}

function now(): number {
  return typeof performance !== "undefined" ? performance.now() : Date.now();
}
