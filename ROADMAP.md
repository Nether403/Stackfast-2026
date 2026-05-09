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
- [ ] Archive branch `archive/pre-rebuild` created
- [ ] Salvage manifest finalized (SALVAGE_MANIFEST.md)
- [ ] Old branches deleted (StackFastold, StackFast1)
- [ ] developer-tools-api deleted
- [ ] Stale docs deleted (5 files)
- [ ] `.env` files removed from source
- [ ] `desktop.ini` files removed recursively
- [ ] `.gitignore` updated with comprehensive exclusions
- [ ] Clean commit: "Phase 0: Repository cleanup for 2026 rebuild"

### Risk
**Low.** Archive branch preserves everything. Reversible.

---

## Phase 1: Monorepo Scaffold *(Days 2-3)*

### Objective
Establish the new project structure that all subsequent work builds on.

### Deliverables
- [ ] `pnpm-workspace.yaml` with apps and packages
- [ ] Root `package.json` with workspace scripts
- [ ] `tsconfig.base.json` with strict TypeScript config
- [ ] `apps/web/` — StackfastPro migrated in, `pnpm dev` works
- [ ] `apps/api/` — Hono server skeleton, `/health` responds
- [ ] Neon Auth (Better Auth) configured with GitHub OAuth
- [ ] `packages/schemas/` — Package stub
- [ ] `packages/registry/` — Package stub
- [ ] `packages/rules-engine/` — Package stub
- [ ] `packages/exporter/` — Package stub
- [ ] `packages/ai/` — Package stub
- [ ] `packages/shared/` — Package stub
- [ ] ESLint config (shared)
- [ ] `pnpm install && pnpm -r type-check` succeeds
- [ ] `.github/workflows/ci.yml` — Basic CI pipeline

### Risk
**Low.** Mostly scaffolding. The StackfastPro migration may require path alias adjustments.

---

## Phase 2: Extract Core Engine *(Days 4-6)*

### Objective
Port the proven rules engine, registry, and export system into self-contained packages.

### Deliverables
- [ ] `packages/registry/` — Catalog files migrated + Zod validation
- [ ] `packages/rules-engine/` — Rules engine + score calculator + tests
- [ ] `packages/exporter/` — Export generator + recipes + archive builder
- [ ] `packages/schemas/` — Drizzle schemas + Zod API schemas + types
- [ ] `packages/shared/` — Common utilities and constants
- [ ] All packages compile independently
- [ ] Determinism tests pass (same input → same score)
- [ ] Registry validation script passes
- [ ] Export generator produces valid file structures

### Risk
**Medium.** The rules engine has implicit dependencies on type definitions that need careful extraction. Recipe files reference tool IDs that must match the normalized registry.

---

## Phase 3: Clean API Surface *(Days 7-10)*

### Objective
Build the canonical API that replaces the messy root server.

### Deliverables
- [ ] `POST /api/v1/blueprints` — Blueprint generation
- [ ] `POST /api/v1/stacks/analyze` — Stack validation
- [ ] `GET /api/v1/tools/search` — Tool search with filters
- [ ] `GET /api/v1/tools/:id` — Tool details
- [ ] `GET /api/v1/categories` — Categories
- [ ] `GET /api/v1/compatibility/:a/:b` — Pairwise compatibility
- [ ] `POST /api/v1/scaffolds` — Starter file generation
- [ ] `GET /api/v1/migrations/:from/:to` — Migration paths
- [ ] `GET /health` — Health check
- [ ] Admin routes with API key protection
- [ ] Rate limiting on generation endpoints
- [ ] Zod request validation middleware
- [ ] Drizzle + Neon Postgres connection
- [ ] Neon Auth (Better Auth) + GitHub OAuth integration
- [ ] Admin API key for protected routes
- [ ] Seed script for local dev

### Risk
**Medium.** Database schema migration from root app needs careful handling. Blueprint generation logic is the most complex route.

---

## Phase 4: Rebuild UI *(Days 11-16)*

### Objective
Ship a polished frontend that makes the API accessible and delightful.

