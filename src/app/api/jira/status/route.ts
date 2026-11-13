import { connection } from "next/server";
import { JiraError, jiraConfigured, whoAmI } from "@/lib/jira/server";

export async function GET() {
  await connection(); // live data: never pre-render at build time
  if (!jiraConfigured())
    return Response.json({ configured: false, site: null, authOk: false, error: null });
  const site = process.env.JIRA_BASE_URL ?? null;
  try {
    const me = await whoAmI();
    return Response.json({
      configured: true,
      site,
      authOk: true,
      user: me.displayName,
      error: null,
    });
  } catch (e) {
    const error =
      e instanceof JiraError && e.status === 401
        ? "Jira rejected the login (401). Check that JIRA_EMAIL is the account that created JIRA_API_TOKEN, and that the token hasn't been revoked."
        : e instanceof JiraError
          ? `Jira responded ${e.status}.`
          : "Could not reach Jira.";
    return Response.json({ configured: true, site, authOk: false, error });
  }
}
