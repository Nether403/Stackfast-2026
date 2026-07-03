# Stackfast 2026 Graph Trace Report

Generated: 2026-07-03

Scope: `H:\Stackfast-2026`

## Run Summary

- Corpus: 211 supported files, approximately 118,390 words.
- Skipped sensitive files: 1 file skipped by graphify detection; file name intentionally not listed.
- Graph: 1,454 nodes, 2,593 post-build edges, 99 communities.
- Extraction mix: 99% EXTRACTED, 1% INFERRED, 0% AMBIGUOUS.
- Token cost recorded by graphify: 0 input, 0 output.
- Note: semantic extraction was performed through host subagents, but the task runner did not expose usage metadata back into graphify chunk JSON, so the graphify cost tracker records zero.

## Outputs

- `graphify-out/graph.html`: interactive graph visualization.
- `graphify-out/graph.json`: GraphRAG-ready graph data.
- `graphify-out/GRAPH_REPORT.md`: graphify's plain-language audit report.
- `graphify-out/GRAPH_TRACE_REPORT.md`: this synthesized trace report.
- `graphify-out/queries/q01-use-toast.txt`: raw traversal for `useToast()` bridge.
- `graphify-out/queries/q02-react-bridge.txt`: raw traversal for `react` bridge.
- `graphify-out/queries/q03-package-metadata.txt`: raw traversal for package metadata weak nodes.
- `graphify-out/queries/q04-web-visualization-split.txt`: raw traversal for Web Visualization split question.
- `graphify-out/queries/q05-domain-schemas-split.txt`: raw traversal for Domain Schemas split question.
- `graphify-out/queries/q06-api-contract-tests-split.txt`: raw traversal for API Contract Tests split question.
- `graphify-out/queries/q07-web-app-shell-split.txt`: raw traversal for Web App Shell split question.

## Integrity Notes

Graph health warning from the read-only diagnostic:

- 485 dangling-endpoint edges.
- 74 collapsed directed edges.
- 77 collapsed undirected edges.
- Same-endpoint groups were mostly import/re-export variants, especially index barrel files such as `apps/api/src/rate-limit/index.ts` and `apps/web/src/components/index.ts`.

Interpretation: the graph is usable for navigation and architecture discovery, but not perfect as a precise dependency graph. Treat findings as directional until dangling endpoints are reduced in a future rebuild or graphify extraction pass.

## Core Map

The highest-degree abstractions are the project's real integration points:

- `Tool`: appears as the central schema/data abstraction across registry, rules, exporter, API, UI, and AI flows.
- `Diagnostic`: bridges rules-engine output, UI rendering, API responses, and export/blueprint explanation paths.
- `CategoryId`, `ToolId`, and `Rule`: define the compatibility and selection vocabulary.
- `CatalogLoader`: anchors registry loading, validation, seeding, and downstream API use.
- `generateExport()`: anchors scaffold generation and recipe/export behavior.
- `evaluateRulesSync()`: anchors rules-engine scoring and deterministic evaluation.

The strongest functional regions are:

- Core engine: `Domain Schemas`, `Rules Engine`, `Export Generator`, `Recipe Matching`, `Registry Validation`, `Catalog Loader`, and `Database Schema`.
- API and operations: `API Blueprint Routes`, `Public API Surface`, `API Contract Tests`, `Rate Limiting`, `Auth Service`, `Deployment Architecture`, `Production Auth Flow`, `Admin Security`, and `Rollback Strategy`.
- Web UI: `Web App Shell`, `Web Visualization Components`, `Smart Suggestions`, `Toast UI`, `Compatibility Score UI`, `Export Dialog UI`, and state contexts.
- Planning/docs: `Agent Governance`, `Workspace Architecture`, `Cleanup Salvage`, `Backlog Integration`, `Neon Postgres`, and ADR communities.

## Traced Questions

### 1. Why does `useToast()` connect Smart Suggestions to Web Dependencies and Toast UI?

Raw trace: `graphify-out/queries/q01-use-toast.txt`

Answer: `useToast()` is a legitimate UI bridge, not an accidental domain dependency. The traversal starts at `useToast()` in `apps/web/src/hooks/use-toast.ts:L172`, then crosses `Smart Suggestions`, `Toast UI`, and `Web Dependencies` through React UI wiring.

Evidence:

- `useToast()` lives in `apps/web/src/hooks/use-toast.ts:L172`.
- Toast implementation nodes live in `apps/web/src/hooks/use-toast.ts`, `apps/web/src/components/ui/toast.tsx`, and `apps/web/src/components/ui/toaster.tsx`.
- Smart suggestion nodes include `apps/web/src/components/SmartSuggestion.tsx:L1`, `SmartSuggestion()` at `L25`, `getPriorityVariant()` at `L152`, and `getPriorityLabel()` at `L166`.
- `react` appears as a package dependency in `apps/web/package.json:L32`, and the graph sees a reference edge from `react` to `useToast()`.

Conclusion: this bridge is expected. It means the suggestion UI can surface feedback through the toast system. The only risk is that toast feedback can become a hidden global UI channel if every feature uses it without a UX pattern.

