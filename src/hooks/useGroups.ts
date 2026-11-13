"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import { groupRepository, type Group, type Member, type StorageStatus } from "@/lib/groups/store";
import type { Resolution } from "@/lib/jira/server";
import type { JiraPerson } from "@/lib/jira/types";

type Source = "jira" | "sample";

const NO_GROUPS: Group[] = [];
const LOADING_STATUS: StorageStatus = { mode: "loading" };

const subscribe = (listener: () => void) => groupRepository.subscribe(listener);
const saveGroup = (group: Group) => groupRepository.save(group);
const removeGroup = (id: string) => groupRepository.remove(id);

export function useGroups(initial?: Group[] | null) {
  if (initial && initial.length > 0) {
    groupRepository.init?.(initial);
  }
  const groups = useSyncExternalStore(
    subscribe,
    () => groupRepository.list(),
    () => initial ?? NO_GROUPS,
  );
  return { groups, save: saveGroup, remove: removeGroup };
}

export function useStorageStatus(): StorageStatus {
  return useSyncExternalStore(subscribe, groupRepository.getStatus, () => LOADING_STATUS);
}

async function postJson<T>(url: string, body: unknown): Promise<T | null> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return response.ok ? ((await response.json()) as T) : null;
}

function applyResolutions(groupId: string, results: Resolution[], source: Source) {
  const latest = groupRepository.list().find((group) => group.id === groupId);
  if (!latest) return;

  const resultByName = new Map(results.map((result) => [result.name, result]));
  const members = latest.members.map((member): Member => {
    const result = resultByName.get(member.name);
    if (!result) return member;
    return result.match ? { ...member, person: result.match, source } : { name: member.name };
  });

  groupRepository.save({ ...latest, members });
}

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

const refreshedTeams = new Set<string>();

function applyProfiles(groupId: string, profiles: JiraPerson[]) {
  const latest = groupRepository.list().find((group) => group.id === groupId);
  if (!latest) return;

  const profileById = new Map(profiles.map((profile) => [profile.accountId, profile]));
  const members = latest.members.map((member) => {
    const profile = member.person && profileById.get(member.person.accountId);
    return profile ? { ...member, person: { ...member.person!, ...profile } } : member;
  });

  if (JSON.stringify(members) !== JSON.stringify(latest.members)) {
    groupRepository.save({ ...latest, members });
  }
}

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
        .catch(() => refreshedTeams.delete(group.id));
    }
  }, [groups, live]);
}
