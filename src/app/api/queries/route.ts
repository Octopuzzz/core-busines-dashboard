import { connection } from "next/server";
import { dbConfigured, dbErrorMessage } from "@/lib/db";
import { listQueries } from "@/lib/queries/server";

export async function GET() {
  await connection();
  if (!dbConfigured()) return Response.json({ configured: false, queries: [] }, { status: 503 });
  try {
    return Response.json({ configured: true, queries: await listQueries() });
  } catch (e) {
    console.error("[db] list queries", (e as { code?: string }).code, (e as Error).message);
    return Response.json({ configured: true, error: dbErrorMessage(e) }, { status: 500 });
  }
}
