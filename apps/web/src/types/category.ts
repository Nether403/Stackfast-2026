import { z } from 'zod';

/**
 * Canonical category IDs used throughout the application
 * CRITICAL: Use these exact IDs everywhere - no variations
 */
export type CategoryId =
  | 'frontend'
  | 'runtime'
  | 'hosting'
  | 'database'
  | 'orm'
  | 'auth'
  | 'payments'
  | 'email'
  | 'storage'
  | 'styling'
  | 'agent-framework'
  | 'ai-model'
  | 'vector-database'
  | 'eval-observability'
  | 'backend-framework'
  | 'queue-workflow'
  | 'testing'
  | 'monorepo'
  | 'cms'
  | 'mobile';

/**
 * Cardinality types for category selection rules
 */
export type Cardinality = 'exactly-one' | 'at-most-one' | 'zero-or-one' | 'zero-to-many';

/**
 * Category definition
 */
export interface Category {
  id: CategoryId;
  name: string;
  description: string;
  required: boolean;
  cardinality: Cardinality;
  order: number;
  capabilities?: string[];
}

/**
 * Zod schema for CategoryId validation
 */
export const CategoryIdSchema = z.enum([
  'frontend',
  'runtime',
  'hosting',
  'database',
  'orm',
  'auth',
  'payments',
  'email',
  'storage',
  'styling',
  'agent-framework',
  'ai-model',
  'vector-database',
  'eval-observability',
  'backend-framework',
  'queue-workflow',
  'testing',
  'monorepo',
  'cms',
  'mobile',
]);

/**
 * Zod schema for Cardinality validation
 */
export const CardinalitySchema = z.enum([
  'exactly-one',
  'at-most-one',
  'zero-or-one',
  'zero-to-many',
]);

/**
 * Zod schema for Category validation
 */
export const CategorySchema = z.object({
  id: CategoryIdSchema,
  name: z.string(),
  description: z.string(),
  required: z.boolean(),
  cardinality: CardinalitySchema,
  order: z.number(),
  capabilities: z.array(z.string()).optional(),
});

/**
 * Type guard for CategoryId
 */
export function isCategoryId(value: unknown): value is CategoryId {
  return CategoryIdSchema.safeParse(value).success;
}
