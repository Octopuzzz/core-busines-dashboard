"use client";

import { useSyncExternalStore } from "react";
import { savedQueryStore, type SavedQuery } from "@/lib/queries/store";
import type { TeamSettings } from "@/lib/groups/store";

const NO_QUERIES: SavedQuery[] = [];
const saveQuery = (name: string, settings: TeamSettings) => savedQueryStore.save(name, settings);
const removeQuery = (id: string) => savedQueryStore.remove(id);

export function useSavedQueries() {
  const queries = useSyncExternalStore(
    savedQueryStore.subscribe,
    savedQueryStore.list,
    () => NO_QUERIES,
  );
  return { queries, save: saveQuery, remove: removeQuery };
}
