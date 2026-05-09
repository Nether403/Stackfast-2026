import type { CategoryId, ExportRecipe, FileTarget, RecipeTargets, Tool } from "@stackfast/schemas";

const CATEGORY_ORDER: CategoryId[] = [
  "frontend",
  "hosting",
  "database",
  "orm",
  "auth",
  "payments",
  "email",
  "storage",
  "styling",
  "runtime",
];

export function sortRecipesByCategory(recipes: ExportRecipe[], tools: Tool[]): ExportRecipe[] {
  return [...recipes].sort((a, b) => {
    const indexA = CATEGORY_ORDER.indexOf(getRecipeCategory(a, tools));
    const indexB = CATEGORY_ORDER.indexOf(getRecipeCategory(b, tools));
    return indexA - indexB;
  });
}

export function mergeRecipeTargets(recipes: ExportRecipe[], tools: Tool[]): RecipeTargets {
  const sortedRecipes = sortRecipesByCategory(recipes, tools);
  const packageJson = mergePackageJsonTargets(sortedRecipes, tools);
  const files = mergeFileTargets(sortedRecipes);
  const env = mergeEnvTargets(sortedRecipes);
  const postInstallSteps = mergePostInstallSteps(sortedRecipes);
  const docsLinks = mergeDocsLinks(sortedRecipes);
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

export function mergePackageJsonTargets(recipes: ExportRecipe[], tools: Tool[]): {
  name: string;
  version: string;
  engines?: { node?: string; bun?: string };
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
  scripts: Record<string, string>;
  peerWarnings: string[];
} {
  const merged = {
    name: "stackfast-app",
    version: "0.1.0",
    engines: undefined as { node?: string; bun?: string } | undefined,
    dependencies: {} as Record<string, string>,
    devDependencies: {} as Record<string, string>,
    scripts: {} as Record<string, string>,
    peerWarnings: [] as string[],
  };

  for (const recipe of recipes) {
    const target = recipe.targets.packageJson;
    if (target.nameGenerator) {
      merged.name = target.nameGenerator(tools);
    }
    if (target.engines) {
      merged.engines = { ...merged.engines, ...target.engines };
    }
    Object.assign(merged.dependencies, target.deps);
    Object.assign(merged.devDependencies, target.devDeps);
    Object.assign(merged.scripts, target.scripts);
    if (target.peerWarnings) {
      merged.peerWarnings.push(...target.peerWarnings);
    }
  }

  return merged;
}

export function mergeFileTargets(recipes: ExportRecipe[]): FileTarget[] {
  const fileMap = new Map<string, FileTarget>();
  for (const recipe of recipes) {
    for (const file of recipe.targets.files) {
      if (!fileMap.has(file.path) || file.mergeStrategy === "append") {
        fileMap.set(file.path, file);
      }
      if (file.mergeStrategy === "patch") {
        throw new Error(`Patch merge strategy not supported in MVP for file: ${file.path}`);
      }
    }
  }
  return Array.from(fileMap.values());
}

export function mergeEnvTargets(recipes: ExportRecipe[]): { example: Record<string, string>; notes: string[] } {
  const example: Record<string, string> = {};
  const notes: string[] = [];
  for (const recipe of recipes) {
    Object.assign(example, recipe.targets.env.example);
    notes.push(...(recipe.targets.env.notes ?? []));
  }
  return { example, notes };
}

export function mergePostInstallSteps(recipes: ExportRecipe[]): string[] {
  return unique(recipes.flatMap((recipe) => recipe.targets.postInstallSteps));
}

export function mergeDocsLinks(recipes: ExportRecipe[]): string[] {
  return unique(recipes.flatMap((recipe) => recipe.targets.docsLinks ?? []));
}

function getRecipeCategory(recipe: ExportRecipe, tools: Tool[]): CategoryId {
  const matchingTool = tools.find((tool) => recipe.id.includes(tool.id));
  return matchingTool?.categoryId ?? "frontend";
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values));
}
