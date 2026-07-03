# Graph Report - H:\Stackfast-2026  (2026-07-03)

## Corpus Check
- 211 files · ~118,390 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1454 nodes · 2593 edges · 99 communities (86 shown, 13 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 33 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Web Visualization Components|Web Visualization Components]]
- [[_COMMUNITY_Domain Schemas|Domain Schemas]]
- [[_COMMUNITY_API Contract Tests|API Contract Tests]]
- [[_COMMUNITY_Web App Shell|Web App Shell]]
- [[_COMMUNITY_Recipe Matching|Recipe Matching]]
- [[_COMMUNITY_API Blueprint Routes|API Blueprint Routes]]
- [[_COMMUNITY_Export Generator|Export Generator]]
- [[_COMMUNITY_Web Dependencies|Web Dependencies]]
- [[_COMMUNITY_Diagnostics Model|Diagnostics Model]]
- [[_COMMUNITY_Database Schema|Database Schema]]
- [[_COMMUNITY_API Dependencies|API Dependencies]]
- [[_COMMUNITY_Workspace Tooling|Workspace Tooling]]
- [[_COMMUNITY_Worker Evaluation|Worker Evaluation]]
- [[_COMMUNITY_Rules Engine|Rules Engine]]
- [[_COMMUNITY_Selection State|Selection State]]
- [[_COMMUNITY_Toast UI|Toast UI]]
- [[_COMMUNITY_Category Schema|Category Schema]]
- [[_COMMUNITY_Compatibility Score UI|Compatibility Score UI]]
- [[_COMMUNITY_Export Dialog UI|Export Dialog UI]]
- [[_COMMUNITY_Export State|Export State]]
- [[_COMMUNITY_Suggestions State|Suggestions State]]
- [[_COMMUNITY_AI Dependencies|AI Dependencies]]
- [[_COMMUNITY_Schema Dependencies|Schema Dependencies]]
- [[_COMMUNITY_Exporter Dependencies|Exporter Dependencies]]
- [[_COMMUNITY_Registry Validation|Registry Validation]]
- [[_COMMUNITY_Database Seeding|Database Seeding]]
- [[_COMMUNITY_Error Boundary|Error Boundary]]
- [[_COMMUNITY_API Package Dependencies|API Package Dependencies]]
- [[_COMMUNITY_Shadcn Components Config|Shadcn Components Config]]
- [[_COMMUNITY_Rules Package Dependencies|Rules Package Dependencies]]
- [[_COMMUNITY_Migration CLI|Migration CLI]]
- [[_COMMUNITY_Smoke Tests|Smoke Tests]]
- [[_COMMUNITY_Product Navigation|Product Navigation]]
- [[_COMMUNITY_Rule Schemas|Rule Schemas]]
- [[_COMMUNITY_Workspace Architecture|Workspace Architecture]]
- [[_COMMUNITY_Smart Suggestions|Smart Suggestions]]
- [[_COMMUNITY_Evaluation State|Evaluation State]]
- [[_COMMUNITY_Deployment Architecture|Deployment Architecture]]
- [[_COMMUNITY_Auth Service|Auth Service]]
- [[_COMMUNITY_Catalog Loader|Catalog Loader]]
- [[_COMMUNITY_Package Metadata|Package Metadata]]
- [[_COMMUNITY_Neon Postgres|Neon Postgres]]
- [[_COMMUNITY_API Client Types|API Client Types]]
- [[_COMMUNITY_Web TSConfig|Web TSConfig]]
- [[_COMMUNITY_Backlog Integration|Backlog Integration]]
- [[_COMMUNITY_Category Section UI|Category Section UI]]
- [[_COMMUNITY_Production Auth Flow|Production Auth Flow]]
- [[_COMMUNITY_AI Provider Strategy|AI Provider Strategy]]
- [[_COMMUNITY_Base TSConfig|Base TSConfig]]
- [[_COMMUNITY_CI Quality Gate|CI Quality Gate]]
- [[_COMMUNITY_Compatibility Heatmap|Compatibility Heatmap]]
- [[_COMMUNITY_Catalog Schemas|Catalog Schemas]]
- [[_COMMUNITY_Rollback Strategy|Rollback Strategy]]
- [[_COMMUNITY_Public API Surface|Public API Surface]]
- [[_COMMUNITY_Registry Manifest|Registry Manifest]]
- [[_COMMUNITY_Worker Protocol|Worker Protocol]]
- [[_COMMUNITY_Rate Limiting|Rate Limiting]]
- [[_COMMUNITY_Rules Manifest|Rules Manifest]]
- [[_COMMUNITY_Admin Security|Admin Security]]
- [[_COMMUNITY_Cleanup Salvage|Cleanup Salvage]]
- [[_COMMUNITY_Package TSConfig|Package TSConfig]]
- [[_COMMUNITY_Package TSConfig|Package TSConfig]]
- [[_COMMUNITY_Package TSConfig|Package TSConfig]]
- [[_COMMUNITY_Package TSConfig|Package TSConfig]]
- [[_COMMUNITY_Package TSConfig|Package TSConfig]]
- [[_COMMUNITY_Package TSConfig|Package TSConfig]]
- [[_COMMUNITY_Package TSConfig|Package TSConfig]]
- [[_COMMUNITY_Vite Asset|Vite Asset]]
- [[_COMMUNITY_Sentry Observability|Sentry Observability]]
- [[_COMMUNITY_Agent Governance|Agent Governance]]
- [[_COMMUNITY_Drizzle Client|Drizzle Client]]
- [[_COMMUNITY_HTML Security Metadata|HTML Security Metadata]]
- [[_COMMUNITY_Playwright Config|Playwright Config]]
- [[_COMMUNITY_Admin E2E Tests|Admin E2E Tests]]
- [[_COMMUNITY_Neon Migration|Neon Migration]]
- [[_COMMUNITY_Railway Topology|Railway Topology]]
- [[_COMMUNITY_Staging Isolation|Staging Isolation]]
- [[_COMMUNITY_Cutover Plan|Cutover Plan]]
- [[_COMMUNITY_Cross Origin E2E|Cross Origin E2E]]
- [[_COMMUNITY_Health E2E|Health E2E]]
- [[_COMMUNITY_Selections Hook|Selections Hook]]
- [[_COMMUNITY_Auth Client Exports|Auth Client Exports]]
- [[_COMMUNITY_README Deployment Docs|README Deployment Docs]]
- [[_COMMUNITY_Registry Expansion|Registry Expansion]]
- [[_COMMUNITY_Post MVP Roadmap|Post MVP Roadmap]]

