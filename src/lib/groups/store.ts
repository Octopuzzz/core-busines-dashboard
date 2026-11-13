/**
 * Team store (browser side).
 *
 * Teams — their members, last-used filters and saved views — live in Postgres (via /api/teams)
 * when the server has DATABASE_URL. The browser keeps a copy in localStorage as an offline cache,
 * and uses it as the only store when no database is configured.
 *
 * Saves are optimistic: the UI updates immediately, then the change is written to the database
 * in the background (debounced per team). React reads this store through useGroups().
 */
import type { JiraPerson } from "@/lib/jira/types";
import { DEFAULT_TEAMS } from "@/config/teams";
import { series } from "@/design/tokens";

/* -------------------------------------------------------------------------- */
/*  Types                                                                     */
/* -------------------------------------------------------------------------- */

/** A team member: the configured name, plus the Jira account once it is found. */
export interface Member {
  name: string;
  person?: JiraPerson;
  /** Where `person` came from — a "sample" match is redone once Jira is connected. */
  source?: "jira" | "sample";
}

/** Date range: a rolling preset (recomputed from today) or fixed dates. */
export type RangeSetting = { preset: 14 | 30 | 90 | "year" | "all" } | { from: string; to: string };

/** Everything that defines "the query" for a team. */
export interface TeamSettings {
  search: string;
  /** Account IDs to show; empty = everyone in the team. */
  people: string[];
  projectKeys: string[];
  range: RangeSetting;
  jql: string;
}

export interface SavedView {
  id: string;
  name: string;
  settings: TeamSettings;
  createdAt: string;
}

export interface Group {
  id: string;
  name: string;
  color: string;
  members: Member[];
  /** Last-used filters for this team — restored when the team is opened. */
  settings?: TeamSettings;
  /** Named queries saved for this team. */
  views?: SavedView[];
  createdAt: string;
  updatedAt: string;
}

export interface GroupRepository {
  list(): Group[];
  save(group: Group): void;
  remove(id: string): void;
  subscribe(listener: () => void): () => void;
}

export type StorageMode = "loading" | "database" | "browser" | "error";

export interface StorageStatus {
  mode: StorageMode;
  /** Set when the database is configured but failing. */
  error?: string;
  /** True while changes are waiting to be written to the database. */
  pending?: boolean;
}

export const DEFAULT_SETTINGS: TeamSettings = {
  search: "",
  people: [],
  projectKeys: [],
  range: { preset: 90 },
  jql: "",
};

/* -------------------------------------------------------------------------- */
/*  localStorage                                                              */
/* -------------------------------------------------------------------------- */

const CACHE_KEY = "kopnus.jira.teams.v3";
/** Older cache key from before settings/views existed — read once so linked avatars carry over. */
const LEGACY_CACHE_KEY = "kopnus.jira.teams.v2";
/** Set after this browser's teams were uploaded to the database the first time. */
const MIGRATED_KEY = "kopnus.jira.teams.migratedToDb";

const SAVE_DEBOUNCE_MS = 400;
const NO_GROUPS: Group[] = [];

