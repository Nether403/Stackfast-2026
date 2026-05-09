import { z } from 'zod';
import type { ToolId } from './tool';
import type { CategoryId } from './category';
import { CategoryIdSchema } from './category';

/**
 * Base rule interface with common fields
 */
export interface BaseRule {
  id: string;
  version: string;
  kind: string;
}

/**
 * Mutual exclusive category rule
 * Enforces that only one tool can be selected from a category
 */
export interface MutualExclusiveCategoryRule extends BaseRule {
  kind: 'mutualExclusiveCategory';
  categoryId: CategoryId;
  severity: 'error';
}

/**
 * Hard conflict rule
 * Two tools that cannot be used together
 */
export interface HardConflictRule extends BaseRule {
  kind: 'hardConflict';
  toolA: ToolId;
  toolB: ToolId;
  reason: string;
  weight: number; // negative penalty
}

/**
 * Requires tool rule
 * A tool that requires another tool or category
 */
export interface RequiresToolRule extends BaseRule {
  kind: 'requiresTool';
  tool: ToolId;
  requiresAnyOf: ToolId[];
  reason: string;
  severity: 'error' | 'warn';
}

/**
 * Synergy rule
 * Two tools that work well together
 */
export interface SynergyRule extends BaseRule {
  kind: 'synergy';
  toolA: ToolId;
  toolB: ToolId;
  reason: string;
  weight: number; // positive bonus
}

/**
 * Capability compatibility rule
 * Tools with explicit runtime/adapter/database compatibility
 */
export interface CapabilityCompatRule extends BaseRule {
  kind: 'capabilityCompat';
  toolA: ToolId;
  toolB: ToolId;
  reason: string;
  weight: number; // positive bonus, max +8 per rule
}

/**
 * Category coverage rule
 * Bonus for selecting from a category
 */
export interface CategoryCoverageRule extends BaseRule {
  kind: 'categoryCoverage';
  categoryId: CategoryId;
  weight: number; // positive bonus
}

/**
 * Union type of all rule types
 */
export type Rule =
  | MutualExclusiveCategoryRule
  | HardConflictRule
  | RequiresToolRule
  | SynergyRule
  | CapabilityCompatRule
  | CategoryCoverageRule;

/**
 * Zod schema for BaseRule validation
 */
export const BaseRuleSchema = z.object({
  id: z.string(),
  version: z.string(),
  kind: z.string(),
});

/**
 * Zod schema for MutualExclusiveCategoryRule validation
 */
export const MutualExclusiveCategoryRuleSchema = BaseRuleSchema.extend({
  kind: z.literal('mutualExclusiveCategory'),
  categoryId: CategoryIdSchema,
  severity: z.literal('error'),
});

/**
 * Zod schema for HardConflictRule validation
 */
export const HardConflictRuleSchema = BaseRuleSchema.extend({
  kind: z.literal('hardConflict'),
  toolA: z.string(),
  toolB: z.string(),
  reason: z.string(),
  weight: z.number(),
});

/**
 * Zod schema for RequiresToolRule validation
 */
export const RequiresToolRuleSchema = BaseRuleSchema.extend({
  kind: z.literal('requiresTool'),
  tool: z.string(),
  requiresAnyOf: z.array(z.string()),
  reason: z.string(),
  severity: z.enum(['error', 'warn']),
});

/**
 * Zod schema for SynergyRule validation
 */
export const SynergyRuleSchema = BaseRuleSchema.extend({
  kind: z.literal('synergy'),
  toolA: z.string(),
  toolB: z.string(),
  reason: z.string(),
  weight: z.number(),
});

/**
 * Zod schema for CapabilityCompatRule validation
 */
export const CapabilityCompatRuleSchema = BaseRuleSchema.extend({
  kind: z.literal('capabilityCompat'),
  toolA: z.string(),
  toolB: z.string(),
  reason: z.string(),
  weight: z.number(),
});

/**
 * Zod schema for CategoryCoverageRule validation
 */
export const CategoryCoverageRuleSchema = BaseRuleSchema.extend({
  kind: z.literal('categoryCoverage'),
  categoryId: CategoryIdSchema,
  weight: z.number(),
});

/**
 * Zod schema for Rule validation (discriminated union)
 */
export const RuleSchema = z.discriminatedUnion('kind', [
  MutualExclusiveCategoryRuleSchema,
  HardConflictRuleSchema,
  RequiresToolRuleSchema,
  SynergyRuleSchema,
  CapabilityCompatRuleSchema,
  CategoryCoverageRuleSchema,
]);

/**
 * Type guard for Rule
 */
export function isRule(value: unknown): value is Rule {
  return RuleSchema.safeParse(value).success;
}
