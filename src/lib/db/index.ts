import "server-only";
import { Pool } from "pg";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "./schema";

export const dbConfigured = () => Boolean(process.env.DATABASE_URL?.trim());

// One pool per server process (survives Next dev hot reloads).
const processCache = globalThis as unknown as {
  __pgPool?: Pool;
  __db?: NodePgDatabase<typeof schema>;
  __schemaReady?: Promise<void>;
};

export function getDb() {
  if (!processCache.__db) {
    processCache.__pgPool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 5,
      connectionTimeoutMillis: 8000,
      idleTimeoutMillis: 30_000,
    });
    processCache.__db = drizzle(processCache.__pgPool, { schema });
  }
  return processCache.__db;
}

/** Creates the tables on first use. Retries on the next call if it failed. */
export function ensureSchema(): Promise<void> {
  if (!processCache.__schemaReady) {
    getDb();
    processCache.__schemaReady = processCache.__pgPool!.query(schema.ENSURE_SCHEMA_SQL).then(
      () => undefined,
      (e) => {
        processCache.__schemaReady = undefined;
        throw e;
      },
    );
  }
  return processCache.__schemaReady;
}

/** Short, safe error text for API responses (never includes the connection string). */
export function dbErrorMessage(e: unknown): string {
  const code = (e as { code?: string })?.code;
  if (code === "28P01")
    return "Database rejected the login — check the user and password in DATABASE_URL.";
  if (code === "3D000") return "Database name in DATABASE_URL doesn't exist.";
  if (code === "42501") return "Database user lacks permission to create or write the tables.";
  if (code === "ECONNREFUSED" || code === "ETIMEDOUT" || code === "ENOTFOUND")
    return "Can't reach the database host/port in DATABASE_URL.";
  return "Database error.";
}
