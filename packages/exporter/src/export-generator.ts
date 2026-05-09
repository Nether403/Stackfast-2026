import type { Diagnostic, ExportData, ExportFile, ExportFormat, ExportLog, Tool } from "@stackfast/schemas";
import { getApplicableRecipes } from "./recipes";
import { mergeRecipeTargets, sortRecipesByCategory } from "./recipe-matcher";
import {
  generateAdr,
  generateEnvExample,
  generatePackageJson,
  generateReadme,
  generateSetupGuide,
  getTemplateContent,
} from "./templates";

export class ExportError extends Error {
  constructor(
    message: string,
    public readonly missingRecipes: string[] = [],
    public readonly suggestion?: string,
  ) {
    super(message);
    this.name = "ExportError";
  }
}

export async function generateExport(
  tools: Tool[],
  diagnostics: Diagnostic[],
  format: ExportFormat = "zip",
  catalogVersion = "1.0.0",
  projectName = "stackfast-app",
): Promise<ExportData> {
  const applicableRecipes = getApplicableRecipes(tools);
  if (applicableRecipes.length === 0) {
    throw new ExportError("No recipes found for this tool combination", [], suggestNearestCombination());
  }

  const sortedRecipes = sortRecipesByCategory(applicableRecipes, tools);
  const mergedTargets = mergeRecipeTargets(sortedRecipes, tools);
  const files: ExportFile[] = [];

  files.push({
    path: "package.json",
    content: generatePackageJson({
      name: mergedTargets.packageJson.nameGenerator?.(tools) ?? projectName,
      version: "0.1.0",
      engines: mergedTargets.packageJson.engines,
      dependencies: mergedTargets.packageJson.deps,
      devDependencies: mergedTargets.packageJson.devDeps,
      scripts: mergedTargets.packageJson.scripts,
    }),
  });

  if (Object.keys(mergedTargets.env.example).length > 0) {
    files.push({
      path: ".env.example",
      content: generateEnvExample({
        example: mergedTargets.env.example,
        notes: mergedTargets.env.notes ?? [],
      }),
    });
  }

  for (const fileTarget of mergedTargets.files) {
    const content = getTemplateContent(fileTarget.templateId);
    const existingFile = files.find((file) => file.path === fileTarget.path);
    if (existingFile && fileTarget.mergeStrategy === "append") {
      existingFile.content += `\n${content}`;
    } else if (!existingFile) {
      files.push({ path: fileTarget.path, content });
    }
  }

  files.push({
    path: "README.md",
    content: generateReadme({
      title: mergedTargets.readme?.title,
      intro: mergedTargets.readme?.intro,
      tools,
      postInstallSteps: mergedTargets.postInstallSteps,
      envVars: mergedTargets.env.example,
      docsLinks: mergedTargets.docsLinks ?? [],
      diagnostics,
      includeCaveats: mergedTargets.readme?.includeCaveats ?? true,
    }),
  });

  files.push({
    path: "setup-guide.md",
    content: generateSetupGuide({
      projectName,
      tools,
      steps: mergedTargets.postInstallSteps,
    }),
  });

  const score = diagnostics.reduce((total, diagnostic) => total + (diagnostic.weight ?? 0), 50);
  files.push({ path: "docs/adr/0001-generated-stack.md", content: generateAdr({ tools, score }) });

  const log = generateExportLog(sortedRecipes, [], diagnostics);
  files.push({ path: "export-log.json", content: `${JSON.stringify(log, null, 2)}\n` });

  return {
    files,
    log,
    format,
    meta: {
      recipeOrder: sortedRecipes.map((recipe) => recipe.id),
      version: catalogVersion,
      generatedAt: new Date().toISOString(),
    },
  };
}

export function generateExportAsText(exportData: ExportData): string {
  return exportData.files
    .map((file) => [`## File: ${file.path}`, "", "```", file.content, "```"].join("\n"))
    .join("\n\n");
}

export function generateExportLog(
  appliedRecipes: Array<{ id: string; version: string; targets: { files: Array<{ path: string }> } }>,
  skippedRecipes: Array<{ recipe: { id: string }; reason: string }>,
  diagnostics: Diagnostic[],
): ExportLog {
  return {
    appliedRecipes: appliedRecipes.map((recipe) => ({
      id: recipe.id,
      version: recipe.version,
      files: recipe.targets.files.map((file) => file.path),
    })),
    skippedRecipes: skippedRecipes.map(({ recipe, reason }) => ({ id: recipe.id, reason })),
    warnings: diagnostics.filter((diagnostic) => diagnostic.level === "warning").map((diagnostic) => diagnostic.message),
  };
}

function suggestNearestCombination(): string {
  return "Select Next.js to enable the base starter recipe. Add Prisma/PostgreSQL, Clerk, or Stripe for richer scaffolds.";
}
