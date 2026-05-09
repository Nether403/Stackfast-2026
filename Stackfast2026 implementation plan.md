Stackfast 2026 — Rebuild Implementation Plan
Goal: Transform Stackfast from a fragmented, multi-branch legacy codebase into a modern "idea-to-architecture and starter-stack copilot" — an explainable stack intelligence platform.

Executive Context
Based on the 
Stackfast2026.md
 audit, the current repository contains 5 branch variants, 3 duplicate APIs, stale docs, public mutation routes, and inconsistent endpoints. The strongest code lives in Branches/StackfastPro (clean rules engine, catalog, export system, tests) while the root app has the broadest feature set (blueprint builder, compatibility matrix, migration wizard) but is broken in several critical ways.

The rebuild strategy: Reset, don't rescue. Use StackfastPro as the foundation, selectively port the best ideas from root + StackFast-101, and ship a focused MVP.

User Review Required
WARNING

Destructive Cleanup — Phase 0 involves deleting Branches/StackFastold/, Branches/StackFast1/, developer-tools-api/, stale docs, and committed .env files. This is irreversible once pushed. Confirm you have external backups of anything you want to preserve.

Resolved Decisions
Decision	Resolution	Rationale
Auth	Neon Auth (Better Auth) + GitHub OAuth	Neon Auth has dramatically improved — built on Better Auth, stores auth data in your Neon Postgres, supports GitHub OAuth natively via Neon Console. Zero new platforms. Fits developer target audience perfectly.
Database	Neon Postgres	Already proven, serverless, branching for dev/staging
Registry size	80 tools for MVP	Sweet spot between "useful enough to trust" and MVP curation overhead. Expand to 200+ post-MVP.
WebAILyzer	Deferred to post-MVP	Requires SSRF hardening, Go service in a TypeScript monorepo adds operational complexity, no user-facing feature depends on it for MVP. Code preserved in workers/webailyzer/ for later integration.
Deployment	Railway (full-stack)	Web + API + Neon Postgres all on Railway. Fits project scope and simplifies ops.
Target Architecture
stackfast/
├── apps/
│   ├── web/                    # Vite + React + TypeScript (from StackfastPro)
│   └── api/                    # Hono + TypeScript (new, clean API layer)
├── packages/
│   ├── registry/               # Static JSON catalog + validation (from StackfastPro/public/catalog)
│   ├── rules-engine/           # Rules evaluation + scoring (from StackfastPro/src/engine)
│   ├── schemas/                # Shared Zod schemas (from StackFast-101 pattern + root schema.ts)
│   ├── exporter/               # Recipe-based scaffold generation (from StackfastPro/src/lib)
│   ├── ai/                     # LLM provider abstraction for blueprint explanation
│   └── shared/                 # Common types, utils, constants
├── workers/
│   └── webailyzer/             # DEFERRED: URL tech detection (preserved for post-MVP)
├── docs/
│   ├── architecture/           # ADRs, system diagrams
│   ├── api/                    # OpenAPI spec, endpoint docs
│   └── decisions/              # Architecture Decision Records
├── scripts/
│   ├── seed.ts                 # Local dev seed data
│   ├── import-tools.ts         # Admin-only tool import
│   └── recompute-compat.ts     # Admin-only compatibility recompute
├── .github/
│   └── workflows/
│       ├── ci.yml              # Type check, lint, test, registry validation
│       └── deploy.yml          # Production deployment
├── package.json                # Workspace root (pnpm workspaces)
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── .env.example
└── README.md
Tech Stack
Layer	Technology	Rationale
Monorepo	pnpm workspaces	Lightweight, fast, proven for TypeScript monorepos
Web	React 18, Vite 6, TypeScript 5.6+, TanStack Router	Matches StackfastPro's existing stack; Vite for speed
Styling	Tailwind CSS 4, Radix UI, shadcn/ui	Already used in both codebases; modern component primitives
API	Hono on Node.js	Lightweight, type-safe, fast — clean break from messy Express routes
Database	Neon Postgres + Drizzle ORM	Serverless, branching, proven in root app
Auth	Neon Auth (Better Auth) + GitHub OAuth	Auth data lives in Neon Postgres, branch-aware, RLS-compatible
Validation	Zod	Already used everywhere; shared between API and web
Registry	Versioned JSON (build-time validated) + Postgres mirror	Static files for speed, DB for admin/dynamic data
AI	Provider abstraction (OpenAI/Gemini/Anthropic)	Pluggable; LLM for explanation only, not source of truth
Testing	Vitest (packages), Playwright (E2E)	StackfastPro already uses Vitest; Playwright for flows
CI	GitHub Actions	Block merge on type errors, tests, lint, registry validation
Deployment	Railway	Web + API deployed together, Neon Postgres for DB
Proposed Changes
Phase 0 — Freeze & Preserve (Day 1)
What happens
Create archive/pre-rebuild branch as safety net
Record salvage manifest documenting exactly which files are kept from each source
Delete: Branches/StackFastold/, Branches/StackFast1/, developer-tools-api/, all desktop.ini, committed .env files, .local/, .vs/, stale docs
Keep: Branches/StackfastPro/, root server/services/, root shared/schema.ts, root client/src/pages/blueprint-builder.tsx + compatibility components (as reference)
Update .gitignore to exclude .env, .local, .vs, node_modules, dist, desktop.ini, *.log
Phase 1 — Monorepo Scaffold (Days 2-3)
[NEW] pnpm-workspace.yaml
Workspace configuration for apps and packages.

