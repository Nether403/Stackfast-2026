import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "@stackfast/schemas/db";

let _db: ReturnType<typeof createDrizzle> | null = null;

function createDrizzle() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL is not set. The API can run in catalog-only mode, " +
        "but database features (seed, auth, blueprint history) require a Neon connection string.",
    );
  }
  const sql = neon(url);
  return drizzle(sql, { schema });
}

/**
 * Get or create the Drizzle database client.
 * Throws if DATABASE_URL is not configured.
 */
export function getDb() {
  if (!_db) {
    _db = createDrizzle();
  }
  return _db;
}

/**
 * Returns true if DATABASE_URL is configured, false otherwise.
 * Use this to guard database-dependent code paths so the API
 * can still serve catalog-only requests without a database.
 */
export function isDatabaseAvailable(): boolean {
  return !!process.env.DATABASE_URL;
}

export type Db = ReturnType<typeof getDb>;
