import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from "@shared/schema";

// Provide a safe fallback when DATABASE_URL is not configured.
// This prevents imports from throwing during development without a database.
export const pool = process.env.DATABASE_URL
  ? new Pool({ connectionString: process.env.DATABASE_URL })
  : (undefined as any);

export const db = process.env.DATABASE_URL
  ? drizzle(postgres(process.env.DATABASE_URL), { schema })
  : (new Proxy({}, {
      get() {
        throw new Error("DATABASE_URL must be set to use database-backed storage");
      }
    }) as any);