[NEW] tsconfig.base.json
Shared TypeScript config with strict mode, path aliases.

[NEW] apps/web/
Migrate StackfastPro into the web app workspace. Port src/, public/, index.html, vite.config.ts, tailwind.config.js.

[NEW] apps/api/
New Hono API server with clean route structure:

apps/api/
├── src/
│   ├── index.ts              # Server entry
│   ├── routes/
│   │   ├── blueprints.ts     # POST /api/v1/blueprints
│   │   ├── stacks.ts         # POST /api/v1/stacks/analyze
│   │   ├── tools.ts          # GET /api/v1/tools/search, /api/v1/tools/:id
│   │   ├── categories.ts     # GET /api/v1/categories
│   │   ├── compatibility.ts  # GET /api/v1/compatibility/:a/:b
│   │   ├── scaffolds.ts      # POST /api/v1/scaffolds
│   │   ├── migrations.ts     # GET /api/v1/migrations/:from/:to
│   │   └── admin.ts          # Admin-only protected routes
│   ├── middleware/
│   │   ├── auth.ts           # Neon Auth (Better Auth) + admin API key validation
│   │   ├── rate-limit.ts     # Rate limiting: 30 req/min for generation, 100 req/min for reads
│   │   └── error-handler.ts  # Zod error formatting
│   └── db/
│       ├── client.ts         # Drizzle + Postgres connection
│       ├── schema.ts         # (imports from packages/schemas)
│       └── seed.ts           # Dev seed data
├── package.json
└── tsconfig.json
[NEW] packages/schemas/
Shared Zod schemas extracted from root shared/schema.ts + StackFast-101 patterns.

[NEW] packages/shared/
Common types, constants, utility functions shared across all packages.

Phase 2 — Extract Core Engine (Days 4-6)
[NEW] packages/registry/
Migrate StackfastPro/public/catalog/v1/ (tools.json, rules.json, categories.json)
Add build-time JSON schema validation
Add lastVerified, sourceUrls, confidence, deprecated fields to tool entries
Add capability-based matching layer alongside categories
Normalize all tool IDs, category IDs, pricing fields
[NEW] packages/rules-engine/
Migrate StackfastPro/src/engine/ (rules-engine.ts, score-calculator.ts, worker-wrapper.ts, evaluate-with-fallback.ts)
Add deterministic test suite: same input → same score guarantee
Export pure functions usable from both web (worker) and API
[NEW] packages/exporter/
Migrate StackfastPro/src/lib/export-generator.ts, recipe-matcher.ts, archive-generator.ts
Migrate StackfastPro/src/data/recipes/
Normalize recipe format with Zod schemas
Add .env.example, setup guide, ADR generation to scaffold output
Phase 3 — Clean API Surface (Days 7-10)
Build the canonical API in apps/api/ with these endpoints:

