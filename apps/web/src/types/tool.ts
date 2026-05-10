import { z } from 'zod';
import type { CategoryId } from './category';
import { CategoryIdSchema } from './category';

/**
 * Tool identifier type
 */
export type ToolId = string;

/**
 * Pricing model types
 */
export type PricingModel = 'free' | 'free-tier' | 'paid';

/**
 * Pricing information for a tool
 */
export interface ToolPricing {
  model: PricingModel;
  note?: string;
  url?: string;
  lastVerified?: string; // ISO date
}

/**
 * Tool requirements
 */
export interface ToolRequirements {
  categoryId?: CategoryId;
  anyOfToolIds?: ToolId[];
}

/**
 * Tool capabilities and compatibility
 */
export interface ToolSupports {
  runtime?: ('node' | 'bun' | 'deno' | 'cloudflare-workers')[];
  dbs?: ('postgres' | 'mysql' | 'sqlite' | 'mongodb')[];
  frameworks?: ('nextjs' | 'remix' | 'astro' | 'sveltekit' | 'react' | 'vue')[];
}

/**
 * Tool definition from catalog
 */
export interface Tool {
  id: ToolId;
  name: string;
  categoryId: CategoryId;
  description: string;
  tags: string[];
  
  // Hosting & deployment
  hosted?: boolean;
  selfHostable?: boolean;
  
  // Technical capabilities
  languages: string[];
  supports: ToolSupports;
  
  // Relationships
  integrations: ToolId[];
  requires?: ToolRequirements;
  conflictsWith?: ToolId[];
  
  // Metadata
  pricing?: ToolPricing;
  docsUrl?: string;
  homepageUrl?: string;
  
  // Export
  exportRecipeId?: string;
}

/**
 * Zod schema for PricingModel validation
 */
export const PricingModelSchema = z.enum(['free', 'free-tier', 'paid']);

/**
 * Zod schema for ToolPricing validation
 */
export const ToolPricingSchema = z.object({
  model: PricingModelSchema,
  note: z.string().optional(),
  url: z.string().url().optional(),
  lastVerified: z.string().optional(),
});

/**
 * Zod schema for ToolRequirements validation
 */
export const ToolRequirementsSchema = z.object({
  categoryId: CategoryIdSchema.optional(),
  anyOfToolIds: z.array(z.string()).optional(),
});

/**
 * Zod schema for ToolSupports validation
 */
export const ToolSupportsSchema = z.object({
  runtime: z.array(z.enum(['node', 'bun', 'deno', 'cloudflare-workers'])).optional(),
  dbs: z.array(z.enum(['postgres', 'mysql', 'sqlite', 'mongodb'])).optional(),
  frameworks: z.array(z.enum(['nextjs', 'remix', 'astro', 'sveltekit', 'react', 'vue'])).optional(),
});

/**
 * Zod schema for Tool validation
 */
export const ToolSchema = z.object({
  id: z.string(),
  name: z.string(),
  categoryId: CategoryIdSchema,
  description: z.string(),
  tags: z.array(z.string()),
  hosted: z.boolean().optional(),
  selfHostable: z.boolean().optional(),
  languages: z.array(z.string()),
  supports: ToolSupportsSchema,
  integrations: z.array(z.string()),
  requires: ToolRequirementsSchema.optional(),
  conflictsWith: z.array(z.string()).optional(),
  pricing: ToolPricingSchema.optional(),
  docsUrl: z.string().url().optional(),
  homepageUrl: z.string().url().optional(),
  exportRecipeId: z.string().optional(),
});

/**
 * Type guard for Tool
 */
export function isTool(value: unknown): value is Tool {
  return ToolSchema.safeParse(value).success;
}
