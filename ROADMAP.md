# Stackfast 2026 — Visual Roadmap

> **Product vision:** An AI-assisted architecture and starter-stack copilot that turns an idea into a validated technical plan, compatibility-scored stack, starter repo, cost/risk estimate, and migration path.

---

## Roadmap Overview

```
Week 1          Week 2          Week 3          Week 4          Week 5          Week 6          Week 7
┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐
│ Phase 0  │   │ Phase 2  │   │ Phase 3  │   │ Phase 4  │   │ Phase 5  │   │ Phase 6  │   │ Phase 7-9│
│ Cleanup  │   │ Core     │   │ API      │   │ UI       │   │ Blueprint│   │ Registry │   │ QA +     │
│ + Phase 1│   │ Engine   │   │ Surface  │   │ Rebuild  │   │ Gen + AI │   │ Expansion│   │ Deploy + │
│ Scaffold │   │ Extract  │   │          │   │          │   │          │   │          │   │ Ship MVP │
└──────────┘   └──────────┘   └──────────┘   └──────────┘   └──────────┘   └──────────┘   └──────────┘
   Day 1-3        Day 4-6        Day 7-10      Day 11-16      Day 17-20      Day 21-25      Day 26-32
```

---

## Phase 0: Freeze & Preserve *(Day 1)*

### Objective
Secure existing work and remove dead weight before building anything new.

### Deliverables
- [x] Archive branch `archive/pre-rebuild` created
- [x] Salvage manifest finalized (SALVAGE_MANIFEST.md)
- [x] Old branches deleted (StackFastold, StackFast1, StackfastPro, StackFast-101, StackWiseAI)
- [x] developer-tools-api deleted
- [x] Stale docs deleted (5 files) — 3 actual deletions + 2 moved to `docs/backlog/` and `docs/deferred/`
- [x] `.env` files removed from source
- [x] `desktop.ini` files removed recursively
- [x] `.gitignore` updated with comprehensive exclusions
- [x] Post-extraction cleanup complete (root `client/`, `server/`, `shared/`, `Branches/`, `Referencedocs/`, legacy build configs, logs, debris)
- [x] Clean commit: "Phase 0: Repository cleanup for 2026 rebuild"

### Risk
**Low.** Archive branch preserves everything. Reversible.

---

## Phase 1: Monorepo Scaffold *(Days 2-3)*

### Objective
Establish the new project structure that all subsequent work builds on.

### Deliverables
- [x] `pnpm-workspace.yaml` with apps and packages
- [x] Root `package.json` with workspace scripts
- [x] `tsconfig.base.json` with strict TypeScript config
- [x] `apps/web/` — StackfastPro migrated in, `pnpm dev` works
- [x] `apps/api/` — Hono server skeleton, `/health` responds
- [x] Neon Auth (Better Auth) configured with GitHub OAuth
- [x] `packages/schemas/` — Package stub
- [x] `packages/registry/` — Package stub
- [x] `packages/rules-engine/` — Package stub
- [x] `packages/exporter/` — Package stub
- [x] `packages/ai/` — Package stub
- [x] `packages/shared/` — Package stub
- [x] ESLint config (shared)
- [x] `pnpm install && pnpm -r type-check` succeeds
- [x] `.github/workflows/ci.yml` — Basic CI pipeline

### Risk
**Low.** Mostly scaffolding. The StackfastPro migration may require path alias adjustments.

---

## Phase 2: Extract Core Engine *(Days 4-6)*

### Objective
Port the proven rules engine, registry, and export system into self-contained packages.

### Deliverables
- [x] `packages/registry/` — Catalog files migrated + Zod validation
- [x] `packages/rules-engine/` — Rules engine + score calculator + tests
- [x] `packages/exporter/` — Export generator + recipes + archive builder
- [x] `packages/schemas/` — Drizzle schemas + Zod API schemas + types
- [x] `packages/shared/` — Common utilities and constants
- [x] All packages compile independently
- [x] Determinism tests pass (same input → same score)
- [x] Registry validation script passes
- [x] Export generator produces valid file structures

### Risk
**Medium.** The rules engine has implicit dependencies on type definitions that need careful extraction. Recipe files reference tool IDs that must match the normalized registry.

---

## Phase 3: Clean API Surface *(Days 7-10)*

### Objective
Build the canonical API that replaces the messy root server.

### Deliverables
- [x] `POST /api/v1/blueprints` — Blueprint generation
- [x] `POST /api/v1/stacks/analyze` — Stack validation
- [x] `GET /api/v1/tools/search` — Tool search with filters
- [x] `GET /api/v1/tools/:id` — Tool details
- [x] `GET /api/v1/categories` — Categories
- [x] `GET /api/v1/compatibility/:a/:b` — Pairwise compatibility
- [x] `POST /api/v1/scaffolds` — Starter file generation
- [x] `GET /api/v1/migrations/:from/:to` — Migration paths
- [x] `GET /health` — Health check
- [x] Admin routes with API key protection
- [x] Rate limiting on generation endpoints
- [x] Zod request validation middleware
- [x] Drizzle + Neon Postgres connection
- [x] Neon Auth (Better Auth) + GitHub OAuth integration
- [x] Admin API key for protected routes
- [x] Seed script for local dev

