import { z } from 'zod';

/**
 * Export format types
 */
export type ExportFormat = 'zip' | 'tar';

/**
 * Applied recipe information in export log
 */
export interface AppliedRecipe {
  id: string;
  version: string;
  files: string[];
}

/**
 * Skipped recipe information in export log
 */
export interface SkippedRecipe {
  id: string;
  reason: string;
}

/**
 * Export log structure
 * Documents which recipes were applied and any warnings
 */
export interface ExportLog {
  appliedRecipes: AppliedRecipe[];
  skippedRecipes: SkippedRecipe[];
  warnings: string[];
}

/**
 * Export metadata
 */
export interface ExportMetadata {
  recipeOrder: string[]; // Applied recipe IDs in order
  version: string; // Catalog/recipe set version
  generatedAt: string; // ISO timestamp
}

/**
 * Generated file in export
 */
export interface ExportFile {
  path: string;
  content: string;
}

/**
 * Complete export data structure
 */
export interface ExportData {
  files: ExportFile[];
  log: ExportLog;
  format: ExportFormat;
  meta: ExportMetadata;
}

/**
 * Zod schema for AppliedRecipe validation
 */
export const AppliedRecipeSchema = z.object({
  id: z.string(),
  version: z.string(),
  files: z.array(z.string()),
});

/**
 * Zod schema for SkippedRecipe validation
 */
export const SkippedRecipeSchema = z.object({
  id: z.string(),
  reason: z.string(),
});

/**
 * Zod schema for ExportLog validation
 */
export const ExportLogSchema = z.object({
  appliedRecipes: z.array(AppliedRecipeSchema),
  skippedRecipes: z.array(SkippedRecipeSchema),
  warnings: z.array(z.string()),
});

/**
 * Zod schema for ExportMetadata validation
 */
export const ExportMetadataSchema = z.object({
  recipeOrder: z.array(z.string()),
  version: z.string(),
  generatedAt: z.string(),
});

/**
 * Zod schema for ExportFile validation
 */
export const ExportFileSchema = z.object({
  path: z.string(),
  content: z.string(),
});

/**
 * Zod schema for ExportFormat validation
 */
export const ExportFormatSchema = z.enum(['zip', 'tar']);

/**
 * Zod schema for ExportData validation
 */
export const ExportDataSchema = z.object({
  files: z.array(ExportFileSchema),
  log: ExportLogSchema,
  format: ExportFormatSchema,
  meta: ExportMetadataSchema,
});

/**
 * Type guard for ExportData
 */
export function isExportData(value: unknown): value is ExportData {
  return ExportDataSchema.safeParse(value).success;
}
