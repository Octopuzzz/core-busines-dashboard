import {
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import type { TeamSettings } from "@/lib/groups/store";

export const teams = pgTable("teams", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  color: text("color").notNull(),
  settings: jsonb("settings").$type<TeamSettings>(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const teamMembers = pgTable(
  "team_members",
  {
    teamId: text("team_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    name: text("name").notNull(),
    accountId: text("account_id"),
    displayName: text("display_name"),
    email: text("email"),
    avatarUrl: text("avatar_url"),
    source: text("source"),
  },
  (t) => [
    primaryKey({ columns: [t.teamId, t.name] }),
    index("team_members_account_idx").on(t.accountId),
  ],
);

export const savedViews = pgTable(
  "saved_views",
  {
    id: uuid("id").primaryKey(),
    teamId: text("team_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    settings: jsonb("settings").$type<TeamSettings>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("saved_views_team_idx").on(t.teamId)],
);

export const savedQueries = pgTable("saved_queries", {
  id: uuid("id").primaryKey(),
  name: text("name").notNull().unique(),
  settings: jsonb("settings").$type<TeamSettings>().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const appConfig = pgTable("app_config", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const ENSURE_SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS teams (
  id text PRIMARY KEY,
  name text NOT NULL,
  color text NOT NULL,
  settings jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS team_members (
  team_id text NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  position integer NOT NULL,
  name text NOT NULL,
  account_id text,
  display_name text,
  email text,
  avatar_url text,
  source text,
  PRIMARY KEY (team_id, name)
);
CREATE INDEX IF NOT EXISTS team_members_account_idx ON team_members(account_id);
CREATE TABLE IF NOT EXISTS saved_views (
  id uuid PRIMARY KEY,
  team_id text NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  name text NOT NULL,
  settings jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS saved_views_team_idx ON saved_views(team_id);
CREATE TABLE IF NOT EXISTS saved_queries (
  id uuid PRIMARY KEY,
  name text NOT NULL UNIQUE,
  settings jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
WITH moved AS (DELETE FROM saved_views RETURNING id, name, settings, created_at)
INSERT INTO saved_queries (id, name, settings, created_at, updated_at)
SELECT id, name, settings, created_at, created_at FROM moved
ON CONFLICT DO NOTHING;
CREATE TABLE IF NOT EXISTS app_config (
  key text PRIMARY KEY,
  value text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
`;
