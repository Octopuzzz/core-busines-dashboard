import type { NextRequest } from "next/server";
import { dbConfigured, dbErrorMessage } from "@/lib/db";
import { deleteTeam, saveTeam } from "@/lib/groups/server";
import type { Group } from "@/lib/groups/store";
import { DEFAULT_TEAMS } from "@/config/teams";

/** Team ids: config ids like "core-engineering", or UUIDs for teams made in the app. */
const ID = /^[A-Za-z0-9_-]{1,64}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const MAX_MEMBERS = 200;
const MAX_VIEWS = 100;

/** Returns a problem description, or null when the team looks valid. */
function validationProblem(team: Group, id: string): string | null {
  if (!team || typeof team !== "object" || team.id !== id) return "Body id must match the URL.";

  const nameOk = typeof team.name === "string" && team.name.trim() && team.name.length <= 120;
  if (!nameOk) return "Invalid team name.";

  if (!Array.isArray(team.members) || team.members.length > MAX_MEMBERS) return "Invalid members.";
  const badMember = team.members.some(
    (member) => typeof member?.name !== "string" || member.name.length > 160,
  );
  if (badMember) return "Invalid member.";

  if (team.views) {
    const viewsOk =
      Array.isArray(team.views) &&
      team.views.length <= MAX_VIEWS &&
      team.views.every((view) => UUID.test(view.id) && typeof view.name === "string");
    if (!viewsOk) return "Invalid saved views.";
  }
  return null;
}

/** Create or replace a team (members and saved views included). */
export async function PUT(req: NextRequest, ctx: RouteContext<"/api/teams/[id]">) {
  const { id } = await ctx.params;
  if (!ID.test(id)) return Response.json({ error: "Invalid id." }, { status: 400 });
  if (!dbConfigured()) return Response.json({ error: "No database configured." }, { status: 503 });
  let team: Group;
  try {
    team = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const problem = validationProblem(team, id);
  if (problem) return Response.json({ error: problem }, { status: 400 });
  try {
    await saveTeam(team);
    return Response.json({ ok: true });
  } catch (e) {
    console.error("[db] save team", (e as { code?: string }).code, (e as Error).message);
    return Response.json({ error: dbErrorMessage(e) }, { status: 500 });
  }
}

/** Delete a team made in the app. Teams from src/config/teams.ts can't be deleted. */
export async function DELETE(_req: NextRequest, ctx: RouteContext<"/api/teams/[id]">) {
  const { id } = await ctx.params;
  if (!ID.test(id)) return Response.json({ error: "Invalid id." }, { status: 400 });
  if (DEFAULT_TEAMS.some((t) => t.id === id))
    return Response.json({ error: "Saved teams from config can't be deleted." }, { status: 400 });
  if (!dbConfigured()) return Response.json({ error: "No database configured." }, { status: 503 });
  try {
    await deleteTeam(id);
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ error: dbErrorMessage(e) }, { status: 500 });
  }
}
