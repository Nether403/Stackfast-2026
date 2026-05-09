/**
 * Main export generator
 * Orchestrates recipe matching, merging, and file generation
 */

import type {
  Tool,
  ExportData,
  ExportFile,
  ExportFormat,
  Diagnostic,
} from '@/types';
import { getApplicableRecipes } from '@/data/recipes';
import {
  sortRecipesByCategory,
  mergeRecipeTargets,
} from './recipe-matcher';
import { generatePackageJson } from '@/templates/package-json';
import { generateEnvExample } from '@/templates/env-example';
import { generateReadme } from '@/templates/readme';
import { getTemplateContent } from '@/templates/config-files';
import { generateExportLog, generateExportLogFile } from './export-log-generator';
import { ExportError, suggestNearestCombination } from './archive-generator';

/**
 * Generate export data from selected tools
 */
export async function generateExport(
  tools: Tool[],
  diagnostics: Diagnostic[],
  format: ExportFormat = 'zip',
  catalogVersion: string = '1.0.0'
): Promise<ExportData> {
  // Find applicable recipes
  const applicableRecipes = getApplicableRecipes(tools);
  
  if (applicableRecipes.length === 0) {
    const allRecipeIds = ['nextjs-base', 'nextjs-prisma-postgres', 'nextjs-clerk', 'stripe-integration'];
    throw new ExportError(
      'No recipes found for this tool combination',
      [],
      suggestNearestCombination([], allRecipeIds)
    );
  }
  
  // Sort recipes by category for deterministic ordering
  const sortedRecipes = sortRecipesByCategory(applicableRecipes, tools);
  
  // Merge all recipe targets
  const mergedTargets = mergeRecipeTargets(sortedRecipes, tools);
  
  // Generate files
  const files: ExportFile[] = [];
  
  // 1. Generate package.json
  const packageJsonContent = generatePackageJson({
    name: mergedTargets.packageJson.nameGenerator?.(tools) || 'stackfast-app',
    version: '0.1.0',
    engines: mergedTargets.packageJson.engines,
    dependencies: mergedTargets.packageJson.deps,
    devDependencies: mergedTargets.packageJson.devDeps,
    scripts: mergedTargets.packageJson.scripts,
  });
  files.push({
    path: 'package.json',
    content: packageJsonContent,
  });
  
  // 2. Generate .env.example
  if (Object.keys(mergedTargets.env.example).length > 0) {
    const envContent = generateEnvExample({
      example: mergedTargets.env.example,
      notes: mergedTargets.env.notes || [],
    });
    files.push({
      path: '.env.example',
      content: envContent,
    });
  }
  
  // 3. Generate config files from templates
  for (const fileTarget of mergedTargets.files) {
    try {
      const content = getTemplateContent(fileTarget.templateId);
      
      // Check if file already exists (for append strategy)
      const existingFile = files.find(f => f.path === fileTarget.path);
      
      if (existingFile && fileTarget.mergeStrategy === 'append') {
        // Append to existing file
        existingFile.content += '\n' + content;
      } else if (!existingFile) {
        // Create new file
        files.push({
          path: fileTarget.path,
          content,
        });
      }
      // If file exists and strategy is 'create', skip (first one wins)
    } catch (error) {
      console.warn(`Failed to generate file ${fileTarget.path}:`, error);
      // Continue with other files
    }
  }
  
  // 4. Generate README.md
  const readmeContent = generateReadme({
    title: mergedTargets.readme?.title,
    intro: mergedTargets.readme?.intro,
    tools,
    postInstallSteps: mergedTargets.postInstallSteps,
    envVars: mergedTargets.env.example,
    docsLinks: mergedTargets.docsLinks || [],
    diagnostics,
    includeCaveats: mergedTargets.readme?.includeCaveats ?? true,
  });
  files.push({
    path: 'README.md',
    content: readmeContent,
  });
  
  // 5. Generate export log
  const log = generateExportLog(sortedRecipes, [], diagnostics);
  const logContent = generateExportLogFile(log);
  files.push({
    path: 'export-log.json',
    content: logContent,
  });
  
  // 6. Create metadata
  const meta = {
    recipeOrder: sortedRecipes.map(r => r.id),
    version: catalogVersion,
    generatedAt: new Date().toISOString(),
  };
  
  return {
    files,
    log,
    format,
    meta,
  };
}

/**
 * Generate export as text (copyable format)
 */
export function generateExportAsText(exportData: ExportData): string {
  const lines: string[] = [];
  
  lines.push('# StackFast Export');
  lines.push('');
  lines.push(`Generated: ${exportData.meta.generatedAt}`);
  lines.push(`Version: ${exportData.meta.version}`);
  lines.push(`Recipes: ${exportData.meta.recipeOrder.join(', ')}`);
  lines.push('');
  lines.push('---');
  lines.push('');
  
  for (const file of exportData.files) {
    lines.push(`## File: ${file.path}`);
    lines.push('');
    lines.push('```');
    lines.push(file.content);
    lines.push('```');
    lines.push('');
  }
  
  return lines.join('\n');
}