Recommendation: document toast usage as a UI feedback primitive and keep business/rules logic out of `use-toast.ts`.

### 2. Why does `react` connect Web Dependencies to Smart Suggestions?

Raw trace: `graphify-out/queries/q02-react-bridge.txt`

Answer: this is a package-level dependency bridge, not a business-domain bridge. `react` is part of `apps/web/package.json:L32`; Smart Suggestions and the toast hook are React components/hooks, so they naturally connect through the dependency node.

Evidence:

- `react` is in `apps/web/package.json:L32`.
- `SmartSuggestion.tsx` is in `apps/web/src/components/SmartSuggestion.tsx:L1`.
- `StackBuilder.tsx` is in `apps/web/src/components/StackBuilder.tsx:L1` and `StackBuilder()` at `L38`.
- `useToast()` is in `apps/web/src/hooks/use-toast.ts:L172`.

Conclusion: this bridge is low concern. It is mostly an artifact of including `package.json` dependency nodes in the graph.

Recommendation: if future graph runs should focus on architecture rather than package metadata, filter or down-rank package manifest fields during analysis.

### 3. What connects `name`, `version`, and `private` to the rest of the system?

Raw trace: `graphify-out/queries/q03-package-metadata.txt`

Answer: these nodes are structural package manifest fields, connected only through `package.json` documents.

Evidence:

- Root package metadata appears in `package.json:L1-L7`.
- API package metadata appears in `apps/api/package.json:L1-L5`.
- Web package metadata appears in `apps/web/package.json:L1-L5`.
- Their primary neighbors are `package.json`, `scripts`, `dependencies`, `devDependencies`, `engines`, and `packageManager`.

Conclusion: these are not architecture gaps. They are weakly connected because manifest scalar fields are not concepts or modules.

Recommendation: treat these as benign noise. If the goal is a cleaner knowledge graph, configure a later graph pass to suppress low-value scalar manifest nodes such as `name`, `version`, `private`, and `type`.

### 4. Should Web Visualization Components be split into smaller modules?

Raw trace: `graphify-out/queries/q04-web-visualization-split.txt`

Direct graph analysis says: yes conceptually, but the community label is misleading. This community combines blueprint UI components with AI provider contracts and shared schema nodes because they all touch blueprint/diagnostic/tool concepts.

Metrics:

- Size: 92 nodes.
- Cohesion: 0.05709507883420927.
- Internal edges: 239.
- External edges: 58.
- Top source files by node count: `packages/ai/src/index.ts`, `packages/ai/src/providers/azure-openai.ts`, `packages/ai/src/providers/gemini.ts`, `packages/ai/src/schemas.ts`, `packages/ai/src/types.ts`.
- Top bridge nodes: `Tool`, `Diagnostic`, `index.ts`, `BlueprintOutputCard.tsx`, and AI provider modules.

Interpretation: this is not purely a UI component cluster. It is a cross-cutting blueprint/explanation cluster spanning `packages/ai`, `packages/schemas`, and `apps/web` output components.

Recommendation:

- Keep UI presentation files separate from AI provider contracts.
- Make the seam explicit: `packages/schemas` owns blueprint shape, `packages/ai` owns explanation generation, and `apps/web` owns rendering.
- Consider adding a short architecture doc for the blueprint pipeline so graphify does not need to infer this cross-layer relationship from imports alone.

### 5. Should Domain Schemas be split into smaller modules?

Raw trace: `graphify-out/queries/q05-domain-schemas-split.txt`

Answer: yes. This is the strongest split signal in the graph.

Metrics:

- Size: 68 nodes.
- Cohesion: 0.029411764705882353.
- Source concentration: all 68 nodes are in `packages/schemas/src/domain.ts`.
- `domain.ts` has degree 109.
- External communities: `Rules Engine`, `Web Visualization Components`, `API Client Types`, `Export Generator`, `API Blueprint Routes`, and `Database Seeding`.

Interpretation: `domain.ts` is a schema mega-module. It is doing too much because it holds tool schemas, category schemas, rule schemas, recipe/export schemas, diagnostics, blueprint response schemas, and AI-adjacent output types.

Recommendation:

- Split `packages/schemas/src/domain.ts` by domain boundary.
- Candidate files: `tool.ts`, `category.ts`, `rule.ts`, `diagnostic.ts`, `recipe.ts`, `blueprint.ts`, `api.ts`, and `database.ts` if needed.
- Keep `packages/schemas/src/index.ts` as the public barrel export so downstream imports do not churn unnecessarily.
- After splitting, rerun graphify and expect this community to divide into smaller, higher-cohesion schema communities.

### 6. Should API Contract Tests be split into smaller modules?

Raw trace: `graphify-out/queries/q06-api-contract-tests-split.txt`

Answer: probably yes, but the community is really a rate-limiting plus app-test cluster.

Metrics:

