import { z } from 'zod';
import type { CategoryId } from './category';
import type { ToolId } from './tool';
import { CategoryIdSchema } from './category';

/**
 * Suggestion priority levels
 */
export type SuggestionPriority = 'high' | 'medium' | 'low';

/**
 * Suggestion action types
 */
export type SuggestionAction = 'expand-category' | 'select-tool';

/**
 * Smart suggestion for tool selection
 */
export interface Suggestion {
  id: string;
  priority: SuggestionPriority;
  reason: string;
  targetCategoryId: CategoryId;
  suggestedToolId?: ToolId;
  action: SuggestionAction;
}

/**
 * Zod schema for SuggestionPriority validation
 */
export const SuggestionPrioritySchema = z.enum(['high', 'medium', 'low']);

/**
 * Zod schema for SuggestionAction validation
 */
export const SuggestionActionSchema = z.enum(['expand-category', 'select-tool']);

/**
 * Zod schema for Suggestion validation
 */
export const SuggestionSchema = z.object({
  id: z.string(),
  priority: SuggestionPrioritySchema,
  reason: z.string(),
  targetCategoryId: CategoryIdSchema,
  suggestedToolId: z.string().optional(),
  action: SuggestionActionSchema,
});

/**
 * Type guard for Suggestion
 */
export function isSuggestion(value: unknown): value is Suggestion {
  return SuggestionSchema.safeParse(value).success;
}
