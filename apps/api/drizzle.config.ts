import { defineConfig } from "drizzle-kit";

/**
 * Drizzle Kit config for the Stackfast API service.
 *
 * This config is consumed by `drizzle-kit push`, which is wrapped by the
 * one-shot migration runner at `scripts/deploy/migrate.ts` (Phase 8, R2.4).
 *
 * Decision (design.md § "Open questions" item 2): Phase 8 uses `drizzle-kit
 * push` rather than `drizzle-kit migrate`. The repo has no `drizzle/`
 * migration history yet, and inventing one just to run `migrate` adds process
 * weight without value. Promote to `migrate` (and add an `out` migrations
 * folder) once the first real migration history appears post-MVP.
 *
 * The schema lives in the shared `@stackfast/schemas` package. `drizzle-kit`
 * loads the schema by file path (not module specifier), so this points at the
 * source file relative to this config's directory (apps/api).
 */
export default defineConfig({
  dialect: "postgresql",
  // Relative to apps/api — resolves to packages/schemas/src/db.ts.
  schema: "../../packages/schemas/src/db.ts",
  // `out` is only used by `drizzle-kit generate`/`migrate`. Declared here so a
  // future switch to migration files has a home; `push` ignores it.
  out: "./drizzle",
  dbCredentials: {
    // The migration runner validates this is set before invoking drizzle-kit,
    // and waits for the connection to come up (R2.3) before pushing.
    url: process.env.DATABASE_URL ?? "",
  },
  // Surface the SQL drizzle-kit intends to run. The runner adds `--strict` in
  // --dry-run mode so nothing is applied without explicit approval.
  verbose: true,
});