Public Read + Generation:

Endpoint	Method	Purpose	Source Reference
/api/v1/blueprints	POST	Generate idea-to-stack blueprint	Root server/services/blueprint-generator.ts
/api/v1/stacks/analyze	POST	Validate tools, return score/conflicts/warnings	Root server/routes.ts:753-790
/api/v1/tools/search	GET	Search/filter tool registry	Root server/routes.ts:793-881
/api/v1/tools/:id	GET	Tool details	Root routes
/api/v1/categories	GET	Category metadata	Root server/routes.ts:942-958
/api/v1/compatibility/:a/:b	GET	Pairwise compatibility	Root server/routes.ts:705-746
/api/v1/scaffolds	POST	Generate downloadable starter files	StackfastPro exporter
/api/v1/migrations/:from/:to	GET	Migration path between tools	Root server/routes.ts:593-687
Admin-Only (API key protected):

Endpoint	Method	Purpose
/admin/tools/import	POST	Protected bulk import
/admin/compatibility/recompute	POST	Recompute compatibility scores
/internal/enrich-tool	POST	Refresh metadata from registries
Rules:

Public APIs are read-only except generation/analyze
All mutations require admin API key
All AI calls are server-side only
No URL fetches without SSRF protections
Phase 4 — Rebuild UI (Days 11-16)
[MODIFY] apps/web/ (StackfastPro base)
Keep: StackBuilder, ToolSelector, CategorySection, CompatibilityScore, DiagnosticList, ExportDialog, SmartSuggestion components
Port from root: Blueprint Builder page (after API contracts are clean)
Port from root: Compatibility heatmap + stack harmony visualization
Remove: Any UI buttons calling non-existent endpoints
Fix: Category queries → /api/v1/categories
Fix: Migration UI → canonical /api/v1/migrations/:from/:to
Add: Scaffold export via packages/exporter
Add: "Why this stack" explanation panel in blueprint output
Add: Alternatives comparison view
Add: Cost/complexity/risk indicators per tool
Phase 5 — Blueprint Generator (Days 17-20)
[NEW] packages/ai/
packages/ai/
├── src/
│   ├── index.ts              # Provider factory
│   ├── providers/
│   │   ├── openai.ts
│   │   ├── gemini.ts
│   │   └── anthropic.ts
│   ├── prompts/
│   │   ├── blueprint.ts      # System prompt for architecture explanation
│   │   └── migration.ts      # System prompt for migration analysis
│   └── schemas/
│       ├── blueprint-output.ts  # Zod schema for LLM response validation
│       └── migration-output.ts
├── package.json
└── tsconfig.json
Architecture:

Deterministic rules engine remains the source of truth for scoring
LLM adds explanation, synthesis, and "why not" reasoning
Every AI response validated with Zod before returning to client
Model must cite registry facts, constraints, and tradeoffs
Return multiple stack options, not just one answer
Generate Architecture Decision Records as part of output
Blueprint output shape:

