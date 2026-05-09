/**
 * Rules Engine - Synchronous rule evaluation and scoring
 * 
 * This module implements the core rules engine that evaluates compatibility rules
 * and generates diagnostics with weights. It's designed to be used both in the
 * main thread and in a Web Worker.
 */

import type {
  Tool,
  Rule,
  Diagnostic,
  EvaluationResult,
  MutualExclusiveCategoryRule,
  HardConflictRule,
  RequiresToolRule,
  SynergyRule,
  CapabilityCompatRule,
  CategoryCoverageRule,
} from '@/types';
import { calculateScore, applyCapabilityCompatCap } from './score-calculator';

/**
 * Evaluate all rules against selected tools and generate diagnostics
 */
export function evaluateRulesSync(
  selections: Tool[],
  rules: Rule[]
): EvaluationResult {
  const startTime = performance.now();
  
  const diagnostics: Diagnostic[] = [];
  
  // Evaluate each rule type
  for (const rule of rules) {
    switch (rule.kind) {
      case 'mutualExclusiveCategory':
        evaluateMutualExclusiveCategory(rule, selections, diagnostics);
        break;
      case 'hardConflict':
        evaluateHardConflict(rule, selections, diagnostics);
        break;
      case 'requiresTool':
        evaluateRequiresTool(rule, selections, diagnostics);
        break;
      case 'synergy':
        evaluateSynergy(rule, selections, diagnostics);
        break;
      case 'capabilityCompat':
        evaluateCapabilityCompat(rule, selections, diagnostics);
        break;
      case 'categoryCoverage':
        evaluateCategoryCoverage(rule, selections, diagnostics);
        break;
    }
  }
  
  // Apply capabilityCompat cap (+12 max)
  applyCapabilityCompatCap(diagnostics);
  
  // Calculate score and breakdown
  const breakdown = calculateScore(diagnostics);
  
  const evaluationTimeMs = performance.now() - startTime;
  
  return {
    score: breakdown.total,
    breakdown,
    diagnostics,
    evaluationTimeMs,
  };
}

/**
 * Evaluate mutual exclusive category rules
 * These rules are validated at the UI layer, but we generate diagnostics for telemetry
 */
function evaluateMutualExclusiveCategory(
  rule: MutualExclusiveCategoryRule,
  selections: Tool[],
  diagnostics: Diagnostic[]
): void {
  const toolsInCategory = selections.filter(t => t.categoryId === rule.categoryId);
  
  if (toolsInCategory.length > 1) {
    // This should be prevented by UI, but we log it for telemetry
    diagnostics.push({
      id: `${rule.id}-violation`,
      ruleId: rule.id,
      ruleVersion: rule.version,
      level: 'error',
      category: 'conflict',
      message: `Only one tool may be selected from ${rule.categoryId} category`,
      toolIds: toolsInCategory.map(t => t.id),
      weight: -50, // Severe penalty if this somehow happens
    });
  }
}

/**
 * Evaluate hard conflict rules
 */
function evaluateHardConflict(
  rule: HardConflictRule,
  selections: Tool[],
  diagnostics: Diagnostic[]
): void {
  const hasToolA = selections.some(t => t.id === rule.toolA);
  const hasToolB = selections.some(t => t.id === rule.toolB);
  
  if (hasToolA && hasToolB) {
    diagnostics.push({
      id: `${rule.id}-conflict`,
      ruleId: rule.id,
      ruleVersion: rule.version,
      level: 'error',
      category: 'conflict',
      message: rule.reason,
      toolIds: [rule.toolA, rule.toolB],
      weight: rule.weight, // Negative penalty
    });
  }
}

/**
 * Evaluate requires tool rules
 */
function evaluateRequiresTool(
  rule: RequiresToolRule,
  selections: Tool[],
  diagnostics: Diagnostic[]
): void {
  const hasTool = selections.some(t => t.id === rule.tool);
  
  if (!hasTool) {
    return; // Tool not selected, rule doesn't apply
  }
  
  const hasRequiredTool = rule.requiresAnyOf.some(requiredId =>
    selections.some(t => t.id === requiredId)
  );
  
  if (!hasRequiredTool) {
    // Find the category of the required tools for the CTA
    const requiredTool = selections.find(t => rule.requiresAnyOf.includes(t.id));
    const targetCategoryId = requiredTool?.categoryId;
    
    diagnostics.push({
      id: `${rule.id}-missing`,
      ruleId: rule.id,
      ruleVersion: rule.version,
      level: rule.severity === 'error' ? 'error' : 'warning',
      category: 'requirement',
      message: rule.reason,
      toolIds: [rule.tool],
      weight: rule.severity === 'error' ? -40 : -10,
      cta: targetCategoryId ? {
        kind: 'expand-category',
        targetCategoryId,
        label: 'Fix it',
      } : undefined,
    });
  }
}

/**
 * Evaluate synergy rules
 */
function evaluateSynergy(
  rule: SynergyRule,
  selections: Tool[],
  diagnostics: Diagnostic[]
): void {
  const hasToolA = selections.some(t => t.id === rule.toolA);
  const hasToolB = selections.some(t => t.id === rule.toolB);
  
  if (hasToolA && hasToolB) {
    diagnostics.push({
      id: `${rule.id}-synergy`,
      ruleId: rule.id,
      ruleVersion: rule.version,
      level: 'success',
      category: 'synergy',
      message: rule.reason,
      toolIds: [rule.toolA, rule.toolB],
      weight: rule.weight, // Positive bonus
    });
  }
}

/**
 * Evaluate capability compatibility rules
 */
function evaluateCapabilityCompat(
  rule: CapabilityCompatRule,
  selections: Tool[],
  diagnostics: Diagnostic[]
): void {
  const hasToolA = selections.some(t => t.id === rule.toolA);
  const hasToolB = selections.some(t => t.id === rule.toolB);
  
  if (hasToolA && hasToolB) {
    diagnostics.push({
      id: `${rule.id}-compat`,
      ruleId: rule.id,
      ruleVersion: rule.version,
      level: 'info',
      category: 'synergy',
      message: rule.reason,
      toolIds: [rule.toolA, rule.toolB],
      weight: rule.weight, // Positive bonus, max +8 per rule
    });
  }
}

/**
 * Evaluate category coverage rules
 */
function evaluateCategoryCoverage(
  rule: CategoryCoverageRule,
  selections: Tool[],
  diagnostics: Diagnostic[]
): void {
  const hasToolInCategory = selections.some(t => t.categoryId === rule.categoryId);
  
  if (hasToolInCategory) {
    diagnostics.push({
      id: `${rule.id}-coverage`,
      ruleId: rule.id,
      ruleVersion: rule.version,
      level: 'info',
      category: 'coverage',
      message: `Selected tool from ${rule.categoryId} category`,
      toolIds: selections.filter(t => t.categoryId === rule.categoryId).map(t => t.id),
      weight: rule.weight, // Positive bonus
    });
  }
}


