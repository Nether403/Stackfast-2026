# ADR-001: Authentication Strategy — Neon Auth with GitHub OAuth

## Status
**Accepted** — 2026-05-09

## Context

Stackfast needs authentication for two purposes:
1. **User authentication** — GitHub OAuth login for saving blueprints and projects
2. **Admin protection** — Protect mutation endpoints (`/admin/*`, `/internal/*`)

### Constraints
- Target audience is developers → GitHub OAuth is the natural fit
- Already using Neon Postgres for the database → adding another platform (Clerk, Supabase) just for auth is undesirable
- Railway is the deployment target → Railway has no built-in auth service
- Must work with Postgres Row-Level Security for future data isolation

### Options Considered

| Option | Pros | Cons |
|--------|------|------|
| **Neon Auth (Better Auth)** | Auth data lives in Neon Postgres, branch-aware, supports GitHub OAuth natively, no new platform | Newer service, less community examples than Clerk |
| **Clerk** | Mature, excellent DX, many providers | Adds another platform, costs money at scale, data lives outside your DB |
| **GitHub OAuth (raw)** | No dependencies, full control | Must build session management, token storage, refresh logic yourself |
| **Supabase Auth** | Mature, free tier | Would add Supabase just for auth while using Neon for DB — messy |

## Decision

Use **Neon Auth (Better Auth)** with **GitHub OAuth** as the primary social provider.

### Rationale

1. **Neon Auth has dramatically improved** (May 2026 — built on Better Auth framework):
   - Auth data stored directly in Neon Postgres in a `neon_auth` schema
   - Branch-aware: auth state branches with your database (dev/staging isolation)
   - Native RLS integration for row-level access control
   - Managed REST API — no external auth infrastructure to maintain
   - GitHub OAuth configured directly in the Neon Console

2. **Zero new platforms**: Since we're already using Neon Postgres, auth comes for free
3. **Developer audience fit**: GitHub OAuth is the expected login method
4. **Future-proof**: Neon Auth supports adding more providers (Google, email/password) post-MVP

### Admin Protection
Admin routes (`/admin/*`, `/internal/*`) use a simple **API key** validated via middleware. This is separate from user auth and is sufficient for MVP where only the project owner needs admin access.

## Consequences

### Positive
- Auth data lives alongside application data (single source of truth)
- No additional platform costs or vendor lock-in
- Branch-aware auth enables proper dev/staging testing
- Can add email/password and Google OAuth later without changing architecture

### Negative
- Neon Auth is newer than Clerk/Auth0 — less community support and examples
- Tied to Neon as database provider (acceptable since we chose Neon already)
- Must generate Better Auth schema tables via CLI (`npx better-auth@latest generate`)

### Implementation Notes
- Configure GitHub OAuth App credentials in Neon Console
- Add `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET` to `.env.example`
- Use Better Auth client SDK in `apps/web/` for login UI
- Validate sessions in `apps/api/` middleware using Better Auth server SDK
- Admin API key is a separate `ADMIN_API_KEY` environment variable
