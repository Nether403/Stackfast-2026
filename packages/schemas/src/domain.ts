import { z } from "zod";

export const CategoryIdSchema = z.enum([
  "frontend",
  "runtime",
  "hosting",
  "database",
  "orm",
  "auth",
  "payments",
  "email",
  "storage",
  "styling",
]);

export type CategoryId = z.infer<typeof CategoryIdSchema>;

export const CardinalitySchema = z.enum([
  "exactly-one",
  "at-most-one",
  "zero-or-one",
  "zero-to-many",
]);

export type Cardinality = z.infer<typeof CardinalitySchema>;

export const CategorySchema = z.object({
  id: CategoryIdSchema,
  name: z.string().min(1),
  description: z.string().min(1),
  required: z.boolean(),
  cardinality: CardinalitySchema,
  order: z.number().int().nonnegative(),
  capabilities: z.array(z.string()).optional(),
});

export type Category = z.infer<typeof CategorySchema>;

export const PricingModelSchema = z.enum(["free", "free-tier", "paid"]);
export type PricingModel = z.infer<typeof PricingModelSchema>;

export const ToolPricingSchema = z.object({
  model: PricingModelSchema,
  note: z.string().optional(),
  url: z.string().url().optional(),
  lastVerified: z.string().optional(),
});

export type ToolPricing = z.infer<typeof ToolPricingSchema>;

export const ToolRequirementsSchema = z.object({
  categoryId: CategoryIdSchema.optional(),
  anyOfToolIds: z.array(z.string()).optional(),
});

export type ToolRequirements = z.infer<typeof ToolRequirementsSchema>;

export const ToolSupportsSchema = z.object({
  runtime: z.array(z.enum(["node", "bun"])).optional(),
  dbs: z.array(z.enum(["postgres", "mysql", "sqlite", "mongodb"])).optional(),
  frameworks: z.array(z.enum(["nextjs", "remix", "astro", "sveltekit"])).optional(),
});

export type ToolSupports = z.infer<typeof ToolSupportsSchema>;

export const ToolSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  categoryId: CategoryIdSchema,
  description: z.string().min(1),
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
  lastVerified: z.string().min(1),
  sourceUrls: z.array(z.string().url()).min(1),
  confidence: z.number().min(0).max(1),
  capabilities: z.array(z.string().min(1)).min(1),
  deprecated: z.boolean(),
});

export type Tool = z.infer<typeof ToolSchema>;
export type ToolId = Tool["id"];

export const BaseRuleSchema = z.object({
  id: z.string().min(1),
  version: z.string().min(1),
  kind: z.string().min(1),
});

export const MutualExclusiveCategoryRuleSchema = BaseRuleSchema.extend({
  kind: z.literal("mutualExclusiveCategory"),
  categoryId: CategoryIdSchema,
  severity: z.literal("error"),
});

export const HardConflictRuleSchema = BaseRuleSchema.extend({
  kind: z.literal("hardConflict"),
  toolA: z.string().min(1),
  toolB: z.string().min(1),
  reason: z.string().min(1),
  weight: z.number(),
});

export const RequiresToolRuleSchema = BaseRuleSchema.extend({
  kind: z.literal("requiresTool"),
  tool: z.string().min(1),
  requiresAnyOf: z.array(z.string().min(1)),
  reason: z.string().min(1),
  severity: z.enum(["error", "warn"]),
});

export const SynergyRuleSchema = BaseRuleSchema.extend({
  kind: z.literal("synergy"),
  toolA: z.string().min(1),
  toolB: z.string().min(1),
  reason: z.string().min(1),
  weight: z.number(),
});

export const CapabilityCompatRuleSchema = BaseRuleSchema.extend({
  kind: z.literal("capabilityCompat"),
  toolA: z.string().min(1),
  toolB: z.string().min(1),
  reason: z.string().min(1),
  weight: z.number(),
});

export const CategoryCoverageRuleSchema = BaseRuleSchema.extend({
  kind: z.literal("categoryCoverage"),
  categoryId: CategoryIdSchema,
  weight: z.number(),
});

export const RuleSchema = z.discriminatedUnion("kind", [
  MutualExclusiveCategoryRuleSchema,
  HardConflictRuleSchema,
  RequiresToolRuleSchema,
  SynergyRuleSchema,
  CapabilityCompatRuleSchema,
  CategoryCoverageRuleSchema,
]);

