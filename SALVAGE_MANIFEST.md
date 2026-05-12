# Stackfast 2026 — Salvage Manifest

> **Purpose:** Exact record of what is preserved, what is deleted, and where preserved assets move in the new architecture.

---

## Preservation Summary

| Source | Verdict | Destination |
|--------|---------|-------------|
| `Branches/StackfastPro/` | **PRIMARY BASE** | Multiple packages and apps |
| Root `server/services/` | **SALVAGE** (reference) | `apps/api/services/` |
| Root `shared/schema.ts` | **SALVAGE** (extract) | `packages/schemas/` |
| Root `client/src/pages/blueprint-builder.tsx` | **SALVAGE** (reference) | `apps/web/pages/` |
| Root `client/src/components/compatibility/` | **SALVAGE** (reference) | `apps/web/components/` |
| `Branches/StackFast-101/packages/schemas/` | **SALVAGE** (patterns) | `packages/schemas/` |
| `Branches/StackFast-101/packages/api/src/routes/blueprint.ts` | **SALVAGE** (validation pattern) | `apps/api/routes/blueprints.ts` |
| `Branches/StackWiseAI/` | **INSPIRATION ONLY** | Product concepts doc |
| `WebAILyzerAPI/` | **DEFERRED** (post-MVP) | Code preserved in `workers/webailyzer/` — requires SSRF hardening before integration |
| `Referencedocs/INTEGRATION_PLAN.md` | **KEEP** (backlog) | `docs/backlog/` |
| `Referencedocs/README_CI_DOCKER.md` | **KEEP** (rewrite) | `docs/` |
| `Branches/StackFastold/` | **DELETE** | — |
| `Branches/StackFast1/` | **DELETE** | — |
| `developer-tools-api/` | **DELETE** | — |
| All `desktop.ini` | **DELETE** | — |
| All committed `.env` files | **DELETE** | — |
| `.local/`, `.vs/` | **DELETE** | — |
| Stale `Referencedocs/` (5 files) | **DELETE** | — |

---

## Detailed File Mapping

### From `Branches/StackfastPro/`

| Source Path | → New Path | Notes |
|------------|------------|-------|
| `public/catalog/v1/tools.json` | `packages/registry/catalog/v1/tools.json` | Add new fields |
| `public/catalog/v1/rules.json` | `packages/registry/catalog/v1/rules.json` | As-is |
| `public/catalog/v1/categories.json` | `packages/registry/catalog/v1/categories.json` | Add capabilities |
| `public/catalog/v1/manifest.json` | `packages/registry/catalog/v1/manifest.json` | As-is |
| `src/engine/rules-engine.ts` | `packages/rules-engine/src/rules-engine.ts` | Keep logic, add tests |
| `src/engine/score-calculator.ts` | `packages/rules-engine/src/score-calculator.ts` | As-is |
| `src/engine/worker-wrapper.ts` | `packages/rules-engine/src/worker-wrapper.ts` | As-is |
| `src/engine/evaluate-with-fallback.ts` | `packages/rules-engine/src/evaluate-with-fallback.ts` | As-is |
| `src/engine/rules-engine.worker.ts` | `packages/rules-engine/src/rules-engine.worker.ts` | As-is |
| `src/lib/export-generator.ts` | `packages/exporter/src/export-generator.ts` | Add ADR + setup guide |
| `src/lib/recipe-matcher.ts` | `packages/exporter/src/recipe-matcher.ts` | As-is |
| `src/lib/archive-generator.ts` | `packages/exporter/src/archive-generator.ts` | As-is |
| `src/lib/catalog-loader.ts` | `packages/registry/src/catalog-loader.ts` | Refactor to typed |
| `src/lib/export-log-generator.ts` | `packages/exporter/src/export-log-generator.ts` | As-is |
| `src/data/recipes/*.ts` | `packages/exporter/src/recipes/*.ts` | All recipe files |
| `src/data/suggestions.ts` | `packages/exporter/src/suggestions.ts` | As-is |
| `src/types/*.ts` | `packages/shared/src/types/` | Merge with schemas |
| `src/components/*.tsx` | `apps/web/src/components/` | Primary UI base |
| `src/context/*.tsx` | `apps/web/src/context/` | As-is |
| `src/hooks/*.ts` | `apps/web/src/hooks/` | As-is |
| `src/App.tsx` | `apps/web/src/App.tsx` | Modify for new routing |
| `src/main.tsx` | `apps/web/src/main.tsx` | As-is |
| `src/index.css` | `apps/web/src/index.css` | Extend with new styles |
| `tests/` | `apps/web/tests/` + `packages/*/tests/` | Split by domain |

### From Root App

| Source Path | → New Path | Usage |
|------------|------------|-------|
| `shared/schema.ts` | `packages/schemas/src/db-schema.ts` | Extract and modernize |
| `server/services/blueprint-generator.ts` | `apps/api/src/services/blueprint.ts` | Rewrite for Hono, keep logic |
| `server/services/compatibility-engine.ts` | `apps/api/src/services/compatibility.ts` | Rewrite for Hono |
| `server/services/stackfast-adapter.ts` | — | Reference only, then discard |
| `client/src/pages/blueprint-builder.tsx` | `apps/web/src/pages/blueprint-builder.tsx` | Port after API is clean |
| `client/src/components/compatibility/` | `apps/web/src/components/compatibility/` | Port heatmap + harmony |
| `client/src/components/migration/` | `apps/web/src/components/migration/` | Basic migration view |
| `client/src/pages/migration-wizard.tsx` | — | Reference only for MVP |

