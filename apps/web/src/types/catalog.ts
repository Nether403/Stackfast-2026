import { z } from 'zod';
import type { Tool } from './tool';
import type { Category } from './category';
import type { Rule } from './rule';

/**
 * Catalog manifest structure for versioned catalog loading
 */
export interface CatalogManifest {
  version: string;
  updatedAt: string; // ISO timestamp
  files: {
    tools: string;
    categories: string;
    rules: string;
  };
  etag?: string;
}

/**
 * Complete catalog data structure
 */
export interface Catalog {
  version: string;
  updatedAt: string;
  tools: Tool[];
  categories: Category[];
  rules: Rule[];
}

/**
 * Zod schema for CatalogManifest validation
 */
export const CatalogManifestSchema = z.object({
  version: z.string(),
  updatedAt: z.string(),
  files: z.object({
    tools: z.string(),
    categories: z.string(),
    rules: z.string(),
  }),
  etag: z.string().optional(),
});

/**
 * Type guard for CatalogManifest
 */
export function isCatalogManifest(value: unknown): value is CatalogManifest {
  return CatalogManifestSchema.safeParse(value).success;
}