### Current Status
**Functionally complete for MVP API coverage.** Remaining production hardening includes persistent/distributed rate limiting, fuller OpenAPI response schemas, and deployment-environment verification.

### Risk
**Medium.** Database schema migration from root app needs careful handling. Blueprint generation logic is the most complex route.

---

## Phase 4: Rebuild UI *(Days 11-16)*

### Objective
Ship a polished frontend that makes the API accessible and delightful.

### Deliverables
- [x] **Stack Builder** page (from StackfastPro) — fully connected to API
- [x] **Tool Catalog** page — search, filter, detail views
- [x] **Blueprint Builder** page (ported from root, rebuilt)
  - [ ] Multi-step wizard UI
  - [x] "Why this stack" explanation panel
  - [x] Alternatives comparison table
  - [x] Cost/risk indicators
- [ ] **Compatibility View** — Heatmap visualization
- [x] **Migration Explorer** — Basic tool-to-tool migration paths
- [x] **Export Dialog** — Downloads scaffold files
- [ ] All API integrations via TanStack Query
- [x] Error boundaries and loading states
- [x] Responsive design (mobile-friendly)
- [x] Dark theme with neon-orange accent

### Current Status
**Mostly complete.** Tool catalog, blueprint generation, migration explorer, catalog loading, scaffold export, compatibility view, and Stack Builder analysis are API-backed. Stack Builder keeps a local rules-engine fallback for offline/API failure cases. Auth/session controls are wired in the shared layout. Remaining gaps are deeper auth-required UX for generation failures and converting every API call path to TanStack Query where direct calls remain appropriate.

### Risk
**Medium-High.** This is the largest phase. Blueprint Builder is the most complex UI piece. Compatibility heatmap requires careful data normalization.

---

## Phase 5: Blueprint Generator + AI *(Days 17-20)*

### Objective
Make the blueprint generator actually valuable with LLM-powered explanations.

### Deliverables
- [x] `packages/ai/` — Provider abstraction (heuristic, Gemini, Azure OpenAI)
- [x] Deterministic rules remain source of truth for scoring
- [x] LLM adds explanation and synthesis layer
- [x] Every AI response validated with Zod
- [x] Multiple stack options returned (not just one)
- [x] "Why not" explanations for rejected alternatives
- [ ] Architecture Decision Records in output
- [x] Cost estimates per stack option
- [x] Implementation roadmap per stack option
- [x] Fallback to deterministic-only mode if AI unavailable

### Current Status
**Phase 5 scope is complete for MVP.** `heuristic`, `gemini`, and
`azure-openai` providers ship in `packages/ai`. The operator's Azure AI
Foundry resource (with `gpt-5.5` / `gpt-4.1` deployments) is the primary
production provider; Gemini remains available as a lower-cost fallback.
Every AI call is wrapped in a heuristic fallback and validated with Zod.
See `docs/decisions/002-ai-provider-strategy.md`. The one remaining item
(ADR generation in the blueprint response itself) is deferred to v1.1.

### Risk
**Medium.** LLM integration introduces latency and cost. Provider API changes can break things. Zod validation of AI output needs thorough testing.

---

## Phase 6: Registry Expansion *(Days 21-25)*

### Objective
Build a registry that's genuinely useful for 2026 technology decisions.

### Deliverables
- [x] Expand catalog from 33 → 80 curated tools *(now 97 curated tools)*
- [x] Add 2026 AI categories: agent frameworks, vector DBs, eval tooling
- [x] Add observability, auth, billing, queues, workflow engines categories
- [x] New fields: `lastVerified`, `sourceUrls`, `confidence`, `capabilities[]`
- [x] Capability-based matching (primary matching layer)
- [x] Evidence-based compatibility rules with versioning
- [ ] Admin enrichment scripts (CLI-based)
- [x] All 80 tools pass schema validation *(97 tools pass registry validation)*
- [ ] WebAILyzer deferred to post-MVP (code preserved in `workers/webailyzer/`)

### Tools to Add (Priority List)
| Category | Tools |
|----------|-------|
| Agent Frameworks | LangChain, LangGraph, CrewAI, AutoGen, Semantic Kernel |
| Vector Databases | Pinecone, Weaviate, Qdrant, Milvus, Chroma |
| AI Models | OpenAI, Anthropic, Gemini, Mistral, Llama, Cohere |
| Eval & Observability | LangSmith, Langfuse, Helicone, Braintrust |
| Auth | Clerk, Auth0, Supabase Auth, NextAuth, Lucia |
| Payments | Stripe, LemonSqueezy, Paddle |
| Databases | PostgreSQL, MySQL, MongoDB, Redis, DynamoDB, PlanetScale, Turso |
| Deployment | Vercel, Netlify, Railway, Fly.io, AWS, GCP, Cloudflare |
| Backend Frameworks | Next.js, Remix, Hono, Fastify, tRPC, NestJS |
| Frontend | React, Vue, Svelte, Solid, Angular, Astro |
| Mobile | React Native, Expo, Flutter, Capacitor |
| Testing | Vitest, Jest, Playwright, Cypress |
| Monorepo | Turborepo, Nx, pnpm workspaces |
| CMS | Sanity, Contentful, Strapi, Payload |
| Email | Resend, Postmark, SendGrid |
| Queues | BullMQ, Inngest, Trigger.dev, Temporal |

