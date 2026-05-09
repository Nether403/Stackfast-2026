import { z } from 'zod';
import type { Tool } from './tool';

/**
 * File merge strategies for export recipes
 */
export type MergeStrategy = 'create' | 'append' | 'patch';

/**
 * Package.json target configuration
 */
export interface PackageJsonTarget {
  nameGenerator?: (tools: Tool[]) => string; // Optional, defaults to "stackfast-app"
  engines?: {
    node?: string;
    bun?: string;
  };
  deps: Record<string, string>;
  devDeps: Record<string, string>;
  scripts: Record<string, string>;
  peerWarnings?: string[];
}

/**
 * File target configuration
 */
export interface FileTarget {
  path: string;
  templateId: string;
  mergeStrategy: MergeStrategy;
}

/**
 * Environment variables configuration
 */
export interface EnvTarget {
  example: Record<string, string>;
  notes?: string[];
}

/**
 * README configuration
 */
export interface ReadmeConfig {
  title?: string;
  intro?: string;
  includeCaveats?: boolean;
}

/**
 * Recipe targets - what files and configs to generate
 */
export interface RecipeTargets {
  packageJson: PackageJsonTarget;
  files: FileTarget[];
  env: EnvTarget;
  postInstallSteps: string[];
  docsLinks?: string[];
  readme?: ReadmeConfig;
}

/**
 * Export recipe definition
 * Function-based for MVP (TypeScript modules)
 */
export interface ExportRecipe {
  id: string;
  version: string;
  appliesWhen: (tools: Tool[]) => boolean; // Function-based for MVP
  targets: RecipeTargets;
  conflicts?: string[]; // Recipe IDs that conflict with this one
}

/**
 * Zod schema for MergeStrategy validation
 */
export const MergeStrategySchema = z.enum(['create', 'append', 'patch']);

/**
 * Zod schema for PackageJsonTarget validation
 */
export const PackageJsonTargetSchema = z.object({
  nameGenerator: z.function().optional(),
  engines: z.object({
    node: z.string().optional(),
    bun: z.string().optional(),
  }).optional(),
  deps: z.record(z.string()),
  devDeps: z.record(z.string()),
  scripts: z.record(z.string()),
  peerWarnings: z.array(z.string()).optional(),
});

/**
 * Zod schema for FileTarget validation
 */
export const FileTargetSchema = z.object({
  path: z.string(),
  templateId: z.string(),
  mergeStrategy: MergeStrategySchema,
});

/**
 * Zod schema for EnvTarget validation
 */
export const EnvTargetSchema = z.object({
  example: z.record(z.string()),
  notes: z.array(z.string()).optional(),
});

/**
 * Zod schema for ReadmeConfig validation
 */
export const ReadmeConfigSchema = z.object({
  title: z.string().optional(),
  intro: z.string().optional(),
  includeCaveats: z.boolean().optional(),
});

/**
 * Zod schema for RecipeTargets validation
 */
export const RecipeTargetsSchema = z.object({
  packageJson: PackageJsonTargetSchema,
  files: z.array(FileTargetSchema),
  env: EnvTargetSchema,
  postInstallSteps: z.array(z.string()),
  docsLinks: z.array(z.string()).optional(),
  readme: ReadmeConfigSchema.optional(),
});

/**
 * Zod schema for ExportRecipe validation (partial - can't validate functions)
 */
export const ExportRecipeSchema = z.object({
  id: z.string(),
  version: z.string(),
  appliesWhen: z.function(),
  targets: RecipeTargetsSchema,
  conflicts: z.array(z.string()).optional(),
});
