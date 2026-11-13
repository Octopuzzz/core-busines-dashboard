import type { JiraPerson } from "@/lib/jira/types";
import { DEFAULT_TEAMS } from "@/config/teams";
import { series } from "@/design/tokens";

export interface Member {
  name: string;
  person?: JiraPerson;
  source?: "jira" | "sample";
}

export type RangeSetting = { preset: 14 | 30 | 90 | "year" | "all" } | { from: string; to: string };

export interface TeamSettings {
  search: string;
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
  settings?: TeamSettings;
  views?: SavedView[];
  createdAt: string;
  updatedAt: string;
}

export interface GroupRepository {
  list(): Group[];
  init?(initialTeams?: Group[] | null): void;
  save(group: Group): void;
  remove(id: string): void;
  subscribe(listener: () => void): () => void;
}

export type StorageMode = "loading" | "database" | "browser" | "error";

export interface StorageStatus {
  mode: StorageMode;
  error?: string;
  pending?: boolean;
}

export const DEFAULT_SETTINGS: TeamSettings = {
  search: "",
  people: [],
  projectKeys: [],
  range: { preset: 90 },
  jql: "",
};

const CACHE_KEY = "kopnus.jira.teams.v3";
const LEGACY_CACHE_KEY = "kopnus.jira.teams.v2";
const MIGRATED_KEY = "kopnus.jira.teams.migratedToDb";

const SAVE_DEBOUNCE_MS = 400;
const NO_GROUPS: Group[] = [];

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
    } catch {}
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

function configuredTeams(): Group[] {
  const epoch = "1970-01-01T00:00:00.000Z";
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
    createdAt: epoch,
    updatedAt: epoch,
  }));
}

function mergeWithDatabase(local: Group[], fromDatabase: Group[]) {
  const dbMap = new Map(fromDatabase.map((group) => [group.id, group]));
  const toUpload: string[] = [];

  for (const localGroup of local) {
    if (!dbMap.has(localGroup.id) && !DEFAULT_TEAMS.some((t) => t.id === localGroup.id)) {
      dbMap.set(localGroup.id, localGroup);
      toUpload.push(localGroup.id);
    }
  }

  return { merged: Array.from(dbMap.values()), toUpload };
}

class SyncedGroupRepository implements GroupRepository {
  private groups: Group[] | null = null;
  private listeners = new Set<() => void>();
  private connectStarted = false;
  private initialized = false;

  private status: StorageStatus = { mode: "loading" };

  private saveTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private savesInFlight = 0;

  init(initialTeams?: Group[] | null) {
    if (this.initialized || typeof window === "undefined") return;
    this.initialized = true;
    if (!initialTeams?.length) return;
    this.groups = initialTeams;
    this.status = { mode: "database" };
    this.connectStarted = true;
    this.writeCache();
  }

  list(): Group[] {
    if (typeof window === "undefined") return NO_GROUPS;

    if (!this.groups) {
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

  save(group: Group) {
    const updated = { ...group, updatedAt: new Date().toISOString() };
    const current = this.list();
    const exists = current.some((g) => g.id === group.id);

    this.groups = exists
      ? current.map((g) => (g.id === group.id ? updated : g))
      : [...current, updated];
    this.writeCache();
    this.notify();

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

    const { merged, toUpload } = mergeWithDatabase(this.list(), body.teams);

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

export const resolvedPeople = (group: Group): JiraPerson[] =>
  group.members.flatMap((member) => (member.person ? [member.person] : []));
