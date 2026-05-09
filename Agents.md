# Stackfast 2026 — Agent Workflow Specification

> **Purpose:** Define the specialized agents, their responsibilities, handoff protocols, and orchestration pattern for executing the Stackfast 2026 rebuild plan.

---

## Agent Architecture Overview

The rebuild is executed by **6 specialized agents** coordinated by an **Orchestrator**. Each agent owns a bounded domain and produces artifacts consumed by downstream agents. Work is phase-gated: no agent proceeds to the next phase until the Orchestrator validates the current phase's exit criteria.

```
┌─────────────────────────────────────────────────────────────────┐
│                        ORCHESTRATOR                             │
│   Coordinates phases, validates exit criteria, manages state    │
├─────────┬───────────┬───────────┬──────────┬──────────┬────────┤
│ Cleanup │ Architect │ Engine    │ API      │ UI       │ QA     │
│ Agent   │ Agent     │ Agent     │ Agent    │ Agent    │ Agent  │
└─────────┴───────────┴───────────┴──────────┴──────────┴────────┘
```

---

## Agent Definitions

### 1. Orchestrator (Meta-Agent)

**Role:** Project coordinator and phase gate validator.

**Responsibilities:**
- Maintain the `task.md` checklist and update progress
- Validate phase exit criteria before advancing
- Resolve cross-agent conflicts and ambiguities
- Manage the salvage manifest (what's kept vs. deleted)
- Track open questions and user decisions

**Inputs:** Implementation plan, user decisions, agent reports
**Outputs:** Updated task.md, phase gate approvals, decision log

**Phase Gate Criteria:**
| Phase | Exit Criteria |
|-------|---------------|
| 0 | Archive branch exists, cleanup complete, `.gitignore` updated, no `.env` in source |
| 1 | Monorepo scaffolded, all packages resolve, `pnpm install` succeeds, base TypeScript compiles |
| 2 | Registry validates, rules engine tests pass, exporter generates valid output |
| 3 | All public API endpoints return correct shapes, admin routes require auth, rate limiting active |
| 4 | UI renders, all pages load, no broken endpoint calls, export flow works end-to-end |
| 5 | Blueprint generation produces valid Zod-validated output with alternatives |
| 6 | Registry has 80 tools, all pass schema validation |
| 7 | All tests pass, CI pipeline green, zero type errors |
| 8 | Deployed to Railway, health check passes, rate limiting verified, Neon Auth configured |
| 9 | MVP feature checklist complete, README accurate |

---

### 2. Cleanup Agent

**Role:** Repository hygiene and archive management.

**Phase:** 0 (Freeze & Preserve)

**Responsibilities:**
- Create `archive/pre-rebuild` branch from current state
- Document the salvage manifest: exact file paths kept from each source
- Delete designated paths (see deletion list below)
- Remove committed secrets and `.env` files
- Update `.gitignore` with comprehensive exclusions
- Verify no remaining `desktop.ini`, `.local/`, `.vs/`, committed `node_modules/`

**Deletion List:**
```
DELETE: Branches/StackFastold/
DELETE: Branches/StackFast1/
DELETE: developer-tools-api/
DELETE: .local/
DELETE: .env.fixed
DELETE: All desktop.ini files (recursive)
DELETE: Referencedocs/STACKFAST_MERGER_SUCCESS.md
DELETE: Referencedocs/PHASE2_COMPLETE.md
DELETE: Referencedocs/PHASE3_PROGRESS.md
DELETE: Referencedocs/PHASE4_COMPLETE.md
DELETE: Referencedocs/CODEBASE_REVIEW.md
ARCHIVE: replit.md (extract useful notes, then remove)
KEEP: Branches/StackfastPro/ (primary source)
KEEP: Branches/StackFast-101/ (reference only, can delete after extraction)
KEEP: Branches/StackWiseAI/ (product inspiration only)
KEEP: WebAILyzerAPI/ (deferred to post-MVP, code preserved for later integration)
KEEP: Root server/services/ (salvage reference)
KEEP: Root shared/schema.ts (salvage reference)
KEEP: Root client/src/pages/blueprint-builder.tsx (salvage reference)
KEEP: Root client/src/components/compatibility/ (salvage reference)
```

**Exit Artifact:** Salvage manifest document, clean git status

---

### 3. Architect Agent

**Role:** Monorepo structure, build system, and shared infrastructure.

**Phase:** 1 (Monorepo Scaffold)

**Responsibilities:**
- Initialize pnpm workspace with `apps/` and `packages/` structure
- Create `tsconfig.base.json` with strict mode and path aliases
- Set up each package with its own `package.json` and `tsconfig.json`
- Configure Vite for `apps/web/` (migrate from StackfastPro config)
- Configure Hono server for `apps/api/`
- Set up Vitest configuration for all packages
- Create `.env.example` with all required variables documented
- Set up ESLint configuration (shared)
- Create GitHub Actions CI workflow

**Package Dependency Graph:**
```
packages/shared     ← no dependencies
packages/schemas    ← depends on shared
packages/registry   ← depends on schemas, shared
packages/rules-engine ← depends on schemas, registry, shared
packages/exporter   ← depends on schemas, registry, rules-engine, shared
packages/ai         ← depends on schemas, shared
apps/api            ← depends on all packages
apps/web            ← depends on schemas, rules-engine (via worker), registry (types)
```

**Exit Artifact:** Working monorepo where `pnpm install && pnpm -r type-check` succeeds

---

### 4. Engine Agent

**Role:** Core business logic packages — registry, rules, scoring, export.

**Phase:** 2 (Extract Core Engine)

**Responsibilities:**

#### packages/registry
- Migrate `StackfastPro/public/catalog/v1/` files
- Add Zod schemas for tool, category, and rule catalog entries
- Add build-time validation script that fails CI if catalog is invalid
- Normalize tool IDs to slugs (e.g., `nextjs`, `supabase`, `clerk`)
- Add new fields: `lastVerified`, `sourceUrls`, `confidence`, `capabilities[]`, `deprecated`
- Create `CatalogLoader` class with typed getters

#### packages/rules-engine
- Migrate `StackfastPro/src/engine/` files
- Ensure all functions are pure and side-effect free
- Port `score-calculator.ts` with its weight system intact
- Keep Web Worker support via `worker-wrapper.ts`
- Add comprehensive test suite with fixtures:
  - Same input always produces same score (determinism test)
  - Known conflict pair produces error diagnostic
  - Known synergy pair produces bonus diagnostic
  - Empty selection produces baseline score

#### packages/exporter
- Migrate `StackfastPro/src/lib/export-generator.ts` and `recipe-matcher.ts`
- Migrate `StackfastPro/src/data/recipes/` (nextjs-base, nextjs-clerk, etc.)
- Add Zod schemas for recipe definitions
- Add `.env.example` generation from selected tools
- Add `README.md` generation with setup instructions
- Add ADR (Architecture Decision Record) generation
- Add `setup-guide.md` generation
- Test: recipe → files → valid project structure

#### packages/schemas
- Extract Drizzle table definitions from root `shared/schema.ts`
- Create Zod schemas for API request/response types
- Create Zod schemas for blueprint output shape
- Export TypeScript types derived from schemas
- Ensure all schemas are importable from both API and web

**Exit Artifact:** All package tests pass, registry validates, exporter generates valid output

---

### 5. API Agent

**Role:** Clean API layer with Hono.

**Phase:** 3 (Build Clean API Surface)

**Responsibilities:**

#### Route Implementation
- `POST /api/v1/blueprints` — Idea-to-stack blueprint generation
  - Input: `{ idea, constraints, preferredTools?, budget?, timeline?, teamSize? }`
  - Output: Full blueprint with alternatives, scoring, risks, files
  - Uses `packages/rules-engine` for scoring, `packages/ai` for explanation
- `POST /api/v1/stacks/analyze` — Stack validation
  - Input: `{ toolIds: string[] }`
  - Output: `{ harmonyScore, conflicts, warnings, synergies, recommendations }`
- `GET /api/v1/tools/search` — Registry search with filters
  - Query params: `q`, `category`, `capabilities`, `pricing`, `sort`, `limit`, `offset`
- `GET /api/v1/tools/:id` — Single tool details
- `GET /api/v1/categories` — Category list with tool counts
- `GET /api/v1/compatibility/:a/:b` — Pairwise compatibility score
- `POST /api/v1/scaffolds` — Generate downloadable starter files
  - Input: `{ toolIds: string[], projectName: string }`
  - Output: ZIP file or file list
- `GET /api/v1/migrations/:from/:to` — Migration path
- `GET /health` — Health check

#### Admin Routes
- `POST /admin/tools/import` — Protected bulk import
- `POST /admin/compatibility/recompute` — Recompute all scores
- `POST /internal/enrich-tool` — Refresh metadata

#### Middleware
- Admin API key validation for `/admin/*` and `/internal/*`
- Neon Auth (Better Auth) session validation for user endpoints
- Rate limiting: 30 req/min for generation endpoints, 100 req/min for reads
- Zod request validation with formatted error responses
- CORS configuration
- Request ID logging

#### Database
- Drizzle schema from `packages/schemas`
- Neon serverless driver with connection pooling
- Neon Auth (Better Auth) with GitHub OAuth provider
- Seed script for local development (works without database)

**Exit Artifact:** All endpoints return correct shapes, OpenAPI-compatible documentation

---

### 6. UI Agent

**Role:** Frontend application with StackfastPro as foundation.

**Phase:** 4 (Rebuild UI)

**Responsibilities:**

#### Core Pages (from StackfastPro)
- **Stack Builder** — Tool selection with category sections, compatibility scoring, diagnostics
- **Export Dialog** — Generate scaffold files via `packages/exporter`
- **Tool Catalog** — Browse/search all tools with details

#### Ported Pages (from root, rebuilt)
- **Blueprint Builder** — Idea input form → blueprint output with alternatives
  - Multi-step wizard: idea → constraints → results → export
  - "Why this stack" explanation panel
  - Alternatives comparison table
  - Cost/complexity/risk indicators
- **Compatibility View** — Heatmap + harmony visualization
- **Migration Explorer** — Tool-to-tool migration paths (basic version)

#### New Components
- **Blueprint Output Card** — Renders the full blueprint response
- **Alternatives Comparison** — Side-by-side stack option comparison
- **Cost Estimator** — Visual cost breakdown per tool
- **Architecture Preview** — Visual representation of generated architecture

#### Design System
- Extend StackfastPro's existing Tailwind + Radix UI foundation
- Dark theme with neon-orange accent (consistent with existing brand)
- Responsive layouts for all pages
- Loading states, error boundaries, empty states for all views
- Smooth transitions and micro-animations

#### API Integration
- TanStack Query for all API calls
- Proper error handling with user-friendly messages
- Optimistic updates where appropriate
- Cache invalidation strategy

**Exit Artifact:** All pages render, all API integrations work, export flow complete

---

### 7. QA Agent

**Role:** Quality assurance, testing, and deployment validation.

**Phases:** 7-9 (Quality Gate, Deployment, MVP Ship)

**Responsibilities:**

#### Phase 7 — Quality Gate
- Run `pnpm -r type-check` — zero errors
- Run `pnpm -r test` — all suites pass
- Run `pnpm -r lint` — zero errors
- Validate all registry JSON against Zod schemas
- Write and run API contract tests for every public endpoint
- Write and run Playwright E2E tests:
  1. Tool search and detail view
  2. Stack builder: select tools → see score → adjust → export
  3. Blueprint builder: enter idea → receive blueprint → view alternatives → export
  4. Migration explorer: select from/to → view path
- Security tests:
  - Admin routes reject unauthenticated requests
  - Rate limiting activates on generation endpoints
  - No SSRF via any user-supplied URL

#### Phase 8 — Deployment
- Deploy web app and API to Railway
- Deploy database to Neon Postgres
- Configure Neon Auth with GitHub OAuth provider
- Verify health check endpoint
- Verify rate limiting in production
- Verify admin routes are protected
- Set up error tracking (Sentry)
- Verify database connectivity

#### Phase 9 — MVP Validation
- Verify all MVP features work end-to-end
- Verify README is accurate
- Verify `.env.example` is complete and documented
- Final accessibility check
- Final performance check (Lighthouse)

**Exit Artifact:** All tests green, deployment verified, MVP checklist complete

---

## Agent Communication Protocol

### Handoff Format
When an agent completes a phase, it produces a structured handoff:

```markdown
## Handoff: [Phase N] → [Phase N+1]

**Agent:** [Agent Name]
**Status:** Complete / Blocked
**Artifacts Produced:**
- [list of files created/modified]

**Exit Criteria Met:**
- [x] Criterion 1
- [x] Criterion 2

**Known Issues:**
- [any issues for the next agent to be aware of]

**Decisions Made:**
- [any architectural decisions made during this phase]

**Dependencies for Next Phase:**
- [what the next agent needs from this handoff]
```

### Conflict Resolution
If two agents need to modify the same file or make conflicting decisions:
1. Both agents document their proposal
2. The Orchestrator evaluates against the implementation plan
3. The Orchestrator makes the final decision and documents it as an ADR

### Parallel Work
After Phase 1 (Monorepo Scaffold), the following can run in parallel:
- **Engine Agent** (Phase 2) and **API Agent** (Phase 3 setup) can overlap
- **UI Agent** (Phase 4) can start component work while API Agent finishes routes
- **QA Agent** writes test fixtures during Phase 2-4, executes during Phase 7

---

## State Management

### Tracking Files
| File | Purpose |
|------|---------|
| `task.md` | Living checklist of all work items |
| `Agents.md` | This file — agent definitions and protocols |
| `SALVAGE_MANIFEST.md` | What was kept, deleted, and why (created by Cleanup Agent) |
| `docs/decisions/*.md` | Architecture Decision Records |
| `CHANGELOG.md` | Running log of significant changes |

### Decision Log
All significant decisions are recorded in ADR format in `docs/decisions/`:
- `001-monorepo-tooling.md` — Why pnpm workspaces over Turborepo/Nx
- `002-api-framework.md` — Why Hono over Express/Fastify
- `003-ai-provider-strategy.md` — LLM abstraction approach
- `004-registry-format.md` — Static JSON vs. database-only
- `005-deployment-architecture.md` — Split web/API vs. monolith

---

## Quick Reference: Who Does What

| Task | Agent |
|------|-------|
| Delete old branches and files | Cleanup Agent |
| Set up pnpm workspace | Architect Agent |
| Configure TypeScript | Architect Agent |
| Migrate catalog JSON | Engine Agent |
| Port rules engine | Engine Agent |
| Port recipe/export system | Engine Agent |
| Build Hono API routes | API Agent |
| Add admin auth middleware | API Agent |
| Set up Drizzle + Postgres | API Agent |
| Migrate StackfastPro UI | UI Agent |
| Port blueprint builder page | UI Agent |
| Build new blueprint output view | UI Agent |
| Write unit tests | Engine Agent (packages), API Agent (routes) |
| Write E2E tests | QA Agent |
| Deploy to production | QA Agent |
| Validate MVP completeness | QA Agent + Orchestrator |
