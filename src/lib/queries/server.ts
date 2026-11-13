import "server-only";
import { and, asc, eq, ne } from "drizzle-orm";
import { ensureSchema, getDb } from "@/lib/db";
import { savedQueries } from "@/lib/db/schema";
import type { SavedView } from "@/lib/groups/store";

const toSavedQuery = (row: typeof savedQueries.$inferSelect): SavedView => ({
  id: row.id,
  name: row.name,
  settings: row.settings,
  createdAt: row.createdAt.toISOString(),
});

export async function listQueries(): Promise<SavedView[]> {
  await ensureSchema();
  const rows = await getDb().select().from(savedQueries).orderBy(asc(savedQueries.name));
  return rows.map(toSavedQuery);
}

export async function saveQuery(query: SavedView): Promise<void> {
  await ensureSchema();
  const db = getDb();
  const now = new Date();
  await db.transaction(async (tx) => {
    await tx
      .delete(savedQueries)
      .where(and(eq(savedQueries.name, query.name), ne(savedQueries.id, query.id)));
    await tx
      .insert(savedQueries)
      .values({
        id: query.id,
        name: query.name,
        settings: query.settings,
        createdAt: new Date(query.createdAt || now),
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: savedQueries.id,
        set: { name: query.name, settings: query.settings, updatedAt: now },
      });
  });
}

export async function deleteQuery(id: string): Promise<void> {
  await ensureSchema();
  await getDb().delete(savedQueries).where(eq(savedQueries.id, id));
}
