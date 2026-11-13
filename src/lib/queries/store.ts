import type { SavedView, TeamSettings } from "@/lib/groups/store";

export type SavedQuery = SavedView;

const CACHE_KEY = "kopnus.jira.queries.v1";
const NO_QUERIES: SavedQuery[] = [];

function readCache(): SavedQuery[] {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(CACHE_KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeCache(queries: SavedQuery[]) {
  try {
    window.localStorage.setItem(CACHE_KEY, JSON.stringify(queries));
  } catch {}
}

const byName = (a: SavedQuery, b: SavedQuery) => a.name.localeCompare(b.name);

class SavedQueryStore {
  private queries: SavedQuery[] | null = null;
  private listeners = new Set<() => void>();
  private useDatabase = false;
  private loadStarted = false;
  private onError: ((message: string) => void) | null = null;

  list = (): SavedQuery[] => {
    if (typeof window === "undefined") return NO_QUERIES;
    if (!this.queries) this.queries = readCache();
    if (!this.loadStarted) {
      this.loadStarted = true;
      queueMicrotask(() => void this.load());
    }
    return this.queries;
  };

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  setErrorHandler(handler: ((message: string) => void) | null) {
    this.onError = handler;
  }

  save(name: string, settings: TeamSettings): SavedQuery {
    const current = this.list();
    const existing = current.find((query) => query.name.toLowerCase() === name.toLowerCase());
    const query: SavedQuery = {
      id: existing?.id ?? crypto.randomUUID(),
      name,
      settings,
      createdAt: existing?.createdAt ?? new Date().toISOString(),
    };
    this.update([...current.filter((q) => q.id !== query.id), query]);
    if (this.useDatabase) {
      void this.request(`/api/queries/${query.id}`, "PUT", query, "Couldn't save the query");
    }
    return query;
  }

  remove(id: string) {
    this.update(this.list().filter((query) => query.id !== id));
    if (this.useDatabase) {
      void this.request(`/api/queries/${id}`, "DELETE", undefined, "Couldn't delete the query");
    }
  }

  private update(next: SavedQuery[]) {
    this.queries = [...next].sort(byName);
    writeCache(this.queries);
    this.listeners.forEach((listener) => listener());
  }

  private async load() {
    try {
      const response = await fetch("/api/queries", { cache: "no-store" });
      const body = (await response.json()) as { queries?: SavedQuery[] };
      if (!response.ok || !body.queries) return;
      this.useDatabase = true;

      const fromDatabase = new Map(body.queries.map((query) => [query.id, query]));
      const takenNames = new Set(body.queries.map((query) => query.name.toLowerCase()));
      const localOnly = this.list().filter(
        (query) => !fromDatabase.has(query.id) && !takenNames.has(query.name.toLowerCase()),
      );
      this.update([...fromDatabase.values(), ...localOnly]);
      localOnly.forEach((query) =>
        this.request(`/api/queries/${query.id}`, "PUT", query, "Couldn't upload a saved query"),
      );
    } catch {}
  }

  private async request(url: string, method: string, body: unknown, failure: string) {
    try {
      const response = await fetch(url, {
        method,
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      if (!response.ok) {
        const detail = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(detail.error ?? `${response.status}`);
      }
    } catch (error) {
      this.onError?.(`${failure}: ${(error as Error).message}`);
    }
  }
}

export const savedQueryStore = new SavedQueryStore();