export type Rule = z.infer<typeof RuleSchema>;
export type MutualExclusiveCategoryRule = z.infer<typeof MutualExclusiveCategoryRuleSchema>;
export type HardConflictRule = z.infer<typeof HardConflictRuleSchema>;
export type RequiresToolRule = z.infer<typeof RequiresToolRuleSchema>;
export type SynergyRule = z.infer<typeof SynergyRuleSchema>;
export type CapabilityCompatRule = z.infer<typeof CapabilityCompatRuleSchema>;
export type CategoryCoverageRule = z.infer<typeof CategoryCoverageRuleSchema>;

export const DiagnosticLevelSchema = z.enum(["error", "warning", "info", "success"]);
export type DiagnosticLevel = z.infer<typeof DiagnosticLevelSchema>;

export const DiagnosticCategorySchema = z.enum([
  "conflict",
  "synergy",
  "requirement",
  "coverage",
]);
export type DiagnosticCategory = z.infer<typeof DiagnosticCategorySchema>;

export const DiagnosticCTASchema = z.object({
  kind: z.enum(["expand-category", "select-tool"]),
  targetCategoryId: CategoryIdSchema.optional(),
  suggestedToolId: z.string().optional(),
  label: z.string().optional(),
});

export type DiagnosticCTA = z.infer<typeof DiagnosticCTASchema>;

export const DiagnosticSchema = z.object({
  id: z.string().min(1),
  ruleId: z.string().optional(),
  ruleVersion: z.string().optional(),
  level: DiagnosticLevelSchema,
  category: DiagnosticCategorySchema,
  message: z.string().min(1),
  toolIds: z.array(z.string()).optional(),
  weight: z.number().optional(),
  cta: DiagnosticCTASchema.optional(),
});

export type Diagnostic = z.infer<typeof DiagnosticSchema>;

export const ScoreBreakdownSchema = z.object({
  base: z.number(),
  bonuses: z.array(z.object({ reason: z.string(), weight: z.number() })),
  penalties: z.array(z.object({ reason: z.string(), weight: z.number() })),
  total: z.number(),
});

export type ScoreBreakdown = z.infer<typeof ScoreBreakdownSchema>;

export const EvaluationResultSchema = z.object({
  score: z.number(),
  breakdown: ScoreBreakdownSchema,
  diagnostics: z.array(DiagnosticSchema),
  evaluationTimeMs: z.number(),
});

export type EvaluationResult = z.infer<typeof EvaluationResultSchema>;

export const CatalogManifestSchema = z.object({
  version: z.string().min(1),
  updatedAt: z.string().min(1),
  files: z.object({
    categories: z.string().min(1),
    tools: z.string().min(1),
    rules: z.string().min(1),
  }),
  etag: z.string().optional(),
});

export type CatalogManifest = z.infer<typeof CatalogManifestSchema>;

export const CatalogSchema = z.object({
  version: z.string().min(1),
  updatedAt: z.string().min(1),
  categories: z.array(CategorySchema),
  tools: z.array(ToolSchema),
  rules: z.array(RuleSchema),
  manifest: CatalogManifestSchema,
});

export type Catalog = z.infer<typeof CatalogSchema>;

export const MergeStrategySchema = z.enum(["create", "append", "patch"]);
export type MergeStrategy = z.infer<typeof MergeStrategySchema>;

export const PackageJsonTargetSchema = z.object({
  engines: z.object({ node: z.string().optional(), bun: z.string().optional() }).optional(),
  deps: z.record(z.string()),
  devDeps: z.record(z.string()),
  scripts: z.record(z.string()),
  peerWarnings: z.array(z.string()).optional(),
});

export type PackageJsonTarget = z.infer<typeof PackageJsonTargetSchema> & {
  nameGenerator?: (tools: Tool[]) => string;
};

export const FileTargetSchema = z.object({
  path: z.string().min(1),
  templateId: z.string().min(1),
  mergeStrategy: MergeStrategySchema,
});

export type FileTarget = z.infer<typeof FileTargetSchema>;

