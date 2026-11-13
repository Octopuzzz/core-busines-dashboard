import type { NextRequest } from "next/server";
import { getUsers, jiraConfigured } from "@/lib/jira/server";
import { errorResponse } from "../../_util";

export async function POST(req: NextRequest) {
  let ids: unknown;
  try {
    ({ accountIds: ids } = await req.json());
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  if (
    !Array.isArray(ids) ||
    ids.length > 200 ||
    !ids.every((id) => typeof id === "string" && /^[A-Za-z0-9:_-]+$/.test(id))
  ) {
    return Response.json(
      { error: "Expected { accountIds: string[] } (max 200)." },
      { status: 400 },
    );
  }
  if (!(await jiraConfigured())) return Response.json({ users: [] });
  try {
    return Response.json({ users: await getUsers(ids as string[]) });
  } catch (e) {
    return errorResponse(e);
  }
}
