import type { NextRequest } from "next/server";
import { buildJql, jiraConfigured, testJql } from "@/lib/jira/server";
import type { IssueQuery } from "@/lib/jira/types";
import { errorResponse } from "../_util";

const MAX_JQL_LENGTH = 4000;

interface Body {
  jql?: unknown;
  scope?: Omit<IssueQuery, "jql"> | null;
}

export async function POST(req: NextRequest) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const jql = typeof body.jql === "string" ? body.jql.trim() : "";
  if (!jql) return Response.json({ error: "Write a JQL query first." }, { status: 400 });
  if (jql.length > MAX_JQL_LENGTH)
    return Response.json({ error: "JQL is too long (max 4000 characters)." }, { status: 400 });

  if (!(await jiraConfigured()))
    return Response.json(
      { error: "Jira isn't connected, so the JQL can't be tested." },
      { status: 503 },
    );

  const scope = body.scope;
  const scoped =
    scope && Array.isArray(scope.accountIds) && scope.accountIds.length > 0
      ? buildJql({ ...scope, accountIds: scope.accountIds.slice(0, 200), jql })
      : jql;

  try {
    return Response.json(await testJql(scoped, jql));
  } catch (e) {
    return errorResponse(e);
  }
}
