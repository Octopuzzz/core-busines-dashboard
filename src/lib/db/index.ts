import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import "server-only";
import * as schema from "./schema";

export const dbConfigured = () =>
  Boolean(process.env.DATABASE_URL?.trim().replace(/^["']|["']$/g, ""));

const processCache = globalThis as unknown as {
  __pgPool?: Pool;
  __db?: NodePgDatabase<typeof schema>;
  __schemaReady?: Promise<void>;
  __currentUrl?: string;
};

export function getDb() {
  const url = process.env.DATABASE_URL?.trim().replace(/^["']|["']$/g, "");
  if (!processCache.__db || processCache.__currentUrl !== url) {
    if (processCache.__pgPool) {
      processCache.__pgPool.end().catch(() => {});
    }
    processCache.__currentUrl = url;
    processCache.__pgPool = new Pool({
      connectionString: url,
      max: 5,
      connectionTimeoutMillis: 8000,
      idleTimeoutMillis: 30_000,
    });
    processCache.__pgPool.on("error", (err) => {
      console.error("[db] unexpected pool error:", err.message);
    });
    processCache.__db = drizzle(processCache.__pgPool, { schema });
    processCache.__schemaReady = undefined;
  }
  return processCache.__db;
}

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

export function dbErrorMessage(e: unknown): string {
  const err = e as { code?: string; message?: string };
  if (err?.code === "28P01")
    return "Database rejected the login — check the user and password in DATABASE_URL.";
  if (err?.code === "3D000") return "Database name in DATABASE_URL doesn't exist.";
  if (err?.code === "42501") return "Database user lacks permission to create or write the tables.";
  if (err?.code === "ECONNREFUSED" || err?.code === "ETIMEDOUT" || err?.code === "ENOTFOUND")
    return "Can't reach the database host/port in DATABASE_URL.";
  return err?.message ? `Database error: ${err.message}` : "Database error.";
}
