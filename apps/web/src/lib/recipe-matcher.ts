/**
 * Recipe matching and merging logic
 * Handles deterministic recipe ordering and merge strategies
 */

import type {
  Tool,
  ExportRecipe,
  RecipeTargets,
  CategoryId,
  FileTarget,
} from '@/types';

/**
 * Category order for deterministic recipe application
 * Frontend → Hosting → Database → ORM → Auth → Payments → Email → Storage → Styling
 */
const CATEGORY_ORDER: CategoryId[] = [
  'frontend',
  'hosting',
  'database',
  'orm',
  'auth',
  'payments',
  'email',
  'storage',
  'styling',
  'runtime', // Runtime at end as it's usually implicit
];

/**
 * Get the primary category for a recipe based on tools it applies to
 */
function getRecipeCategory(recipe: ExportRecipe, tools: Tool[]): CategoryId {
  void tools;

  // Check recipe ID for hints
  if (recipe.id.includes('nextjs') || recipe.id.includes('remix') || recipe.id.includes('astro')) {
    return 'frontend';
  }
  if (recipe.id.includes('prisma') || recipe.id.includes('drizzle') || recipe.id.includes('typeorm')) {
    return 'orm';
  }
  if (recipe.id.includes('postgres') || recipe.id.includes('mysql') || recipe.id.includes('mongodb')) {
    return 'database';
  }
  if (recipe.id.includes('clerk') || recipe.id.includes('auth0') || recipe.id.includes('nextauth')) {
    return 'auth';
  }
  if (recipe.id.includes('stripe') || recipe.id.includes('lemon') || recipe.id.includes('paddle')) {
    return 'payments';
  }
  if (recipe.id.includes('resend') || recipe.id.includes('sendgrid') || recipe.id.includes('postmark')) {
    return 'email';
  }
  if (recipe.id.includes('s3') || recipe.id.includes('cloudinary') || recipe.id.includes('upload')) {
    return 'storage';
  }
  if (recipe.id.includes('tailwind') || recipe.id.includes('css')) {
    return 'styling';
  }
  if (recipe.id.includes('vercel') || recipe.id.includes('railway') || recipe.id.includes('fly')) {
    return 'hosting';
  }
  
  // Default to frontend if can't determine
  return 'frontend';
}

/**
 * Sort recipes in deterministic order based on category
 */
export function sortRecipesByCategory(recipes: ExportRecipe[], tools: Tool[]): ExportRecipe[] {
  return [...recipes].sort((a, b) => {
    const catA = getRecipeCategory(a, tools);
    const catB = getRecipeCategory(b, tools);
    
    const indexA = CATEGORY_ORDER.indexOf(catA);
    const indexB = CATEGORY_ORDER.indexOf(catB);
    
    // If categories are the same, maintain original order
    if (indexA === indexB) return 0;
    
    return indexA - indexB;
  });
}

/**
 * Merged package.json configuration
 */
interface MergedPackageJson {
  name: string;
  version: string;
  engines?: {
    node?: string;
    bun?: string;
  };
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
  scripts: Record<string, string>;
  peerWarnings: string[];
}

/**
 * Merge package.json targets from multiple recipes
 * Strategy: Deep merge with last-wins for conflicts, most restrictive for engines
 */
export function mergePackageJsonTargets(
  recipes: ExportRecipe[],
  tools: Tool[]
): MergedPackageJson {
  const merged: MergedPackageJson = {
    name: 'stackfast-app',
    version: '0.1.0',
    dependencies: {},
    devDependencies: {},
    scripts: {},
    peerWarnings: [],
  };
  
  // Apply recipes in order
  for (const recipe of recipes) {
    const target = recipe.targets.packageJson;
    
    // Apply name generator (last one wins)
    if (target.nameGenerator) {
      merged.name = target.nameGenerator(tools);
    }
    
    // Merge engines (most restrictive)
    if (target.engines) {
      if (!merged.engines) {
        merged.engines = {};
      }
      if (target.engines.node) {
        merged.engines.node = getMostRestrictiveVersion(
          merged.engines.node,
          target.engines.node
        );
      }
      if (target.engines.bun) {
        merged.engines.bun = getMostRestrictiveVersion(
          merged.engines.bun,
          target.engines.bun
        );
      }
    }
    
    // Merge dependencies (last wins)
    Object.assign(merged.dependencies, target.deps);
    
    // Merge devDependencies (last wins)
    Object.assign(merged.devDependencies, target.devDeps);
    
    // Merge scripts (last wins)
    Object.assign(merged.scripts, target.scripts);
    
    // Collect peer warnings
    if (target.peerWarnings) {
      merged.peerWarnings.push(...target.peerWarnings);
    }
  }
  
  return merged;
}