## God Nodes (most connected - your core abstractions)
1. `Tool` - 50 edges
2. `Tool` - 39 edges
3. `Diagnostic` - 22 edges
4. `CategoryId` - 21 edges
5. `CatalogLoader` - 20 edges
6. `generateExport()` - 15 edges
7. `Diagnostic` - 15 edges
8. `ToolId` - 14 edges
9. `evaluateRulesSync()` - 13 edges
10. `Rule` - 13 edges

## Surprising Connections (you probably didn't know these)
- `Canonical API Surface` --semantically_similar_to--> `Public MVP API Surface`  [INFERRED] [semantically similar]
  Stackfast2026 implementation plan.md → readme.md
- `packages/* Workspace Package Pattern` --references--> `packages/registry Catalog Loading and Validation`  [INFERRED]
  pnpm-workspace.yaml → readme.md
- `Unified API Endpoints` --semantically_similar_to--> `Public MVP API Surface`  [INFERRED] [semantically similar]
  docs/backlog/INTEGRATION_PLAN.md → readme.md
- `Verification Plan` --semantically_similar_to--> `Testing and Quality Gate`  [INFERRED] [semantically similar]
  Stackfast2026 implementation plan.md → readme.md
- `AI-Assisted Architecture and Starter-Stack Copilot Product Vision` --semantically_similar_to--> `Explainable Stack Intelligence Platform`  [INFERRED] [semantically similar]
  ROADMAP.md → Stackfast2026.md

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Rebuild Execution Model** — agents_orchestrator, agents_cleanup_agent, agents_architect_agent, agents_engine_agent, agents_api_agent, agents_ui_agent, agents_qa_agent [EXTRACTED 1.00]
- **Phase 8 Operational Architecture** — kiro_specs_phase_8_deployment_design_railway_service_topology, kiro_specs_phase_8_deployment_design_cross_origin_cookie_flow, kiro_specs_phase_8_deployment_design_rate_limit_module, kiro_specs_phase_8_deployment_design_sentry_observability, kiro_specs_phase_8_deployment_design_migration_one_shot, kiro_specs_phase_8_deployment_design_deploy_smoke_script [EXTRACTED 1.00]
- **AI Explanation Fallback Chain** — docs_decisions_002_ai_provider_strategy_azure_openai_provider, docs_decisions_002_ai_provider_strategy_gemini_provider, docs_decisions_002_ai_provider_strategy_heuristic_provider, docs_decisions_002_ai_provider_strategy_fallback_explainer, docs_decisions_002_ai_provider_strategy_zod_validation [EXTRACTED 1.00]
- **Vite Logo Composition** — apps_web_public_vite_vite_logo, apps_web_public_vite_blue_purple_gradient, apps_web_public_vite_yellow_orange_gradient, apps_web_public_vite_yellow_lightning_bolt [INFERRED 0.85]

