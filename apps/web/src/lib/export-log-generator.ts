/**
 * Export log generation
 * Creates export-log.json with applied recipes, skipped recipes, and warnings
 */

import type {
  ExportLog,
  ExportRecipe,
  Diagnostic,
  AppliedRecipe,
  SkippedRecipe,
} from '@/types';

/**
 * Generate export log from recipes and diagnostics
 */
export function generateExportLog(
  appliedRecipes: ExportRecipe[],
  skippedRecipes: Array<{ recipe: ExportRecipe; reason: string }>,
  diagnostics: Diagnostic[]
): ExportLog {
  // Build applied recipes list
  const applied: AppliedRecipe[] = appliedRecipes.map(recipe => ({
    id: recipe.id,
    version: recipe.version,
    files: recipe.targets.files.map(f => f.path),
  }));
  
  // Build skipped recipes list
  const skipped: SkippedRecipe[] = skippedRecipes.map(({ recipe, reason }) => ({
    id: recipe.id,
    reason,
  }));
  
  // Extract warnings from diagnostics
  const warnings = diagnostics
    .filter(d => d.level === 'warning')
    .map(d => d.message);
  
  return {
    appliedRecipes: applied,
    skippedRecipes: skipped,
    warnings,
  };
}

/**
 * Generate export-log.json file content
 */
export function generateExportLogFile(log: ExportLog): string {
  return JSON.stringify(log, null, 2) + '\n';
}
