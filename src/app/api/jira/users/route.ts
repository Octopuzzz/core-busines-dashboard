import type { NextRequest } from "next/server";
import { jiraConfigured, searchUsers } from "@/lib/jira/server";
import { sampleUsers } from "@/lib/jira/sample";
import { errorResponse } from "../_util";

export async function GET(req: NextRequest) {
  const query = (req.nextUrl.searchParams.get("q") ?? "").trim();
  if (!jiraConfigured()) return Response.json({ source: "sample", users: sampleUsers(query) });
  if (query.length < 2) return Response.json({ source: "jira", users: [] });
  try {
    return Response.json({ source: "jira", users: await searchUsers(query) });
  } catch (e) {
    return errorResponse(e);
  }
}