## Communities (99 total, 13 thin omitted)

### Community 0 - "Web Visualization Components"
Cohesion: 0.06
Nodes (55): AlternativesComparison(), AlternativesComparisonProps, ArchitecturePreview(), ArchitecturePreviewProps, BlueprintOutputCard(), CostEstimator(), CostEstimatorProps, ImplementationRoadmap() (+47 more)

### Community 1 - "Domain Schemas"
Cohesion: 0.03
Nodes (67): AppliedRecipe, AppliedRecipeSchema, BaseRuleSchema, BlueprintAlternative, BlueprintAlternativeSchema, BlueprintCostEstimateSchema, BlueprintResponse, BlueprintResponseSchema (+59 more)

### Community 2 - "API Contract Tests"
Cohesion: 0.07
Nodes (33): buildApp(), RequestableApp, BUCKET_NAMES, BucketConfig, BucketName, BUCKETS, HeaderLookup, readHeader() (+25 more)

### Community 3 - "Web App Shell"
Cohesion: 0.05
Nodes (39): App(), queryClient, AuthStatus(), Layout(), LayoutProps, useCatalog(), useCategories(), useCompatibility() (+31 more)

### Community 4 - "Recipe Matching"
Cohesion: 0.06
Nodes (34): getApplicableRecipes(), ExportError, suggestNearestCombination(), generateExport(), generateExportLog(), generateExportLogFile(), CATEGORY_ORDER, getMostRestrictiveVersion() (+26 more)

### Community 5 - "API Blueprint Routes"
Cohesion: 0.05
Nodes (37): aiProvider, app, Bindings, buildAlternatives(), catalogLoader, EnrichToolSchema, explainer, generateSafeExport() (+29 more)

### Community 6 - "Export Generator"
Cohesion: 0.07
Nodes (40): generateExport(), generateExportAsText(), generateExportLog(), suggestNearestCombination(), loader, CATEGORY_ORDER, mergeDocsLinks(), mergeEnvTargets() (+32 more)

### Community 7 - "Web Dependencies"
Cohesion: 0.04
Nodes (45): dependencies, better-auth, class-variance-authority, clsx, jszip, lucide-react, @radix-ui/react-collapsible, @radix-ui/react-dialog (+37 more)

### Community 8 - "Diagnostics Model"
Cohesion: 0.10
Nodes (34): DiagnosticCategory, DiagnosticCategorySchema, DiagnosticCTA, DiagnosticCTASchema, DiagnosticLevel, DiagnosticLevelSchema, DiagnosticSchema, isDiagnostic() (+26 more)

### Community 9 - "Database Schema"
Cohesion: 0.05
Nodes (38): account, compatibilities, compatibilitiesRelations, CompatibilityMatrix, CompatibilityRecord, InsertCompatibility, insertCompatibilitySchema, InsertMigrationPath (+30 more)

### Community 10 - "API Dependencies"
Cohesion: 0.06
Nodes (34): dependencies, better-auth, drizzle-orm, hono, @hono/node-server, @neondatabase/serverless, @sentry/node, @stackfast/ai (+26 more)

