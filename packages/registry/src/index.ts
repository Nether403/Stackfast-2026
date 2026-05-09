import {
  CatalogManifestSchema,
  CategorySchema,
  RuleSchema,
  ToolSchema,
  type Catalog,
  type Category,
  type Rule,
  type Tool,
} from "@stackfast/schemas";
import { z } from "zod";
import categoriesData from "./data/v1/categories.json";
import manifestData from "./data/v1/manifest.json";
import rulesData from "./data/v1/rules.json";
import toolsData from "./data/v1/tools.json";

const ToolArraySchema = z.array(ToolSchema);
const CategoryArraySchema = z.array(CategorySchema);
const RuleArraySchema = z.array(RuleSchema);

export class CatalogValidationError extends Error {
  constructor(public readonly issues: string[]) {
    super(`Catalog validation failed:\n${issues.map((issue) => `- ${issue}`).join("\n")}`);
    this.name = "CatalogValidationError";
  }
}

export type CatalogValidationResult = {
  ok: true;
  catalog: Catalog;
};

export class CatalogLoader {
  private readonly toolById: Map<string, Tool>;
  private readonly categoryById: Map<string, Category>;
  private readonly rulesById: Map<string, Rule>;

  constructor(private readonly catalog: Catalog = loadDefaultCatalog()) {
    this.toolById = new Map(catalog.tools.map((tool) => [tool.id, tool]));
    this.categoryById = new Map(catalog.categories.map((category) => [category.id, category]));
    this.rulesById = new Map(catalog.rules.map((rule) => [rule.id, rule]));
  }

  getCatalog(): Catalog {
    return this.catalog;
  }

  getTools(): Tool[] {
    return this.catalog.tools;
  }

  getCategories(): Category[] {
    return this.catalog.categories;
  }

  getRules(): Rule[] {
    return this.catalog.rules;
  }

  getTool(id: string): Tool | undefined {
    return this.toolById.get(id);
  }

  requireTool(id: string): Tool {
    const tool = this.getTool(id);
    if (!tool) {
      throw new Error(`Unknown tool: ${id}`);
    }
    return tool;
  }

  getCategory(id: string): Category | undefined {
    return this.categoryById.get(id);
  }

  getRule(id: string): Rule | undefined {
    return this.rulesById.get(id);
  }

  getToolsByCategory(categoryId: string): Tool[] {
    return this.catalog.tools.filter((tool) => tool.categoryId === categoryId);
  }

  searchTools(query: string): Tool[] {
    const needle = query.trim().toLowerCase();
    if (!needle) {
      return this.catalog.tools;
    }

    return this.catalog.tools.filter((tool) => {
      const haystack = [tool.name, tool.description, ...tool.tags, ...tool.languages].join(" ").toLowerCase();
      return haystack.includes(needle);
    });
  }
}

export function loadDefaultCatalog(): Catalog {
  const manifest = CatalogManifestSchema.parse(manifestData);
  const categories = CategoryArraySchema.parse(categoriesData);
  const tools = ToolArraySchema.parse(toolsData);
  const rules = RuleArraySchema.parse(rulesData);

  const catalog: Catalog = {
    version: manifest.version,
    updatedAt: manifest.updatedAt,
    manifest,
    categories,
    tools,
    rules,
  };

  validateCatalog(catalog);
  return catalog;
}

export function validateDefaultCatalog(): CatalogValidationResult {
  return { ok: true, catalog: loadDefaultCatalog() };
}

export function validateCatalog(catalog: Catalog): CatalogValidationResult {
  const issues: string[] = [];

  collectDuplicateIds("category", catalog.categories, issues);
  collectDuplicateIds("tool", catalog.tools, issues);
  collectDuplicateIds("rule", catalog.rules, issues);

  const categoryIds = new Set(catalog.categories.map((category) => category.id));
  const toolIds = new Set(catalog.tools.map((tool) => tool.id));

  for (const tool of catalog.tools) {
    if (!categoryIds.has(tool.categoryId)) {
      issues.push(`Tool ${tool.id} references unknown category ${tool.categoryId}`);
    }

    for (const integrationId of tool.integrations) {
      if (!toolIds.has(integrationId)) {
        issues.push(`Tool ${tool.id} integration references unknown tool ${integrationId}`);
      }
    }

    for (const conflictId of tool.conflictsWith ?? []) {
      if (!toolIds.has(conflictId)) {
        issues.push(`Tool ${tool.id} conflict references unknown tool ${conflictId}`);
      }
    }

    for (const requiredId of tool.requires?.anyOfToolIds ?? []) {
      if (!toolIds.has(requiredId)) {
        issues.push(`Tool ${tool.id} requirement references unknown tool ${requiredId}`);
      }
    }
  }

  for (const rule of catalog.rules) {
    if ("categoryId" in rule && !categoryIds.has(rule.categoryId)) {
      issues.push(`Rule ${rule.id} references unknown category ${rule.categoryId}`);
    }

    if ("toolA" in rule && !toolIds.has(rule.toolA)) {
      issues.push(`Rule ${rule.id} references unknown toolA ${rule.toolA}`);
    }

    if ("toolB" in rule && !toolIds.has(rule.toolB)) {
      issues.push(`Rule ${rule.id} references unknown toolB ${rule.toolB}`);
    }

    if ("tool" in rule && !toolIds.has(rule.tool)) {
      issues.push(`Rule ${rule.id} references unknown tool ${rule.tool}`);
    }

    if ("requiresAnyOf" in rule) {
      for (const requiredId of rule.requiresAnyOf) {
        if (!toolIds.has(requiredId)) {
          issues.push(`Rule ${rule.id} requirement references unknown tool ${requiredId}`);
        }
      }
    }
  }

  if (issues.length > 0) {
    throw new CatalogValidationError(issues);
  }

  return { ok: true, catalog };
}

function collectDuplicateIds(
  label: string,
  values: Array<{ id: string }>,
  issues: string[],
): void {
  const seen = new Set<string>();
  for (const value of values) {
    if (seen.has(value.id)) {
      issues.push(`Duplicate ${label} id ${value.id}`);
    }
    seen.add(value.id);
  }
}

export const defaultCatalog = loadDefaultCatalog();
export const catalogLoader = new CatalogLoader(defaultCatalog);
