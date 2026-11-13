"use client";

/**
 * React hooks around the team store (src/lib/groups/store.ts) and the Jira member lookups.
 */
import { useEffect, useRef, useSyncExternalStore } from "react";
import { groupRepository, type Group, type Member, type StorageStatus } from "@/lib/groups/store";
import type { Resolution } from "@/lib/jira/server";
import type { JiraPerson } from "@/lib/jira/types";

type Source = "jira" | "sample";

const NO_GROUPS: Group[] = [];
const LOADING_STATUS: StorageStatus = { mode: "loading" };

const subscribe = (listener: () => void) => groupRepository.subscribe(listener);
// Stable references, so components can safely list them as effect dependencies.
const saveGroup = (group: Group) => groupRepository.save(group);
const removeGroup = (id: string) => groupRepository.remove(id);

/** All teams, kept in sync with the store. */
export function useGroups() {
  const groups = useSyncExternalStore(
    subscribe,
    () => groupRepository.list(),
    () => NO_GROUPS,
  );
  return { groups, save: saveGroup, remove: removeGroup };
}

/** Where teams are being saved: database, browser only, or database error. */
export function useStorageStatus(): StorageStatus {
  return useSyncExternalStore(subscribe, groupRepository.getStatus, () => LOADING_STATUS);
}

/* -------------------------------------------------------------------------- */
/*  Linking members to Jira accounts                                          */
/* -------------------------------------------------------------------------- */

async function postJson<T>(url: string, body: unknown): Promise<T | null> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return response.ok ? ((await response.json()) as T) : null;
}

/** Applies lookup results to the latest copy of the team (it may have changed meanwhile). */
function applyResolutions(groupId: string, results: Resolution[], source: Source) {
  const latest = groupRepository.list().find((group) => group.id === groupId);
  if (!latest) return;

  const resultByName = new Map(results.map((result) => [result.name, result]));
  const members = latest.members.map((member): Member => {
    const result = resultByName.get(member.name);
    if (!result) return member;
    // No match: leave it unlinked (and without a source) so it's retried next time.
    return result.match ? { ...member, person: result.match, source } : { name: member.name };
  });

  groupRepository.save({ ...latest, members });
}

/**
 * Looks up the Jira account for every member that isn't linked yet — or is only linked to a
 * sample stand-in while real Jira is now connected. Each set of names is looked up once.
 */
export function useResolveMembers(groups: Group[], source: Source | null) {
  const requested = useRef(new Set<string>());

  useEffect(() => {
    if (!source) return;

    for (const group of groups) {
      const names = group.members
        .filter((member) => !member.person || member.source !== source)
        .map((member) => member.name);
      const requestKey = `${group.id}:${source}:${names.join("|")}`;
      if (!names.length || requested.current.has(requestKey)) continue;
      requested.current.add(requestKey);

      postJson<{ source: Source; results: Resolution[] }>("/api/jira/resolve", { names })
        .then((body) => body && applyResolutions(group.id, body.results, body.source))
        .catch(() => {});
    }
  }, [groups, source]);
}

/* -------------------------------------------------------------------------- */
/*  Refreshing profiles (photo + display name)                                */
/* -------------------------------------------------------------------------- */

/** Teams already refreshed during this page load. */
const refreshedTeams = new Set<string>();

function applyProfiles(groupId: string, profiles: JiraPerson[]) {
  const latest = groupRepository.list().find((group) => group.id === groupId);
  if (!latest) return;

  const profileById = new Map(profiles.map((profile) => [profile.accountId, profile]));
  const members = latest.members.map((member) => {
    const profile = member.person && profileById.get(member.person.accountId);
    return profile ? { ...member, person: { ...member.person!, ...profile } } : member;
  });

  // Only write when something actually changed (avoids a pointless database save).
  if (JSON.stringify(members) !== JSON.stringify(latest.members)) {
    groupRepository.save({ ...latest, members });
  }
}

/**
 * Once per page load, refreshes linked members' Jira profiles. Needed because teams created
 * from the config file only know account IDs, not photos.
 */
export function useRefreshProfiles(groups: Group[], live: boolean) {
  useEffect(() => {
    if (!live) return;

    for (const group of groups) {
      const accountIds = group.members.flatMap((member) =>
        member.person && member.source === "jira" ? [member.person.accountId] : [],
      );
      if (!accountIds.length || refreshedTeams.has(group.id)) continue;
      refreshedTeams.add(group.id);

      postJson<{ users: JiraPerson[] }>("/api/jira/users/bulk", { accountIds })
        .then((body) => {
          if (body?.users.length) applyProfiles(group.id, body.users);
        })
        .catch(() => refreshedTeams.delete(group.id)); // try again on the next render
    }
  }, [groups, live]);
}
