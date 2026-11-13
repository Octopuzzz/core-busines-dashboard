import "server-only";
import { asc, eq, inArray } from "drizzle-orm";
import { ensureSchema, getDb } from "@/lib/db";
import { savedViews, teamMembers, teams } from "@/lib/db/schema";
import { DEFAULT_TEAMS } from "@/config/teams";
import { series } from "@/design/tokens";
import { DEFAULT_SETTINGS, type Group, type Member } from "./store";

function toGroup(
  team: typeof teams.$inferSelect,
  members: (typeof teamMembers.$inferSelect)[],
  views: (typeof savedViews.$inferSelect)[],
): Group {
  return {
    id: team.id,
    name: team.name,
    color: team.color,
    settings: team.settings ?? DEFAULT_SETTINGS,
    members: members
      .sort((a, b) => a.position - b.position)
      .map((member): Member => ({
        name: member.name,
        source: (member.source as Member["source"]) ?? undefined,
        person: member.accountId
          ? {
              accountId: member.accountId,
              displayName: member.displayName ?? member.name,
              email: member.email ?? undefined,
              avatarUrl: member.avatarUrl ?? undefined,
            }
          : undefined,
      })),
    views: views
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
      .map((view) => ({
        id: view.id,
        name: view.name,
        settings: view.settings,
        createdAt: view.createdAt.toISOString(),
      })),
    createdAt: team.createdAt.toISOString(),
    updatedAt: team.updatedAt.toISOString(),
  };
}

async function seedDefaults() {
  const db = getDb();
  const configuredIds = DEFAULT_TEAMS.map((config) => config.id);
  const existing = await db
    .select({ id: teams.id })
    .from(teams)
    .where(inArray(teams.id, configuredIds));
  const existingIds = new Set(existing.map((row) => row.id));
  for (const [index, config] of DEFAULT_TEAMS.entries()) {
    if (existingIds.has(config.id)) continue;
    await saveTeam({
      id: config.id,
      name: config.name,
      color: series[index % series.length],
      settings: DEFAULT_SETTINGS,
      views: [],
      members: config.members.map((member) =>
        member.accountId
          ? {
              name: member.name,
              source: "jira",
              person: { accountId: member.accountId, displayName: member.name },
            }
          : { name: member.name },
      ),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }
}

export async function listTeams(): Promise<Group[]> {
  await ensureSchema();
  await seedDefaults();
  const db = getDb();
  const [teamRows, memberRows, viewRows] = await Promise.all([
    db.select().from(teams).orderBy(asc(teams.createdAt)),
    db.select().from(teamMembers),
    db.select().from(savedViews),
  ]);
  return teamRows.map((team) =>
    toGroup(
      team,
      memberRows.filter((member) => member.teamId === team.id),
      viewRows.filter((view) => view.teamId === team.id),
    ),
  );
}

export async function saveTeam(team: Group): Promise<void> {
  await ensureSchema();
  const db = getDb();
  await db.transaction(async (tx) => {
    const now = new Date();
    await tx
      .insert(teams)
      .values({
        id: team.id,
        name: team.name,
        color: team.color,
        settings: team.settings ?? DEFAULT_SETTINGS,
        createdAt: new Date(team.createdAt || now),
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: teams.id,
        set: {
          name: team.name,
          color: team.color,
          settings: team.settings ?? DEFAULT_SETTINGS,
          updatedAt: now,
        },
      });

    await tx.delete(teamMembers).where(eq(teamMembers.teamId, team.id));
    const seen = new Set<string>();
    const members = team.members.filter(
      (member) => !seen.has(member.name) && seen.add(member.name),
    );
    if (members.length) {
      await tx.insert(teamMembers).values(
        members.map((member, position) => ({
          teamId: team.id,
          position,
          name: member.name,
          accountId: member.person?.accountId ?? null,
          displayName: member.person?.displayName ?? null,
          email: member.person?.email ?? null,
          avatarUrl: member.person?.avatarUrl ?? null,
          source: member.source ?? null,
        })),
      );
    }

    await tx.delete(savedViews).where(eq(savedViews.teamId, team.id));
    if (team.views?.length) {
      await tx.insert(savedViews).values(
        team.views.map((view) => ({
          id: view.id,
          teamId: team.id,
          name: view.name,
          settings: view.settings,
          createdAt: new Date(view.createdAt || now),
        })),
      );
    }
  });
}

export async function deleteTeam(id: string): Promise<void> {
  await ensureSchema();
  await getDb().delete(teams).where(eq(teams.id, id));
}