### Community 11 - "Workspace Tooling"
Cohesion: 0.06
Nodes (31): dependencies, @better-auth/infra, devDependencies, concurrently, dotenv-cli, eslint, @eslint/js, @playwright/test (+23 more)

### Community 12 - "Worker Evaluation"
Cohesion: 0.15
Nodes (19): evaluateRulesWithFallback(), getWorker(), terminateWorker(), evaluateCapabilityCompat(), evaluateCategoryCoverage(), evaluateHardConflict(), evaluateMutualExclusiveCategory(), evaluateRequiresTool() (+11 more)

### Community 13 - "Rules Engine"
Cohesion: 0.14
Nodes (22): evaluateCapabilityCompat(), evaluateCategoryCoverage(), evaluateHardConflict(), evaluateMutualExclusiveCategory(), evaluateRequiresTool(), evaluateRulesSync(), evaluateSynergy(), hasTool() (+14 more)

### Community 14 - "Selection State"
Cohesion: 0.15
Nodes (16): SelectionsContext, SelectionsContextValue, SelectionsProviderProps, SelectionsState, recipes, nextjsBaseRecipe, nextjsClerkRecipe, nextjsPrismaPostgresRecipe (+8 more)

### Community 15 - "Toast UI"
Cohesion: 0.13
Nodes (21): Toast, ToastAction, ToastActionElement, ToastClose, ToastDescription, ToastProps, ToastTitle, toastVariants (+13 more)

### Community 16 - "Category Schema"
Cohesion: 0.10
Nodes (20): Cardinality, CardinalitySchema, CategoryIdSchema, CategorySchema, isCategoryId(), isSuggestion(), SuggestionAction, SuggestionActionSchema (+12 more)

### Community 17 - "Compatibility Score UI"
Cohesion: 0.16
Nodes (17): CompatibilityScore(), CompatibilityScoreProps, getScoreBarColor(), getScoreColor(), getScoreLabel(), getScoreTextColor(), DiagnosticItem(), DiagnosticList() (+9 more)

### Community 18 - "Export Dialog UI"
Cohesion: 0.17
Nodes (15): errorMessage(), ExportDialog(), Badge(), BadgeProps, badgeVariants, DialogContent, DialogDescription, DialogFooter() (+7 more)

### Community 19 - "Export State"
Cohesion: 0.17
Nodes (15): ExportContext, ExportContextValue, ExportProvider(), ExportProviderProps, ExportState, useExportContext(), useExport(), UseExportResult (+7 more)

### Community 20 - "Suggestions State"
Cohesion: 0.13
Nodes (15): SuggestionsContext, SuggestionsContextValue, SuggestionsProvider(), SuggestionsProviderProps, useSuggestionsContext(), authDatabaseToPaymentsRule, databaseToOrmRule, frontendToDatabaseRule (+7 more)

### Community 21 - "AI Dependencies"
Cohesion: 0.10
Nodes (19): dependencies, ai, @ai-sdk/azure, @ai-sdk/google, @stackfast/schemas, @stackfast/shared, zod, devDependencies (+11 more)

### Community 22 - "Schema Dependencies"
Cohesion: 0.10
Nodes (19): dependencies, drizzle-orm, drizzle-zod, zod, devDependencies, @types/node, typescript, exports (+11 more)

### Community 23 - "Exporter Dependencies"
Cohesion: 0.11
Nodes (18): dependencies, @stackfast/schemas, @stackfast/shared, zod, devDependencies, tsx, typescript, main (+10 more)

### Community 24 - "Registry Validation"
Cohesion: 0.16
Nodes (12): CatalogValidationError, CatalogValidationResult, CategoryArraySchema, collectDuplicateIds(), defaultCatalog, enrichToolMetadata(), loadDefaultCatalog(), RuleArraySchema (+4 more)

### Community 25 - "Database Seeding"
Cohesion: 0.16
Nodes (5): CatalogData, CatalogLoader, Catalog, Category, Rule

### Community 26 - "Error Boundary"
Cohesion: 0.14
Nodes (10): ErrorBoundary, ErrorBoundaryProps, ErrorBoundaryState, Button, ButtonProps, buttonVariants, SelectionsProvider(), useStackBuilderCatalog() (+2 more)