### Deliverables
- [ ] **Stack Builder** page (from StackfastPro) — fully connected to API
- [ ] **Tool Catalog** page — search, filter, detail views
- [ ] **Blueprint Builder** page (ported from root, rebuilt)
  - [ ] Multi-step wizard UI
  - [ ] "Why this stack" explanation panel
  - [ ] Alternatives comparison table
  - [ ] Cost/risk indicators
- [ ] **Compatibility View** — Heatmap visualization
- [ ] **Migration Explorer** — Basic tool-to-tool migration paths
- [ ] **Export Dialog** — Downloads scaffold files
- [ ] All API integrations via TanStack Query
- [ ] Error boundaries and loading states
- [ ] Responsive design (mobile-friendly)
- [ ] Dark theme with neon-orange accent

### Risk
**Medium-High.** This is the largest phase. Blueprint Builder is the most complex UI piece. Compatibility heatmap requires careful data normalization.

---

## Phase 5: Blueprint Generator + AI *(Days 17-20)*

### Objective
Make the blueprint generator actually valuable with LLM-powered explanations.

### Deliverables
- [ ] `packages/ai/` — Provider abstraction (OpenAI/Gemini/Anthropic)
- [ ] Deterministic rules remain source of truth for scoring
- [ ] LLM adds explanation and synthesis layer
- [ ] Every AI response validated with Zod
- [ ] Multiple stack options returned (not just one)
- [ ] "Why not" explanations for rejected alternatives
- [ ] Architecture Decision Records in output
- [ ] Cost estimates per stack option
- [ ] Implementation roadmap per stack option
- [ ] Fallback to deterministic-only mode if AI unavailable

### Risk
**Medium.** LLM integration introduces latency and cost. Provider API changes can break things. Zod validation of AI output needs thorough testing.

---

## Phase 6: Registry Expansion *(Days 21-25)*

### Objective
Build a registry that's genuinely useful for 2026 technology decisions.

### Deliverables
- [ ] Expand catalog from 33 → 80 curated tools
- [ ] Add 2026 AI categories: agent frameworks, vector DBs, eval tooling
- [ ] Add observability, auth, billing, queues, workflow engines categories
- [ ] New fields: `lastVerified`, `sourceUrls`, `confidence`, `capabilities[]`
- [ ] Capability-based matching (primary matching layer)
- [ ] Evidence-based compatibility rules with versioning
- [ ] Admin enrichment scripts (CLI-based)
- [ ] All 80 tools pass schema validation
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

### Risk
**Low-Medium.** Data quality is the main risk. Each tool needs accurate metadata. Automation scripts can help, but manual curation is needed for quality.

---

## Phase 7: Quality Gate *(Days 26-28)*

### Deliverables
- [ ] Zero type errors across all packages
- [ ] All unit tests pass (rules, scoring, registry, exporter, schemas)
- [ ] API contract tests for every public endpoint
- [ ] Playwright E2E tests for primary flows
- [ ] Security tests for admin routes and rate limiting
- [ ] CI pipeline blocks merge on any failure
- [ ] Small seed dataset for database-free local dev

---

## Phase 8: Deployment & Operations *(Days 29-31)*

### Deliverables
- [ ] Web + API deployed to Railway
- [ ] Neon Postgres provisioned and connected
- [ ] Neon Auth configured with GitHub OAuth via Neon Console
- [ ] Health check verified
- [ ] Rate limiting verified in production
- [ ] Error tracking (Sentry) configured
- [ ] Admin API key configured
- [ ] DNS + domain configured
- [ ] README updated with deployment instructions

---

## Phase 9: MVP Ship *(Day 32)*

### MVP Feature Checklist

| Feature | Status | Priority |
|---------|--------|----------|
| Idea-to-stack blueprint | 🔲 | P0 |
| Compatibility-scored stack options | 🔲 | P0 |
| Tool search and details | 🔲 | P0 |
| Stack builder with diagnostics | 🔲 | P0 |
| Starter file export | 🔲 | P0 |
| Alternatives and tradeoffs | 🔲 | P0 |
| GitHub OAuth login | 🔲 | P0 |
| Migration path (basic) | 🔲 | P1 |

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
