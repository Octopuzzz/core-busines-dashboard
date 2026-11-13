/**
 * Liveness check for Docker / load balancers. Deliberately doesn't call Jira or the database,
 * so an outage there doesn't get the container restarted in a loop.
 */

import { connection } from "next/server";
export async function GET() {
  await connection(); // answer each request live, not from a build-time snapshot
  return Response.json({ ok: true });
}
