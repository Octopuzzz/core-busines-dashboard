import { JiraError } from "@/lib/jira/server";

const HINTS: Record<number, string> = {
  400: "Jira rejected the query (check the advanced JQL).",
  401: "Jira rejected the credentials — check JIRA_EMAIL / JIRA_API_TOKEN.",
  429: "Jira rate limit reached — wait a moment and retry.",
};

export function errorResponse(error: unknown) {
  if (error instanceof JiraError) {
    const hint = HINTS[error.status] ?? "Jira request failed.";
    const status = error.status === 401 ? 401 : 502;
    return Response.json({ error: hint, status: error.status, detail: error.body }, { status });
  }
  console.error(error);
  return Response.json({ error: "Unexpected server error." }, { status: 500 });
}
