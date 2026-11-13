import type { NextRequest } from "next/server";
import { jiraConfigured, resolveNames } from "@/lib/jira/server";
import { sampleResolve } from "@/lib/jira/sample";
import { errorResponse } from "../_util";

export async function POST(req: NextRequest) {
  let names: unknown;
  try {
    ({ names } = await req.json());
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  if (
    !Array.isArray(names) ||
    names.length > 100 ||
    !names.every((name) => typeof name === "string" && name.length < 120)
  ) {
    return Response.json({ error: "Expected { names: string[] } (max 100)." }, { status: 400 });
  }
  if (!jiraConfigured()) return Response.json({ source: "sample", results: sampleResolve(names) });
  try {
    return Response.json({ source: "jira", results: await resolveNames(names) });
  } catch (e) {
    return errorResponse(e);
  }
}
