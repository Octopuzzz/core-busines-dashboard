import type { NextRequest } from "next/server";
import { jiraConfigured, searchIssues, buildJql } from "@/lib/jira/server";
import { sampleIssues } from "@/lib/jira/sample";
import type { IssueQuery, IssueResponse } from "@/lib/jira/types";
import { errorResponse } from "../_util";

export async function POST(req: NextRequest) {
  let query: IssueQuery;
  try {
    query = (await req.json()) as IssueQuery;
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  if (!Array.isArray(query.accountIds) || query.accountIds.length === 0) {
    return Response.json({
      source: (await jiraConfigured()) ? "jira" : "sample",
      issues: [],
      truncated: false,
      jql: "",
    } satisfies IssueResponse);
  }
  if (query.accountIds.length > 200)
    return Response.json({ error: "Too many people (max 200)." }, { status: 400 });

  if (!(await jiraConfigured())) {
    return Response.json({
      source: "sample",
      issues: sampleIssues(query),
      truncated: false,
      jql: buildJql(query),
    } satisfies IssueResponse);
  }
  try {
    const result = await searchIssues(query);
    return Response.json({ source: "jira", ...result } satisfies IssueResponse);
  } catch (e) {
    return errorResponse(e);
  }
}