### From `Branches/StackFast-101/`

| Source Path | → New Path | Usage |
|------------|------------|-------|
| `Stackfast/StackFast/packages/schemas/` | `packages/schemas/` | Pattern reference |
| `Stackfast/StackFast/packages/api/src/routes/blueprint.ts` | — | Validation pattern reference |
| `Stackfast/StackFast/packages/api/src/routes/compatibility.ts` | — | Scoring model reference |

---

## Deletion Inventory

### Branches to Delete

| Path | Size | Reason |
|------|------|--------|
| `Branches/StackFastold/` | Large | Archive dump, contains .zip, duplicated old code |
| `Branches/StackFast1/` | Medium | Older predecessor, no unique value |
| `Branches/StackfastPro/StackFast-101/` | Large | Embedded nested clone inside Pro branch |

### Services to Delete

| Path | Reason |
|------|--------|
| `developer-tools-api/` | Duplicate Flask API, hardcoded secret, open CORS, no auth |
| `WebAILyzerAPI/cmd/wappalyzer-server/` | Older duplicate server path (keep only `cmd/webailyzer-api` if retaining) |

### Files to Delete

| Pattern | Reason |
|---------|--------|
| `**/desktop.ini` | Windows metadata noise |
| `.env`, `.env.fixed` | Secrets in source tree |
| `.local/` | Replit local state |
| `.vs/` | Visual Studio local state |
| `**/node_modules/` (under branches) | Generated dependency folders |
| `**/dist/` (under branches) | Generated build output |
| All stale route files (`routes-broken.ts`, `routes-backup.ts`, `routes-original.ts`) | Confusion-generating snapshots |

### Docs to Delete

| File | Reason |
|------|--------|
| `Referencedocs/STACKFAST_MERGER_SUCCESS.md` | Historical celebration doc |
| `Referencedocs/PHASE2_COMPLETE.md` | Stale milestone |
| `Referencedocs/PHASE3_PROGRESS.md` | Stale milestone |
| `Referencedocs/PHASE4_COMPLETE.md` | Claims endpoints that don't exist |
| `Referencedocs/CODEBASE_REVIEW.md` | Contradictory and unreliable |

---

## Post-Extraction Cleanup

Completed on 2026-05-11. The following were removed from the main working tree
(all preserved on `origin/archive/pre-rebuild` if ever needed):

1. Root `client/` (old React app — 104 files)
2. Root `server/` (old Express/Drizzle server — 19 files)
3. Root `shared/schema.ts` (migrated to `packages/schemas/src/db.ts`)
4. `Branches/StackFast-101/`, `Branches/StackfastPro/` (orphan submodule
   gitlinks — no `.gitmodules` ever existed, so git couldn't hydrate them)
5. `Branches/StackWiseAI/` (inspiration-only, concepts already documented)
6. `WebAILyzerAPI/` (orphan submodule gitlink; SHA preserved in
   `docs/deferred/webailyzer.md` for post-MVP revival)
7. `Referencedocs/` — `INTEGRATION_PLAN.md` moved to `docs/backlog/`,
   `README_CI_DOCKER.md` dropped (superseded by current CI workflow)
8. Root build configs: `vite.config.ts`, `tailwind.config.ts`, `tsconfig.json`,
   `postcss.config.js`, `drizzle.config.ts`, `components.json` (each app now
   owns its own config)
9. Root `Dockerfile` (npm-based, port 5000 — will be rewritten for monorepo
   deployment in Phase 8)
10. Root `package-lock.json` (monorepo uses `pnpm-lock.yaml`)
11. `attached_assets/` (legacy screenshots and docs — 23 files, 5.8MB)
12. `fix-scores.js`, `export.csv`, `dev.log`, `run.log` (stale debris)

The repository now contains only:
```
stackfast/
├── apps/web/
├── apps/api/
├── packages/{registry,rules-engine,schemas,exporter,ai,shared}/
├── docs/{decisions,backlog,deferred}/
├── tests/e2e/
├── scripts/
├── .github/workflows/
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── .env.example
├── .gitignore
├── Agents.md
├── readme.md
├── ROADMAP.md
└── SALVAGE_MANIFEST.md
```

After all files are extracted to their new locations:

1. Delete `Branches/StackFast-101/` (no longer needed as reference)
2. Delete `Branches/StackWiseAI/` (product concepts already documented)
3. Delete root `client/`, `server/`, `shared/` (replaced by `apps/` and `packages/`)
4. Delete root build configs (`vite.config.ts`, `tailwind.config.ts`, `tsconfig.json`, `postcss.config.js`, `drizzle.config.ts`, `components.json`)
5. Delete root `package.json` and `package-lock.json` (replaced by workspace root)
6. Delete `fix-scores.js`, `export.csv`, `dev.log`, `run.log`, `.replit`, `replit.md`
7. Delete `Dockerfile` (replaced by new deployment config)
8. Delete `attached_assets/` (if nothing unique)

The repository should contain only:
```
stackfast/
├── apps/web/
├── apps/api/
├── packages/registry/
├── packages/rules-engine/
├── packages/schemas/
├── packages/exporter/
├── packages/ai/
├── packages/shared/
├── workers/webailyzer/ (optional)
├── docs/
├── scripts/
├── .github/
├── Agents.md
├── README.md
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── .env.example
├── .gitignore
└── Stackfast2026.md (archive/reference)
```
