import { connection } from "next/server";
import { jiraConfigured, listProjects } from "@/lib/jira/server";
import { SAMPLE_PROJECTS } from "@/lib/jira/sample";
import { errorResponse } from "../_util";

export async function GET() {
  await connection(); // live data: never pre-render at build time
  if (!jiraConfigured()) return Response.json({ source: "sample", projects: SAMPLE_PROJECTS });
  try {
    return Response.json({ source: "jira", projects: await listProjects() });
  } catch (e) {
    return errorResponse(e);
  }
}