- Size: 64 nodes.
- Cohesion: 0.07291666666666667.
- Internal edges: 147.
- External edges: 8.
- Top files: `apps/api/src/rate-limit/upstash.ts`, `apps/api/src/rate-limit/index.ts`, `apps/api/src/rate-limit/buckets.ts`, `apps/api/src/rate-limit/fail-open.ts`, `apps/api/src/rate-limit/fail-open.test.ts`, `apps/api/src/app.test.ts`, and `apps/api/src/app.pbt.test.ts`.
- External links mostly go to `API Blueprint Routes` through app construction and middleware integration.

Interpretation: app-level API tests import rate-limit internals heavily enough that graphify grouped tests with implementation modules. That can be fine for focused middleware tests, but it weakens contract-test clarity.

Recommendation:

- Keep low-level rate-limit tests beside `apps/api/src/rate-limit/*`.
- Keep endpoint contract tests focused on request/response behavior and avoid depending directly on rate-limit backend internals where possible.
- If internal reset hooks are needed, expose a small test harness instead of importing many implementation details into app-level tests.

### 7. Should Web App Shell be split into smaller modules?

Raw trace: `graphify-out/queries/q07-web-app-shell-split.txt`

Answer: yes at the feature-boundary level, not necessarily at the shell-file level.

Metrics:

- Size: 61 nodes.
- Cohesion: 0.0546448087431694.
- Internal edges: 100.
- External edges: 34.
- Top files: `apps/web/src/pages/BlueprintBuilder.tsx`, `apps/web/src/hooks/useApi.ts`, `apps/web/src/pages/CompatibilityView.tsx`, `apps/web/src/lib/sentry.ts`, and `apps/web/src/App.tsx`.
- External communities: `Error Boundary`, `API Client Types`, `Web Visualization Components`, `Export Dialog UI`, `Export State`, and `Compatibility Heatmap`.

Interpretation: `App.tsx` and route pages are acting as a broad integration surface. The graph also shows `useApi.ts` as a cross-feature bridge, which is expected but worth controlling.

Recommendation:

- Preserve `App.tsx` as routing/shell only.
- Move route-specific API composition closer to the route or into feature hooks.
- Consider feature directories for blueprint builder, compatibility view, migration explorer, and catalog pages.
- Keep shared API client types in `apps/web/src/lib/api-client.ts` or a shared package, but avoid allowing `useApi.ts` to become a catch-all feature service.

## Additional Cross-Cutting Findings

### Deployment, Auth, Rate Limiting, and Rollback Are Properly Linked

The deployment communities connect across docs and implementation planning:

- `ADR-003 Deployment Architecture` bridges rollback, CI quality, production auth flow, and Neon Postgres.
- `Production Auth Flow` connects GitHub OAuth, CORS, cross-origin cookies, fail-closed production auth, deploy smoke checks, and admin security.
- `Rate Limiting` connects Upstash Redis, memory fallback, fail-open behavior, and Sentry observability.
- `Admin Security` connects ADR-001, admin API key protection, SSRF hardening, and historical public mutation route risks.

This is a healthy graph signal: operational risks are documented across ADRs, requirements, task plans, and smoke tests.

### Public API Surface Is Consistent Across Planning Docs

The graph found semantic similarity among:

- `Canonical API Surface` from `Stackfast2026 implementation plan.md`.
- `Public MVP API Surface` from `readme.md`.
- `Unified API Endpoints` from `docs/backlog/INTEGRATION_PLAN.md`.

This suggests the intended API shape has remained consistent from backlog planning through README documentation.

### AI Provider Strategy Is Well-Seamed

The graph hyperedge `AI Explanation Fallback Chain` connects Azure OpenAI, Gemini, heuristic provider, fallback explainer, and Zod validation. This aligns with `docs/decisions/002-ai-provider-strategy.md` and indicates a clean provider abstraction.

The main concern is not provider design; it is the schema concentration in `packages/schemas/src/domain.ts` that all providers and UI outputs depend on.

## Prioritized Recommendations

1. Split `packages/schemas/src/domain.ts` into focused schema modules while preserving the public barrel export.
2. Add a short blueprint pipeline architecture note that explains the seam between schema shape, AI explanation generation, export generation, and UI rendering.
3. Separate app-level API contract tests from rate-limit implementation tests where the current tests import too many rate-limit internals.
4. Keep `App.tsx` as shell/routing only and move route-specific API orchestration into feature-level hooks or modules.
5. Treat package metadata nodes as graph noise; suppress or down-rank scalar manifest fields in future graph runs.
6. Rebuild graphify after the schema split and compare community cohesion for `Domain Schemas`, `Web Visualization Components`, and `Web App Shell`.
7. Investigate graph health warnings if graph precision matters for automated dependency analysis; dangling and collapsed edges mean this run is best used as an architecture map, not a strict call graph.

## Most Valuable Follow-Up Trace

The graph's most valuable architectural question is:

> Should `Domain Schemas` be split into smaller, more focused modules?

Reason: this question has the lowest cohesion score and points to a concrete code boundary (`packages/schemas/src/domain.ts`) with many downstream consumers across rules, exporter, API, AI, and UI. It is the clearest refactoring opportunity surfaced by the graph.