### Community 27 - "API Package Dependencies"
Cohesion: 0.11
Nodes (17): dependencies, @stackfast/registry, @stackfast/rules-engine, @stackfast/schemas, @stackfast/shared, devDependencies, typescript, main (+9 more)

### Community 28 - "Shadcn Components Config"
Cohesion: 0.12
Nodes (16): aliases, components, hooks, lib, ui, utils, rsc, $schema (+8 more)

### Community 29 - "Rules Package Dependencies"
Cohesion: 0.12
Nodes (16): dependencies, @stackfast/registry, @stackfast/schemas, @stackfast/shared, devDependencies, typescript, main, name (+8 more)

### Community 30 - "Migration CLI"
Cohesion: 0.21
Nodes (13): CliArgs, ConnectionTarget, errorLog(), log(), main(), parseArgs(), probeOnce(), REPO_ROOT (+5 more)

### Community 31 - "Smoke Tests"
Cohesion: 0.24
Nodes (16): AssertionResult, burst(), checkAdmin401(), checkCorsEvilOrigin(), checkCorsSameOrigin(), checkGenerationBurst(), checkHealth(), checkReadBurst() (+8 more)

### Community 32 - "Product Navigation"
Cohesion: 0.20
Nodes (16): Engine Agent, UI Agent, Compatibility-Aware Search, Migration Paths, apps/web React Vite Web App, Monorepo Architecture, packages/exporter Scaffold Generation, packages/registry Catalog Loading and Validation (+8 more)

### Community 33 - "Rule Schemas"
Cohesion: 0.19
Nodes (15): BaseRule, BaseRuleSchema, CapabilityCompatRule, CapabilityCompatRuleSchema, CategoryCoverageRuleSchema, HardConflictRule, HardConflictRuleSchema, isRule() (+7 more)