### Current Status
**Substantially complete.** The canonical registry and static web fallback are synchronized at version `1.1.0` with 20 categories, 97 tools, and 93 rules. New schema-supported categories cover agent frameworks, AI model providers, vector databases, eval/observability, backend frameworks, queues/workflows, testing, monorepos, CMS, and mobile. Registry validation, linting, type-checks, and tests pass after the expansion. Remaining work is CLI/admin enrichment automation and any post-MVP WebAILyzer integration.

### Risk
**Low-Medium.** Data quality remains the main risk. Each tool has curated metadata and source URLs, but pricing and compatibility should be periodically reverified as vendors change APIs and plans.

---

## Phase 7: Quality Gate *(Days 26-28)*

### Deliverables
- [x] Zero type errors across all packages
- [x] All unit tests pass (rules, scoring, registry, exporter, schemas)
- [x] API contract tests for every public endpoint
- [x] Playwright E2E tests for primary flows
- [x] Security tests for admin routes and rate limiting
- [x] CI pipeline blocks merge on any failure
- [x] Small seed dataset for database-free local dev

### Current Status
**Quality gate is green for the MVP codebase.** Type-check, lint, unit/API tests, builds, registry validation, API contract coverage, admin protection checks, rate-limit tests, and Playwright E2E MVP flows pass locally. Remaining security/deployment hardening belongs to Phase 8.

---

## Phase 8: Deployment & Operations *(Days 29-31)*

See `docs/decisions/003-deployment-architecture.md` for the full
architecture decision: split Railway web/API, Neon Postgres, Upstash
Redis for rate limiting, cross-origin cookie strategy, Sentry behind a
feature flag, and the rollback plan.

### Deliverables
- [ ] Web + API deployed to Railway (via Railway CLI)
- [ ] Neon Postgres production branch provisioned and connected
- [ ] Better Auth + GitHub OAuth configured (ADR 001)
- [ ] Upstash Redis provisioned, rate limiter migrated off in-memory `Map`
- [ ] Health check verified
- [ ] Rate limiting verified in production
- [ ] Error tracking (Sentry) wired behind `SENTRY_DSN` feature flag
- [ ] Admin API key configured
- [ ] DNS + domain configured (`stackfast.app` + `api.stackfast.app`)
- [ ] README updated with deployment instructions

---

## Phase 9: MVP Ship *(Day 32)*

### MVP Feature Checklist

| Feature | Status | Priority |
|---------|--------|----------|
| Idea-to-stack blueprint | ✅ | P0 |
| Compatibility-scored stack options | ✅ | P0 |
| Tool search and details | ✅ | P0 |
| Stack builder with diagnostics | ✅ | P0 |
| Starter file export | ✅ | P0 |
| Alternatives and tradeoffs | ✅ | P0 |
| GitHub OAuth login | ⚠️ Configured, production verification pending | P0 |
| Migration path (basic) | ✅ | P1 |

### NOT in MVP

| Feature | Reason | When |
|---------|--------|------|
| User accounts | Not needed unless saving | Post-MVP |
| Voting/popularity | Vanity metric, not core | Post-MVP |
| Analytics dashboard | Nice-to-have | Post-MVP |
| External import endpoints | Security risk | Post-MVP (admin only) |
| Public URL analyzer | SSRF risk + WebAILyzer deferred | Post-MVP (v1.3+) |
| Full admin portal | CLI/scripts first | Post-MVP |

---

## Post-MVP Roadmap

### v1.1 — User Experience *(+2 weeks)*
- User accounts (save blueprints, track projects)
- Blueprint history and versioning
- Stack comparison view
- Tool voting and community rankings

### v1.2 — Intelligence *(+3 weeks)*
- Stack redundancy detection ("you have two ORMs")
- Missing-piece suggestions ("you need auth")
- Cost optimization recommendations
- Performance impact estimates per tool

### v1.3 — Ecosystem *(+4 weeks)*
- Full admin portal for registry management
- Community-contributed tools (moderated)
- API keys for third-party integrations
- Webhook notifications for registry updates
- Stack templates (pre-built curated stacks)

### v2.0 — Platform *(+8 weeks)*
- Repository analysis (paste URL, get stack analysis)
- Modernization recommendations for existing stacks
- Team-based project workspaces
- Stack observability (track what stacks people actually use)
- Plugin system for custom rules and recipes

---

## Success Metrics

| Metric | MVP Target | v1.x Target |
|--------|-----------|-------------|
| Registry tools | 80 | 200+ |
| Compatibility rules | 100+ | 500+ |
| Blueprint generation time | < 5s | < 3s |
| Type errors | 0 | 0 |
| Test coverage | 70%+ | 85%+ |
| Lighthouse score | 90+ | 95+ |
| Active users (weekly) | 50+ | 500+ |
