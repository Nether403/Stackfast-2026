import { z } from 'zod';
import type { ToolId } from './tool';
import type { CategoryId } from './category';
import { CategoryIdSchema } from './category';

/**
 * Diagnostic severity levels
 */
export type DiagnosticLevel = 'error' | 'warning' | 'info' | 'success';

/**
 * Diagnostic categories
 */
export type DiagnosticCategory = 'conflict' | 'synergy' | 'requirement' | 'coverage';

/**
 * Call-to-action types for diagnostics
 * CRITICAL: Data-only, no functions (Worker-safe)
 */
export interface DiagnosticCTA {
  kind: 'expand-category' | 'select-tool';
  targetCategoryId?: CategoryId;
  suggestedToolId?: ToolId;
  label?: string;
}

/**
 * Diagnostic result from rules engine
 * CRITICAL: Must be serializable for Worker communication (no functions)
 */
export interface Diagnostic {
  id: string;
  ruleId?: string;
  ruleVersion?: string;
  level: DiagnosticLevel;
  category: DiagnosticCategory;
  message: string;
  toolIds?: ToolId[];
  weight?: number; // Positive for bonuses, negative for penalties
  cta?: DiagnosticCTA;
}

/**
 * Zod schema for DiagnosticLevel validation
 */
export const DiagnosticLevelSchema = z.enum(['error', 'warning', 'info', 'success']);

/**
 * Zod schema for DiagnosticCategory validation
 */
export const DiagnosticCategorySchema = z.enum(['conflict', 'synergy', 'requirement', 'coverage']);

/**
 * Zod schema for DiagnosticCTA validation
 */
export const DiagnosticCTASchema = z.object({
  kind: z.enum(['expand-category', 'select-tool']),
  targetCategoryId: CategoryIdSchema.optional(),
  suggestedToolId: z.string().optional(),
  label: z.string().optional(),
});

/**
 * Zod schema for Diagnostic validation
 */
export const DiagnosticSchema = z.object({
  id: z.string(),
  ruleId: z.string().optional(),
  ruleVersion: z.string().optional(),
  level: DiagnosticLevelSchema,
  category: DiagnosticCategorySchema,
  message: z.string(),
  toolIds: z.array(z.string()).optional(),
  weight: z.number().optional(),
  cta: DiagnosticCTASchema.optional(),
});

/**
 * Type guard for Diagnostic
 */
export function isDiagnostic(value: unknown): value is Diagnostic {
  return DiagnosticSchema.safeParse(value).success;
}
