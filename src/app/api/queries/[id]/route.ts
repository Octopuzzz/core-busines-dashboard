import type { NextRequest } from "next/server";
import { dbConfigured, dbErrorMessage } from "@/lib/db";
import type { SavedView } from "@/lib/groups/store";
import { deleteQuery, saveQuery } from "@/lib/queries/server";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PRESETS = new Set<unknown>([14, 30, 90, "year", "all"]);
const ISO_DATE = /^\d{4}-\d{2}-\d{2}/;

const isStringList = (value: unknown, max: number) =>
  Array.isArray(value) &&
  value.length <= max &&
  value.every((item) => typeof item === "string" && item.length <= 128);

function validationProblem(query: SavedView, id: string): string | null {
  if (!query || typeof query !== "object" || query.id !== id) return "Body id must match the URL.";
  if (typeof query.name !== "string" || !query.name.trim() || query.name.length > 80)
    return "Name must be 1–80 characters.";

  const settings = query.settings;
  if (!settings || typeof settings !== "object") return "Missing query settings.";
  if (typeof settings.search !== "string" || settings.search.length > 200) return "Invalid search.";
  if (typeof settings.jql !== "string" || settings.jql.length > 4000) return "Invalid JQL.";
  if (!isStringList(settings.people, 200)) return "Invalid people.";
  if (!isStringList(settings.projectKeys, 200)) return "Invalid projects.";

  const range = settings.range as Record<string, unknown> | undefined;
  const rangeOk =
    !!range &&
    (("preset" in range && PRESETS.has(range.preset)) ||
      (typeof range.from === "string" &&
        typeof range.to === "string" &&
        ISO_DATE.test(range.from) &&
        ISO_DATE.test(range.to)));
  return rangeOk ? null : "Invalid date range.";
}

export async function PUT(req: NextRequest, ctx: RouteContext<"/api/queries/[id]">) {
  const { id } = await ctx.params;
  if (!UUID.test(id)) return Response.json({ error: "Invalid id." }, { status: 400 });
  if (!dbConfigured()) return Response.json({ error: "No database configured." }, { status: 503 });
  let query: SavedView;
  try {
    query = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const problem = validationProblem(query, id);
  if (problem) return Response.json({ error: problem }, { status: 400 });
  try {
    await saveQuery({ ...query, name: query.name.trim() });
    return Response.json({ ok: true });
  } catch (e) {
    console.error("[db] save query", (e as { code?: string }).code, (e as Error).message);
    return Response.json({ error: dbErrorMessage(e) }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, ctx: RouteContext<"/api/queries/[id]">) {
  const { id } = await ctx.params;
  if (!UUID.test(id)) return Response.json({ error: "Invalid id." }, { status: 400 });
  if (!dbConfigured()) return Response.json({ error: "No database configured." }, { status: 503 });
  try {
    await deleteQuery(id);
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ error: dbErrorMessage(e) }, { status: 500 });
  }
}