export const EnvTargetSchema = z.object({
  example: z.record(z.string()),
  notes: z.array(z.string()).optional(),
});

export type EnvTarget = z.infer<typeof EnvTargetSchema>;

export const ReadmeConfigSchema = z.object({
  title: z.string().optional(),
  intro: z.string().optional(),
  includeCaveats: z.boolean().optional(),
});

export type ReadmeConfig = z.infer<typeof ReadmeConfigSchema>;

export const RecipeTargetsSchema = z.object({
  packageJson: PackageJsonTargetSchema,
  files: z.array(FileTargetSchema),
  env: EnvTargetSchema,
  postInstallSteps: z.array(z.string()),
  docsLinks: z.array(z.string()).optional(),
  readme: ReadmeConfigSchema.optional(),
});

export type RecipeTargets = z.infer<typeof RecipeTargetsSchema> & {
  packageJson: PackageJsonTarget;
};

export type ExportRecipe = {
  id: string;
  version: string;
  appliesWhen: (tools: Tool[]) => boolean;
  targets: RecipeTargets;
  conflicts?: string[];
};

export const ExportRecipeMetadataSchema = z.object({
  id: z.string().min(1),
  version: z.string().min(1),
  targets: RecipeTargetsSchema,
  conflicts: z.array(z.string()).optional(),
});

export const ExportFormatSchema = z.enum(["zip", "tar"]);
export type ExportFormat = z.infer<typeof ExportFormatSchema>;

export const AppliedRecipeSchema = z.object({
  id: z.string(),
  version: z.string(),
  files: z.array(z.string()),
});

export type AppliedRecipe = z.infer<typeof AppliedRecipeSchema>;

export const SkippedRecipeSchema = z.object({
  id: z.string(),
  reason: z.string(),
});

export type SkippedRecipe = z.infer<typeof SkippedRecipeSchema>;

export const ExportLogSchema = z.object({
  appliedRecipes: z.array(AppliedRecipeSchema),
  skippedRecipes: z.array(SkippedRecipeSchema),
  warnings: z.array(z.string()),
});

export type ExportLog = z.infer<typeof ExportLogSchema>;

export const ExportMetadataSchema = z.object({
  recipeOrder: z.array(z.string()),
  version: z.string(),
  generatedAt: z.string(),
});

export type ExportMetadata = z.infer<typeof ExportMetadataSchema>;

export const ExportFileSchema = z.object({
  path: z.string(),
  content: z.string(),
});

export type ExportFile = z.infer<typeof ExportFileSchema>;

export const ExportDataSchema = z.object({
  files: z.array(ExportFileSchema),
  log: ExportLogSchema,
  format: ExportFormatSchema,
  meta: ExportMetadataSchema,
});

export type ExportData = z.infer<typeof ExportDataSchema>;

export const StackAnalyzeRequestSchema = z.object({
  toolIds: z.array(z.string()).min(1),
});

export const StackAnalyzeResponseSchema = z.object({
  harmonyScore: z.number(),
  conflicts: z.array(DiagnosticSchema),
  warnings: z.array(DiagnosticSchema),
  synergies: z.array(DiagnosticSchema),
  recommendations: z.array(z.string()),
});

export const ScaffoldRequestSchema = z.object({
  toolIds: z.array(z.string()).min(1),
  projectName: z.string().min(1),
});

export const BlueprintRequestSchema = z.object({
  idea: z.string().min(1),
  constraints: z.array(z.string()).optional(),
  preferredTools: z.array(z.string()).optional(),
  budget: z.enum(["low", "medium", "high", "enterprise"]).optional(),
  timeline: z.enum(["prototype", "mvp", "production"]).optional(),
  teamSize: z.number().int().positive().optional(),
});

export type StackAnalyzeRequest = z.infer<typeof StackAnalyzeRequestSchema>;
export type StackAnalyzeResponse = z.infer<typeof StackAnalyzeResponseSchema>;
export type ScaffoldRequest = z.infer<typeof ScaffoldRequestSchema>;

export const ScaffoldResponseSchema = z.object({
  id: z.string(),
  url: z.string().optional(),
  files: z.array(z.object({ path: z.string(), content: z.string() })).optional()
});
export type ScaffoldResponse = z.infer<typeof ScaffoldResponseSchema>;

