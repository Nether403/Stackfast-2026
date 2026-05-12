# ADR-001: Authentication Strategy — Better Auth with GitHub OAuth

## Status
**Accepted** — 2026-05-09 (original)
**Revised** — 2026-05-11 (correcting factual errors in the original decision)

## Context

Stackfast needs authentication for two purposes:
1. **User authentication** — GitHub OAuth login for saving blueprints and projects
2. **Admin protection** — Protect mutation endpoints (`/admin/*`, `/internal/*`)

### Constraints

- Target audience is developers → GitHub OAuth is the natural fit
- Using Neon Postgres for the database → adding another managed auth platform just for users is undesirable
- Railway is the deployment target → no built-in auth service
- Must work with Postgres Row-Level Security for future data isolation
- Our backend is a **Hono** API in `apps/api/`, not Next.js
- Our frontend is **Vite + wouter** in `apps/web/`, not Next.js

### Factual clarification (correcting the original ADR)

The original version of this ADR claimed "Neon Auth is built on the Better Auth framework." That is incorrect.

- **Neon Auth** is an integration between Neon and [Stack Auth](https://stack-auth.com) (`@stackframe/stack`). When you enable Neon Auth in the Neon Console, a Stack Auth tenant is provisioned and the `neon_auth.users_sync` table is created in your Postgres. User records live on Stack Auth's hosted servers; Neon mirrors a read-only copy into your database via sync.
- **Better Auth** (`better-auth`) is a separate framework-agnostic TypeScript auth library. It stores all authentication data directly in your own Postgres in `user`, `session`, `account`, and `verification` tables. It is not affiliated with Neon or Stack Auth.

Neither is "Neon native" in a strict sense. Stack Auth is Neon's official partner integration. Better Auth stores everything in your own Neon database.

### Options Considered

| Option | Pros | Cons |
|--------|------|------|
| **Stack Auth (via Neon Auth)** | Neon-provisioned, managed UI flows, `users_sync` in Postgres, one-click setup in Neon Console | Primarily targeted at Next.js App Router. Source of truth lives on Stack Auth's servers — you do not fully own the data. Hono and Vite integration is manual. |
| **Better Auth** | Framework-agnostic with first-class Hono support, all data in your own Neon Postgres, branch-aware (auth rows branch with your DB), Drizzle adapter, works identically in dev and production | Younger than Clerk/Auth0 in non-Next stacks. Less Neon Console tooling. |
| **Clerk** | Mature, polished DX, many providers | External platform, priced at scale, auth data lives outside your DB |
| **Supabase Auth** | Mature, free tier | Would add Supabase just for auth while using Neon for data — messy |
| **GitHub OAuth (raw)** | Zero dependencies | Must build session management, token storage, CSRF, refresh ourselves |

## Decision

Use **Better Auth** (`better-auth`) with **GitHub OAuth** as the primary social provider.

### Rationale

1. **Stack fit.** Our API is Hono and our frontend is Vite + wouter. Better Auth drops directly into Hono with `app.on(["GET","POST"], "/api/auth/*", c => auth.handler(c.req.raw))`. Stack Auth's strongest story is Next.js App Router; outside of that its integration is noticeably thinner.
2. **Data ownership.** All auth data — users, sessions, OAuth accounts, verification tokens — lives in four tables in our Neon Postgres. Drizzle queries and RLS policies work the same as for any other table. With Stack Auth, the source of truth lives on a third-party server and the `users_sync` copy is read-only.
3. **Branch-aware auth.** Because Better Auth tables are regular Postgres tables, Neon branches carry the auth state with them. Dev branches naturally get dev-scoped users.
4. **Zero lock-in.** Better Auth is an npm library. If we ever replace it, we own the tables.
5. **Works identically in dev and prod.** No tenant provisioning, no cross-origin cookie surprises, no differences between local and deployed behavior.

### Admin Protection

Admin routes (`/admin/*`, `/internal/*`) use a simple **API key** validated via middleware. This is separate from user auth and is sufficient for MVP where only the project owner needs admin access.

## Consequences

### Positive

- Auth data lives alongside application data (single source of truth)
- No external auth platform, no additional vendor cost
- Branch-aware auth enables clean dev/staging testing
- Can add email/password, Google OAuth, passkeys later via Better Auth plugins without re-architecture

### Negative

- Must manage the schema (`user`, `session`, `account`, `verification`) as part of our own migrations
- Less ready-made admin UI than Clerk or Stack Auth (not needed for MVP)
- Small, unfamiliar dependency for teammates who haven't used Better Auth before

### Implementation Notes

- **Server:** `apps/api/src/middleware/auth.ts` wires Better Auth with `drizzleAdapter(db, { provider: "pg" })` and the GitHub social provider.
- **Client:** `apps/web/src/lib/auth-client.ts` exposes `signIn`, `signOut`, `useSession` from `better-auth/react`.
- **Schema:** Tables `user`, `session`, `account`, `verification` live in Neon Postgres `public` schema (see migration `002-better-auth-tables`).
- **GitHub OAuth callback:** `{BETTER_AUTH_URL}/api/auth/callback/github` (local: `http://localhost:3000/api/auth/callback/github`).
- **Environment:** `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`.
- **Admin:** `ADMIN_API_KEY` — separate from user sessions.

### Deferred

- The `neon_auth.users_sync` table provisioned by Neon Auth is unused and has been dropped.
- The `NEXT_PUBLIC_STACK_*` and `STACK_SECRET_SERVER_KEY` environment variables left over from the Neon Console provisioning have been removed from `.env`.
- Better Auth Cloud (optional hosted add-ons such as SSO and analytics) is not enabled. A Better Auth Cloud account/API key exists and is held for possible future use, but the MVP uses the self-hosted library only.
