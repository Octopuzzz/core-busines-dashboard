/**
 * SAMPLE DATA — used only when the JIRA_* env vars are missing.
 *
 * Issues are generated per person from a seed (their account ID), so the same person always
 * gets the same sample issues. The UI labels this clearly and never mixes it with live data.
 */
import type { Issue, IssueQuery, JiraPerson, JiraProject, StatusCategory } from "./types";
import type { Resolution } from "./server";

export const SAMPLE_PROJECTS: JiraProject[] = [
  { key: "SMP", name: "Sample Project" },
  { key: "DEMO", name: "Demo Project" },
];

// "Done" is listed twice so about 40% of sample issues are done.
const STATUSES: [name: string, category: StatusCategory][] = [
  ["To Do", "new"],
  ["In Progress", "indeterminate"],
  ["In Review", "indeterminate"],
  ["Done", "done"],
  ["Done", "done"],
];
const TYPES = ["Task", "Bug", "Story", "Sub-task"];
const PRIORITIES = ["Highest", "High", "Medium", "Low"];
const DAY_MS = 86_400_000;

const slugify = (text: string) =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

/** Small stable string hash, used as a random seed. */
const hashString = (text: string) =>
  [...text].reduce((hash, char) => (hash * 31 + char.charCodeAt(0)) >>> 0, 7);

/** Deterministic pseudo-random generator (same seed → same sequence). Returns 0–1. */
function seededRandom(seed: number) {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

/* -------------------------------------------------------------------------- */
/*  People                                                                    */
/* -------------------------------------------------------------------------- */

export function samplePerson(name: string): JiraPerson {
  return { accountId: `sample:${slugify(name)}`, displayName: name };
}

/** In sample mode every configured name "matches" a sample stand-in. */
export function sampleResolve(names: string[]): Resolution[] {
  return names.map((name) => ({
    name,
    match: samplePerson(name),
    candidates: [samplePerson(name)],
  }));
}

export function sampleUsers(query: string): JiraPerson[] {
  const name = query.trim();
  return name.length >= 2 ? [samplePerson(name)] : [];
}

/* -------------------------------------------------------------------------- */
/*  Issues                                                                    */
/* -------------------------------------------------------------------------- */

function sampleIssuesFor(person: JiraPerson): Issue[] {
  const random = seededRandom(hashString(person.accountId));
  const pick = <T>(list: T[]) => list[Math.floor(random() * list.length)];
  const now = Date.now();
  const issueCount = 8 + Math.floor(random() * 18);

  return Array.from({ length: issueCount }, (_, index) => {
    const project = pick(SAMPLE_PROJECTS);
    const [status, statusCategory] = pick(STATUSES);
    const created = now - Math.floor(random() * 110 + 2) * DAY_MS;
    const resolved =
      statusCategory === "done"
        ? Math.min(now, created + Math.floor(random() * 18 + 1) * DAY_MS)
        : null;
    const due = random() > 0.35 ? created + Math.floor(random() * 30 + 3) * DAY_MS : null;
    const number = (hashString(person.accountId) % 500) + index;
    const hasParent = index % 3 !== 0;

    return {
      key: `${project.key}-${100 + number}`,
      url: "#",
      summary: `Sample issue ${number}`,
      project,
      type: pick(TYPES),
      status,
      statusCategory,
      priority: pick(PRIORITIES),
      assignee: person,
      created: new Date(created).toISOString(),
      updated: new Date(Math.min(now, (resolved ?? created) + DAY_MS)).toISOString(),
      resolved: resolved ? new Date(resolved).toISOString() : null,
      due: due ? new Date(due).toISOString().slice(0, 10) : null,
      labels: [],
      parent: hasParent
        ? {
            key: `${project.key}-${50 + (number % 7)}`,
            summary: `Sample parent story ${number % 7}`,
            type: "Story",
            url: "#",
          }
        : null,
    } satisfies Issue;
  });
}

/** Sample issues for the queried people, filtered the same way the Jira query would be. */
export function sampleIssues(query: IssueQuery): Issue[] {
  const people = query.accountIds.map((accountId) => ({
    accountId,
    displayName: query.names?.[accountId] ?? accountId,
  }));

  return people.flatMap(sampleIssuesFor).filter((issue) => {
    const updatedDay = issue.updated.slice(0, 10);
    if (query.projectKeys?.length && !query.projectKeys.includes(issue.project.key)) return false;
    if (query.from && updatedDay < query.from) return false;
    if (query.to && updatedDay > query.to) return false;
    return true;
  });
}