export type BlueprintRequest = z.infer<typeof BlueprintRequestSchema>;

export const BlueprintAlternativeSchema = z.object({
  id: z.string(),
  name: z.string(),
  tools: z.array(ToolSchema),
  score: z.number(),
  tradeoffs: z.array(z.string()),
});
export type BlueprintAlternative = z.infer<typeof BlueprintAlternativeSchema>;

export const BlueprintResponseSchema = z.object({
  id: z.string(),
  idea: z.string(),
  primaryStack: z.object({
    tools: z.array(ToolSchema),
    score: z.number(),
    diagnostics: z.array(DiagnosticSchema),
  }),
  alternatives: z.array(BlueprintAlternativeSchema),
  rationale: z.string(),
});
export type BlueprintResponse = z.infer<typeof BlueprintResponseSchema>;

export const CompatibilityResponseSchema = z.object({
  toolA: z.string(),
  toolB: z.string(),
  score: z.number(),
  diagnostics: z.array(DiagnosticSchema),
});
export type CompatibilityResponse = z.infer<typeof CompatibilityResponseSchema>;

export const MigrationResponseSchema = z.object({
  from: z.string(),
  to: z.string(),
  steps: z.array(z.string()),
  complexity: z.enum(["low", "medium", "high"]),
  estimatedTime: z.string(),
});
export type MigrationResponse = z.infer<typeof MigrationResponseSchema>;

// ---------------------------------------------------------------------------
// Phase 5 — AI-enhanced blueprint schemas
// ---------------------------------------------------------------------------

export const ToolCostEstimateSchema = z.object({
  toolId: z.string(),
  toolName: z.string(),
  pricingModel: PricingModelSchema,
  estimatedMonthlyCost: z.number().nullable(),
  note: z.string(),
});
export type ToolCostEstimate = z.infer<typeof ToolCostEstimateSchema>;

export const BlueprintCostEstimateSchema = z.object({
  items: z.array(ToolCostEstimateSchema),
  totalMonthlyEstimate: z.number(),
  totalAnnualEstimate: z.number(),
  currency: z.literal("USD"),
});
export type BlueprintCostEstimate = z.infer<typeof BlueprintCostEstimateSchema>;

export const RoadmapPhaseSchema = z.object({
  name: z.string(),
  duration: z.string(),
  tasks: z.array(z.string()).min(1),
});
export type RoadmapPhase = z.infer<typeof RoadmapPhaseSchema>;

export const ImplementationRoadmapSchema = z.object({
  phases: z.array(RoadmapPhaseSchema).min(2).max(5),
  totalEstimate: z.string(),
});
export type ImplementationRoadmap = z.infer<typeof ImplementationRoadmapSchema>;

export const WhyNotExplanationSchema = z.object({
  reason: z.string(),
  betterFor: z.string().optional(),
});
export type WhyNotExplanation = z.infer<typeof WhyNotExplanationSchema>;

export const EnhancedAlternativeSchema = z.object({
  id: z.string(),
  name: z.string(),
  toolIds: z.array(z.string()),
  harmonyScore: z.number(),
  tradeoffs: z.array(z.string()),
  tradeoffSource: z.enum(["heuristic", "ai"]),
  whyNot: WhyNotExplanationSchema.optional(),
});
export type EnhancedAlternative = z.infer<typeof EnhancedAlternativeSchema>;

export const EnhancedBlueprintResponseSchema = z.object({
  idea: z.string(),
  recommendedStack: z.object({
    toolIds: z.array(z.string()),
    tools: z.array(ToolSchema),
    harmonyScore: z.number(),
    diagnostics: z.array(DiagnosticSchema),
    rationale: z.string(),
    explanationSource: z.enum(["heuristic", "ai"]),
    keyReasons: z.array(z.string()).optional(),
    confidence: z.number().min(0).max(1).optional(),
  }),
  alternatives: z.array(EnhancedAlternativeSchema),
  risks: z.array(z.string()),
  costEstimate: BlueprintCostEstimateSchema,
  roadmap: ImplementationRoadmapSchema.optional(),
  files: z.array(ExportFileSchema),
  export: ExportDataSchema,
});
export type EnhancedBlueprintResponse = z.infer<typeof EnhancedBlueprintResponseSchema>;

