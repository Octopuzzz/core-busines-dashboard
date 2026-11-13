import { connection } from "next/server";
import { dbConfigured, dbErrorMessage } from "@/lib/db";
import { listTeams } from "@/lib/groups/server";

export async function GET() {
  await connection();
  if (!dbConfigured()) return Response.json({ configured: false, teams: [] }, { status: 503 });
  try {
    return Response.json({ configured: true, teams: await listTeams() });
  } catch (e) {
    console.error("[db] list teams", (e as { code?: string }).code, (e as Error).message);
    return Response.json({ configured: true, error: dbErrorMessage(e) }, { status: 500 });
  }
}
