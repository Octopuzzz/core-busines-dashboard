import { JiraError } from "@/lib/jira/server";

/** Short, user-facing explanations for the Jira errors people actually hit. */
const HINTS: Record<number, string> = {
  400: "Jira rejected the query (check the advanced JQL).",
  401: "Jira rejected the credentials — check JIRA_EMAIL / JIRA_API_TOKEN.",
  429: "Jira rate limit reached — wait a moment and retry.",
};

/** Turns a thrown error into a JSON response with a short hint. */
export function errorResponse(error: unknown) {
  if (error instanceof JiraError) {
    const hint = HINTS[error.status] ?? "Jira request failed.";
    // 401 is passed through so the browser can show "login rejected"; everything else is a 502.
    const status = error.status === 401 ? 401 : 502;
    return Response.json({ error: hint, status: error.status, detail: error.body }, { status });
  }
  console.error(error);
  return Response.json({ error: "Unexpected server error." }, { status: 500 });
}