### Community 34 - "Workspace Architecture"
Cohesion: 0.15
Nodes (14): Architect Agent, Package Dependency Graph, apps/* Workspace Package Pattern, packages/* Workspace Package Pattern, pnpm Workspaces, apps/api Hono API Server, Phase 1 Monorepo Scaffold, Root App Salvage Sources (+6 more)

### Community 35 - "Smart Suggestions"
Cohesion: 0.26
Nodes (11): ScoreBreakdown, getPriorityLabel(), getPriorityVariant(), SmartSuggestion(), SmartSuggestionProps, StackBuilder(), Toaster(), useSelectionsContext() (+3 more)

### Community 36 - "Evaluation State"
Cohesion: 0.29
Nodes (11): EvaluationContext, EvaluationContextValue, EvaluationProvider(), EvaluationProviderProps, EvaluationState, useEvaluationContext(), buildEvaluationResultFromApi(), diagnosticsFromApiResponse() (+3 more)

### Community 37 - "Deployment Architecture"
Cohesion: 0.18
Nodes (14): ADR-003 Deployment Architecture, Railway Secrets and Configuration, Sentry Feature Flag, Split Web and API Railway Services, Phase 8 Deployment Design, Phase 8 Requirements, Batch E Env Example and README, Task Dependency Graph (+6 more)

### Community 38 - "Auth Service"
Cohesion: 0.24
Nodes (11): isDatabaseAvailable(), AuthBindings, AuthVariables, buildAuthOptions(), canBypassAuthForLocalDev(), createAuth(), getAuth(), isProduction() (+3 more)

### Community 39 - "Catalog Loader"
Cohesion: 0.23
Nodes (12): CachedCatalog, getCachedCatalog(), hasCachedCatalog(), loadCatalog(), loadCatalogFile(), loadManifest(), Manifest, ManifestSchema (+4 more)

### Community 40 - "Package Metadata"
Cohesion: 0.15
Nodes (12): devDependencies, typescript, main, name, private, scripts, lint, test (+4 more)

### Community 41 - "Neon Postgres"
Cohesion: 0.18
Nodes (12): Neon Branching, Neon Connection Pooling, Neon Documentation Source of Truth, Neon Auth, Neon Serverless Postgres, Neon Scale to Zero, Neon Serverless Driver, Auth Data Ownership (+4 more)

### Community 42 - "API Client Types"
Cohesion: 0.17
Nodes (9): BlueprintOutputCardProps, ApiError, ApiErrorData, BlueprintRequest, CompatibilityResponse, EnhancedBlueprintResponse, MigrationResponse, ScaffoldResponse (+1 more)

### Community 43 - "Web TSConfig"
Cohesion: 0.17
Nodes (11): compilerOptions, allowImportingTsExtensions, jsx, lib, moduleResolution, noEmit, paths, types (+3 more)

### Community 44 - "Backlog Integration"
Cohesion: 0.17
Nodes (12): PostgreSQL and Firestore Database Strategy, Historical Integration Plan, Tool Profile Unification, Worker Enrichment Pipeline, Internal-Only WebAILyzer Service, Orphaned WebAILyzer Submodule Gitlink, WebAILyzer Pre-Integration Checklist, WebAILyzer Deferred (+4 more)

### Community 45 - "Category Section UI"
Cohesion: 0.33
Nodes (8): CategorySection(), CategorySectionProps, ExportDialogProps, formatDate(), isDataStale(), ToolSelector(), ToolSelectorProps, TooltipContent

### Community 46 - "Production Auth Flow"
Cohesion: 0.18
Nodes (11): GitHub OAuth, Cookie and CORS Strategy, Production Auth Fail-Closed Guard, Cross-Origin Cookie Round Trip, Deploy Smoke Script, Requirement 11 Auth Fails Closed in Production, Requirement 3 Better Auth GitHub OAuth in Production, Requirement 10 CORS and Cross-Origin Policy (+3 more)

### Community 47 - "AI Provider Strategy"
Cohesion: 0.22
Nodes (11): ADR-002 AI Provider Strategy, Azure OpenAI Provider, BlueprintExplainer Interface, FallbackExplainer, Gemini AI Provider, Heuristic AI Provider, AI Response Zod Validation, Failure Modes and Fail-Open Fail-Closed Matrix (+3 more)

### Community 48 - "Base TSConfig"
Cohesion: 0.18
Nodes (10): compilerOptions, esModuleInterop, forceConsistentCasingInFileNames, isolatedModules, module, moduleResolution, resolveJsonModule, skipLibCheck (+2 more)

### Community 49 - "CI Quality Gate"
Cohesion: 0.20
Nodes (10): QA Agent, CI Workflow, Playwright E2E Step, Type Check Lint Build Test Steps, Validate Registry Step, validate Job, Batch I Post-Deploy Cleanup, Phase 7 Quality Gate (+2 more)

### Community 50 - "Compatibility Heatmap"
Cohesion: 0.28
Nodes (6): CompatibilityHeatmap(), CompatibilityHeatmapProps, HeatmapCell, HeatmapCellView(), scoreToClass(), CategoryId

### Community 51 - "Catalog Schemas"
Cohesion: 0.31
Nodes (8): StackBuilderProps, Catalog, CatalogManifest, CatalogManifestSchema, isCatalogManifest(), Category, Rule, EvaluatePayload

### Community 52 - "Rollback Strategy"
Cohesion: 0.25
Nodes (9): Deployment Rollback Strategy, Requirement 12 Rollback Procedure, Manual Forward-Migration Intervention, Rollback Runbook, Schema Compatibility Gate, Post-Rollback Smoke Test Verification, stackfast-api Rollback, stackfast-web Rollback (+1 more)

### Community 53 - "Public API Surface"
Cohesion: 0.32
Nodes (8): API Agent, Unified API Endpoints, Public MVP API Surface, Testing and Quality Gate, Stackfast 2026, Phase 3 Clean API Surface, Canonical API Surface, Verification Plan

### Community 54 - "Registry Manifest"
Cohesion: 0.25
Nodes (7): etag, files, categories, rules, tools, updatedAt, version

### Community 55 - "Worker Protocol"
Cohesion: 0.32
Nodes (7): EvaluatePayloadSchema, EvaluationResultSchema, isWorkerReq(), isWorkerRes(), ScoreBreakdownSchema, WorkerReqSchema, WorkerResSchema

### Community 56 - "Rate Limiting"
Cohesion: 0.36
Nodes (8): Upstash Redis Rate Limiting, Memory Rate Limit Backend, RateLimitBackend Interface, apps/api Rate Limit Module, Rate Limiter Migration Plan, Upstash Rate Limit Backend, Requirement 4 Upstash Redis Rate Limiter, Batch A Rate Limiter Module

### Community 57 - "Rules Manifest"
Cohesion: 0.25
Nodes (7): etag, files, categories, rules, tools, updatedAt, version

### Community 58 - "Admin Security"
Cohesion: 0.29
Nodes (7): Admin API Key Protection, ADR-001 Authentication Strategy, Stack Auth via Neon Auth, SSRF Hardening Requirement, Requirement 8 Admin API Key Enforcement, Admin-Only Mutations Rule, Public Mutation Routes Risk

### Community 59 - "Cleanup Salvage"
Cohesion: 0.33
Nodes (6): Cleanup Agent, Phase 0 Freeze and Preserve, Salvage Manifest, Branches/StackfastPro Primary Base, WebAILyzer Deferred Preservation, Branches/StackfastPro Candidate

### Community 60 - "Package TSConfig"
Cohesion: 0.33
Nodes (5): compilerOptions, outDir, rootDir, extends, include

### Community 61 - "Package TSConfig"
Cohesion: 0.33
Nodes (5): compilerOptions, outDir, rootDir, extends, include

### Community 62 - "Package TSConfig"
Cohesion: 0.33
Nodes (5): compilerOptions, outDir, rootDir, extends, include

### Community 63 - "Package TSConfig"
Cohesion: 0.33
Nodes (5): compilerOptions, outDir, rootDir, extends, include

### Community 64 - "Package TSConfig"
Cohesion: 0.33
Nodes (5): compilerOptions, outDir, rootDir, extends, include

### Community 65 - "Package TSConfig"
Cohesion: 0.33
Nodes (5): compilerOptions, outDir, rootDir, extends, include

### Community 66 - "Package TSConfig"
Cohesion: 0.33
Nodes (5): compilerOptions, outDir, rootDir, extends, include

### Community 67 - "Vite Asset"
Cohesion: 0.40
Nodes (5): Blue Purple Gradient, Iconify Logo Asset, Vite Logo, Yellow Lightning Bolt, Yellow Orange Gradient

### Community 68 - "Sentry Observability"
Cohesion: 0.40
Nodes (5): Rate Limit Fail-Open Wrapper, Phase 8 Property-Based Tests, Sentry Observability Wiring, Requirement 7 Sentry Feature-Flagged Error Tracking, Batch B Sentry Wiring

### Community 69 - "Agent Governance"
Cohesion: 0.50
Nodes (4): Agent Workflow Specification, Agent Handoff Protocol, Orchestrator, Phase Gate Criteria

### Community 70 - "Drizzle Client"
Cohesion: 0.67
Nodes (3): createDrizzle(), Db, getDb()

### Community 71 - "HTML Security Metadata"
Cohesion: 0.50
Nodes (4): Content Security Policy, Security Meta Headers, SEO Metadata, StackFast Web HTML Entry

## Knowledge Gaps
- **541 isolated node(s):** `name`, `version`, `private`, `type`, `dev` (+536 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **13 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `useToast()` connect `Smart Suggestions` to `Web Dependencies`, `Toast UI`?**
  _High betweenness centrality (0.049) - this node is a cross-community bridge._
- **Why does `react` connect `Web Dependencies` to `Smart Suggestions`?**
  _High betweenness centrality (0.048) - this node is a cross-community bridge._
- **What connects `name`, `version`, `private` to the rest of the system?**
  _547 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Web Visualization Components` be split into smaller, more focused modules?**
  _Cohesion score 0.05709507883420927 - nodes in this community are weakly interconnected._
- **Should `Domain Schemas` be split into smaller, more focused modules?**
  _Cohesion score 0.029411764705882353 - nodes in this community are weakly interconnected._
- **Should `API Contract Tests` be split into smaller, more focused modules?**
  _Cohesion score 0.07291666666666667 - nodes in this community are weakly interconnected._
- **Should `Web App Shell` be split into smaller, more focused modules?**
  _Cohesion score 0.0546448087431694 - nodes in this community are weakly interconnected._