json
{
  "summary": { "projectType": "", "complexity": "", "teamSize": "" },
  "recommendedStack": { "tools": [], "harmonyScore": 0, "reasoning": "" },
  "alternatives": [{ "tools": [], "harmonyScore": 0, "tradeoffs": "" }],
  "compatibility": { "conflicts": [], "warnings": [], "synergies": [] },
  "risks": [{ "category": "", "severity": "", "mitigation": "" }],
  "costEstimate": { "monthly": "", "breakdown": [] },
  "implementationPlan": [{ "phase": "", "duration": "", "tasks": [] }],
  "generatedFiles": [{ "path": "", "content": "" }],
  "architectureDecisions": [{ "title": "", "status": "", "context": "", "decision": "", "consequences": "" }]
}
Phase 6 — Registry Expansion (Days 21-25)
Expand catalog from 33 tools → 80 curated tools for MVP
Add 2026 AI categories: agent frameworks, vector databases, eval tooling, observability
Add fields: lastVerified, sourceUrls, confidence, pricingLastChecked, deprecated
Add capabilities as primary matching layer (not just categories)
Add evidence-based compatibility rules with versioning
Build admin-only enrichment scripts (CLI, not UI)
WebAILyzer integration deferred to post-MVP (code preserved in workers/webailyzer/)
Phase 7 — Quality Gate (Days 26-28)
Type check every package (pnpm -r type-check)
Unit tests: rules engine, scoring, registry validation, exporter, API schemas
API contract tests for every public endpoint
Playwright E2E: idea input → stack generation → adjustment → export
Security tests: admin-only routes, SSRF protections
CI pipeline: block merge on type errors, test failures, lint, registry validation
Small seed dataset for database-free local development
Phase 8 — Deployment & Operations (Days 29-31)
Deploy web + API to Railway
Neon Postgres for persisted registry, blueprint history, admin data, auth
Neon Auth configured with GitHub OAuth provider via Neon Console
Rate limiting on generation endpoints
Request logging, error tracking (Sentry), basic metrics
/health and /status routes
Privacy controls for user ideas (if saving)
Admin API key before exposing any mutation
Phase 9 — MVP Ship (Day 32)
Feature	In MVP?
Idea-to-stack blueprint	✅ Yes
Compatibility-scored stack options	✅ Yes
Tool search and details	✅ Yes
Stack builder	✅ Yes
Starter file export	✅ Yes
Alternatives and tradeoffs	✅ Yes
Migration path between tools	✅ Basic
User accounts	✅ Yes (Neon Auth)
Voting	❌ No
Analytics dashboard	❌ No
External public import endpoints	❌ No
Public URL analyzer	❌ No
Full admin portal	❌ No (CLI/scripts first)
Verification Plan
Automated Tests
pnpm -r type-check — Zero type errors across all packages
pnpm -r test — All Vitest suites pass (rules engine, scoring, registry, exporter, API)
pnpm -r lint — Zero lint errors
Registry validation script — All 80 catalog tools conform to Zod schemas
API contract tests — Every public endpoint returns correct shape
Playwright E2E — Full user flow: idea → blueprint → stack adjust → export
Auth flow — GitHub OAuth login → session → protected routes
Manual Verification
Verify blueprint generation produces valid, explainable output
Verify scaffold export produces runnable starter projects
Verify compatibility scoring is deterministic (same input = same score)
Test admin routes require API key
Test rate limiting on generation endpoints
Test GitHub OAuth login flow on Railway
Verify Neon Auth sessions persist correctly
Review deployed app in browser for UI completeness
Salvage Reference Map
New Location	Source	What's Ported
packages/registry/catalog/	Branches/StackfastPro/public/catalog/v1/	tools.json, rules.json, categories.json
packages/rules-engine/	Branches/StackfastPro/src/engine/	rules-engine.ts, score-calculator.ts, worker-wrapper.ts
packages/exporter/	Branches/StackfastPro/src/lib/	export-generator.ts, recipe-matcher.ts, archive-generator.ts
packages/exporter/recipes/	Branches/StackfastPro/src/data/recipes/	All recipe files
packages/schemas/	Root shared/schema.ts	Drizzle table definitions, Zod insert schemas, types
apps/api/services/	Root server/services/blueprint-generator.ts	Blueprint generation logic (rewritten for Hono)
apps/api/services/	Root server/services/compatibility-engine.ts	Compatibility scoring logic
apps/web/components/	Branches/StackfastPro/src/components/	StackBuilder, ToolSelector, ExportDialog, etc.
apps/web/pages/ (reference)	Root client/src/pages/blueprint-builder.tsx	Blueprint Builder concept
apps/web/components/ (reference)	Root client/src/components/compatibility/	Heatmap, harmony components
packages/schemas/ (inspiration)	StackFast-101/packages/schemas/	Zod schema patterns