/** localStorage can throw (private mode, blocked storage) — never let that break the app. */
const storage = {
  get(key: string): string | null {
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set(key: string, value: string) {
    try {
      window.localStorage.setItem(key, value);
    } catch {
      /* keep working in memory */
    }
  },
};

function readCachedGroups(): Group[] {
  try {
    const raw = storage.get(CACHE_KEY) ?? storage.get(LEGACY_CACHE_KEY);
    const parsed = raw ? (JSON.parse(raw) as Group[]) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/** The teams defined in src/config/teams.ts (e.g. Core Engineering), as fresh groups. */
function configuredTeams(): Group[] {
  const now = new Date().toISOString();
  return DEFAULT_TEAMS.map((team, index) => ({
    id: team.id,
    name: team.name,
    color: series[index % series.length],
    members: team.members.map((member): Member =>
      member.accountId
        ? {
            name: member.name,
            person: { accountId: member.accountId, displayName: member.name },
            source: "jira",
          }
        : { name: member.name },
    ),
    settings: DEFAULT_SETTINGS,
    views: [],
    createdAt: now,
    updatedAt: now,
  }));
}

/* -------------------------------------------------------------------------- */
/*  First-connection merge                                                    */
/* -------------------------------------------------------------------------- */

const withoutTimestamps = (group: Group) => ({
  ...group,
  createdAt: undefined,
  updatedAt: undefined,
});
const sameContent = (a: Group, b: Group) =>
  JSON.stringify(withoutTimestamps(a)) === JSON.stringify(withoutTimestamps(b));

/**
 * Combines the browser copy with what the database returned.
 *
 * Normally the database wins. The first time this browser connects, teams that exist only in
 * the browser — or were changed here more recently — are kept and returned in `toUpload`.
 */
function mergeWithDatabase(local: Group[], fromDatabase: Group[], firstConnection: boolean) {
  const remaining = new Map(fromDatabase.map((group) => [group.id, group]));
  const merged: Group[] = [];
  const toUpload: string[] = [];

  for (const localGroup of local) {
    const dbGroup = remaining.get(localGroup.id);
    remaining.delete(localGroup.id);

    const localIsNewer =
      !!dbGroup && localGroup.updatedAt > dbGroup.updatedAt && !sameContent(localGroup, dbGroup);
    const keepLocal = firstConnection && (!dbGroup || localIsNewer);

    if (keepLocal) {
      merged.push(localGroup);
      toUpload.push(localGroup.id);
    } else if (dbGroup) {
      merged.push(dbGroup);
    }
  }

  merged.push(...remaining.values()); // teams created from another browser
  return { merged, toUpload };
}

/* -------------------------------------------------------------------------- */
/*  Repository                                                                */
/* -------------------------------------------------------------------------- */

class SyncedGroupRepository implements GroupRepository {
  private groups: Group[] | null = null;
  private listeners = new Set<() => void>();
  private connectStarted = false;

  /** Status is replaced (never mutated) so React's useSyncExternalStore sees each change. */
  private status: StorageStatus = { mode: "loading" };

  /** Pending debounced saves, per team id. */
  private saveTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private savesInFlight = 0;

  /* ---------- reading ---------- */

  list(): Group[] {
    if (typeof window === "undefined") return NO_GROUPS;

    if (!this.groups) {
      // Start from the browser copy, adding any configured team it doesn't have yet.
      const cached = readCachedGroups();
      const missing = configuredTeams().filter((team) => !cached.some((g) => g.id === team.id));
      this.groups = [...missing, ...cached];
      if (missing.length) this.writeCache();
    }

    if (!this.connectStarted) {
      this.connectStarted = true;
      queueMicrotask(() => void this.connectToDatabase());
    }

    return this.groups;
  }

  getStatus = (): StorageStatus => this.status;

  subscribe(listener: () => void) {
    this.listeners.add(listener);

    // Another tab changed the cache — reload it here too.
    const onStorageEvent = (event: StorageEvent) => {
      if (event.key !== CACHE_KEY) return;
      this.groups = null;
      listener();
    };
    window.addEventListener("storage", onStorageEvent);

    return () => {
      this.listeners.delete(listener);
      window.removeEventListener("storage", onStorageEvent);
    };
  }

  /* ---------- writing ---------- */

  save(group: Group) {
    const updated = { ...group, updatedAt: new Date().toISOString() };
    const current = this.list();
    const exists = current.some((g) => g.id === group.id);

    this.groups = exists
      ? current.map((g) => (g.id === group.id ? updated : g))
      : [...current, updated];
    this.writeCache();
    this.notify();

    // In "error" mode we still try, so the next change can recover once the database is back.
    if (this.status.mode === "database" || this.status.mode === "error") {
      this.scheduleSave(updated.id);
    }
  }

  remove(id: string) {
    this.groups = this.list().filter((group) => group.id !== id);
    this.writeCache();
    this.notify();

    if (this.status.mode === "database") {
      fetch(`/api/teams/${encodeURIComponent(id)}`, { method: "DELETE" }).catch(() =>
        this.setStatus({ mode: "error", error: "Couldn't delete the team in the database." }),
      );
    }
  }

  /* ---------- internals ---------- */

  private writeCache() {
    storage.set(CACHE_KEY, JSON.stringify(this.groups));
  }

  private notify() {
    this.listeners.forEach((listener) => listener());
  }

  private setStatus(next: StorageStatus) {
    this.status = next;
    this.notify();
  }

  /** Loads teams from the database once per page load and decides the storage mode. */
  private async connectToDatabase() {
    let response: Response;
    let body: { configured?: boolean; teams?: Group[]; error?: string };
    try {
      response = await fetch("/api/teams", { cache: "no-store" });
      body = await response.json();
    } catch {
      this.setStatus({
        mode: "error",
        error: "Couldn't reach the server — using the browser copy.",
      });
      return;
    }

    if (response.status === 503 || body.configured === false) {
      this.setStatus({ mode: "browser" });
      return;
    }
    if (!response.ok || !body.teams) {
      const reason = body.error ?? "Database error";
      this.setStatus({ mode: "error", error: `${reason} Using the browser copy.` });
      return;
    }

    const firstConnection = storage.get(MIGRATED_KEY) !== "1";
    const { merged, toUpload } = mergeWithDatabase(this.list(), body.teams, firstConnection);

    this.groups = merged;
    this.writeCache();
    this.setStatus({ mode: "database" });
    toUpload.forEach((id) => this.scheduleSave(id, 0));
    storage.set(MIGRATED_KEY, "1");
  }

  private scheduleSave(id: string, delay = SAVE_DEBOUNCE_MS) {
    clearTimeout(this.saveTimers.get(id));
    this.saveTimers.set(
      id,
      setTimeout(() => void this.saveToDatabase(id), delay),
    );
    if (!this.status.pending) this.setStatus({ ...this.status, pending: true });
  }

  private async saveToDatabase(id: string) {
    this.saveTimers.delete(id);
    const group = this.groups?.find((g) => g.id === id);
    if (!group) return;

    this.savesInFlight++;
    try {
      const response = await fetch(`/api/teams/${encodeURIComponent(id)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(group),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error ?? `Save failed (${response.status})`);
      }
      this.savesInFlight--;
      const stillSaving = this.saveTimers.size > 0 || this.savesInFlight > 0;
      this.setStatus({ mode: "database", pending: stillSaving });
    } catch (error) {
      this.savesInFlight--;
      this.setStatus({
        mode: "error",
        error: `${(error as Error).message} — kept in this browser, will retry on the next change.`,
        pending: false,
      });
    }
  }
}

export const groupRepository = new SyncedGroupRepository();

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                   */
/* -------------------------------------------------------------------------- */

export function newGroup(name: string): Group {
  const now = new Date().toISOString();
  const id =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : String(Date.now());
  return {
    id,
    name,
    color: series[Math.floor(Math.random() * series.length)],
    members: [],
    createdAt: now,
    updatedAt: now,
  };
}

/** Members that are linked to a Jira account (or a sample stand-in). */
export const resolvedPeople = (group: Group): JiraPerson[] =>
  group.members.flatMap((member) => (member.person ? [member.person] : []));