/**
 * Get the most restrictive version constraint
 * For simplicity, just use the last one in MVP
 */
function getMostRestrictiveVersion(v1: string | undefined, v2: string): string {
  if (!v1) return v2;
  // In MVP, just use the last one (v2)
  // TODO: Implement proper semver comparison
  return v2;
}

/**
 * Merge file targets from multiple recipes
 * Strategy: Apply in order, respecting merge strategies
 */
export function mergeFileTargets(recipes: ExportRecipe[]): FileTarget[] {
  const fileMap = new Map<string, FileTarget>();
  
  for (const recipe of recipes) {
    for (const file of recipe.targets.files) {
      const existing = fileMap.get(file.path);
      
      if (!existing) {
        // New file, add it
        fileMap.set(file.path, file);
      } else {
        // File exists, apply merge strategy
        if (file.mergeStrategy === 'create') {
          // Skip if exists (first one wins)
          continue;
        } else if (file.mergeStrategy === 'append') {
          // Mark for append (will be handled by file generator)
          fileMap.set(file.path, {
            ...file,
            mergeStrategy: 'append',
          });
        } else if (file.mergeStrategy === 'patch') {
          // Not supported in MVP
          throw new Error(`Patch merge strategy not supported in MVP for file: ${file.path}`);
        }
      }
    }
  }
  
  return Array.from(fileMap.values());
}

/**
 * Merge environment variable targets
 * Strategy: Merge all variables, keep first comment for duplicates
 */
export function mergeEnvTargets(recipes: ExportRecipe[]): {
  example: Record<string, string>;
  notes: string[];
} {
  const merged = {
    example: {} as Record<string, string>,
    notes: [] as string[],
  };
  
  const seenVars = new Set<string>();
  
  for (const recipe of recipes) {
    const env = recipe.targets.env;
    
    // Merge example variables (first comment wins)
    for (const [key, value] of Object.entries(env.example)) {
      if (!seenVars.has(key)) {
        merged.example[key] = value;
        seenVars.add(key);
      }
    }
    
    // Collect all notes
    if (env.notes) {
      merged.notes.push(...env.notes);
    }
  }
  
  return merged;
}

/**
 * Merge post-install steps
 * Strategy: Concatenate in recipe order, removing duplicates
 */
export function mergePostInstallSteps(recipes: ExportRecipe[]): string[] {
  const steps: string[] = [];
  const seen = new Set<string>();
  
  for (const recipe of recipes) {
    for (const step of recipe.targets.postInstallSteps) {
      if (!seen.has(step)) {
        steps.push(step);
        seen.add(step);
      }
    }
  }
  
  return steps;
}

/**
 * Merge documentation links
 * Strategy: Collect all unique links
 */
export function mergeDocsLinks(recipes: ExportRecipe[]): string[] {
  const links = new Set<string>();
  
  for (const recipe of recipes) {
    if (recipe.targets.docsLinks) {
      recipe.targets.docsLinks.forEach(link => links.add(link));
    }
  }
  
  return Array.from(links);
}

/**
 * Merge all recipe targets into a single configuration
 */
export function mergeRecipeTargets(
  recipes: ExportRecipe[],
  tools: Tool[]
): RecipeTargets {
  // Sort recipes by category for deterministic ordering
  const sortedRecipes = sortRecipesByCategory(recipes, tools);
  
  // Merge all targets
  const packageJson = mergePackageJsonTargets(sortedRecipes, tools);
  const files = mergeFileTargets(sortedRecipes);
  const env = mergeEnvTargets(sortedRecipes);
  const postInstallSteps = mergePostInstallSteps(sortedRecipes);
  const docsLinks = mergeDocsLinks(sortedRecipes);
  
  // Combine readme configs (last one with values wins)
  let readme = sortedRecipes[0]?.targets.readme;
  for (const recipe of sortedRecipes) {
    if (recipe.targets.readme) {
      readme = { ...readme, ...recipe.targets.readme };
    }
  }
  
  return {
    packageJson: {
      nameGenerator: () => packageJson.name,
      engines: packageJson.engines,
      deps: packageJson.dependencies,
      devDeps: packageJson.devDependencies,
      scripts: packageJson.scripts,
      peerWarnings: packageJson.peerWarnings,
    },
    files,
    env,
    postInstallSteps,
    docsLinks,
    readme,
  };
}
