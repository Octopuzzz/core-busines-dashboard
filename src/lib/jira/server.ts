/**
 * Jira Cloud client — server only (the API token never reaches the browser).
 *
 * Reads JIRA_BASE_URL, JIRA_EMAIL and JIRA_API_TOKEN (and optionally JIRA_CLOUD_ID for scoped
 * tokens) from the environment. Used by the /api/jira/* route handlers.
 */
import "server-only";
import type { Issue, IssueQuery, JiraPerson, JiraProject, StatusCategory } from "./types";

const PAGE_SIZE = 100;
const MAX_PAGES = 20; // 20 × 100 = up to 2,000 issues per request
const ISSUE_FIELDS = [
  "summary",
  "status",
  "assignee",
  "priority",
  "issuetype",
  "project",
  "created",
  "updated",
  "resolutiondate",
  "duedate",
  "labels",
  "parent",
];

/* -------------------------------------------------------------------------- */
/*  HTTP                                                                      */
/* -------------------------------------------------------------------------- */

export function jiraConfigured(): boolean {
  return Boolean(process.env.JIRA_BASE_URL && process.env.JIRA_EMAIL && process.env.JIRA_API_TOKEN);
}

/** Public site URL, e.g. https://corekopnus.atlassian.net — used for "open in Jira" links. */
function siteUrl() {
  return (process.env.JIRA_BASE_URL ?? "").replace(/\/+$/, "");
}

/** API root. Scoped API tokens must go through the Atlassian gateway (needs JIRA_CLOUD_ID). */
function apiRoot() {
  const cloudId = process.env.JIRA_CLOUD_ID?.trim();
  return cloudId ? `https://api.atlassian.com/ex/jira/${cloudId}` : siteUrl();
}

const browseUrl = (issueKey: string) => `${siteUrl()}/browse/${issueKey}`;

export class JiraError extends Error {
  constructor(
    public status: number,
    public body: string,
  ) {
    super(`Jira responded ${status}`);
  }
}

/** Authenticated request to the Jira REST API. Throws JiraError on non-2xx responses. */
async function jiraFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const credentials = `${process.env.JIRA_EMAIL}:${process.env.JIRA_API_TOKEN}`;
  const response = await fetch(`${apiRoot()}${path}`, {
    ...init,
    headers: {
      Authorization: `Basic ${Buffer.from(credentials).toString("base64")}`,
      Accept: "application/json",
      "Content-Type": "application/json",
      ...init?.headers,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new JiraError(response.status, body.slice(0, 500));
  }
  return response.json() as Promise<T>;
}

/* -------------------------------------------------------------------------- */
/*  Auth check                                                                */
/* -------------------------------------------------------------------------- */

const AUTH_CHECK_TTL_MS = 60_000;
let authVerifiedUntil = 0;

/** The account behind the configured token. Throws JiraError(401) for bad credentials. */
export async function whoAmI(): Promise<JiraPerson> {
  return toPerson(await jiraFetch<RawUser>("/rest/api/3/myself"));
}

/**
 * Jira's user search quietly returns [] for bad credentials instead of a 401, which would look
 * like "nobody found". Call this first so a bad token fails loudly. Checked at most once a minute.
 */
export async function assertAuth() {
  if (Date.now() < authVerifiedUntil) return;
  await whoAmI();
  authVerifiedUntil = Date.now() + AUTH_CHECK_TTL_MS;
}

/* -------------------------------------------------------------------------- */
/*  JQL                                                                       */
/* -------------------------------------------------------------------------- */

// Values are validated before going into JQL so the query can't be broken or injected.
const SAFE_ACCOUNT_ID = /^[A-Za-z0-9:_-]+$/;
const SAFE_PROJECT_KEY = /^[A-Z][A-Z0-9_]+$/;
const SAFE_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Builds the JQL for a team query: assignees AND projects AND date range AND extra JQL. */
export function buildJql(query: IssueQuery): string {
  const accountIds = query.accountIds.filter((id) => SAFE_ACCOUNT_ID.test(id));
  const projectKeys = (query.projectKeys ?? []).filter((key) => SAFE_PROJECT_KEY.test(key));

  const clauses = [`assignee in (${accountIds.map((id) => `"${id}"`).join(", ")})`];
  if (projectKeys.length) clauses.push(`project in (${projectKeys.join(", ")})`);
  if (query.from && SAFE_DATE.test(query.from)) clauses.push(`updated >= "${query.from}"`);
  if (query.to && SAFE_DATE.test(query.to)) clauses.push(`updated <= "${query.to} 23:59"`);
  if (query.jql?.trim()) clauses.push(`(${query.jql.trim()})`);

  return `${clauses.join(" AND ")} ORDER BY updated DESC`;
}

/* -------------------------------------------------------------------------- */
/*  Mapping Jira's JSON to our types                                          */
/* -------------------------------------------------------------------------- */

interface RawUser {
  accountId: string;
  displayName: string;
  emailAddress?: string;
  avatarUrls?: Record<string, string>;
  accountType?: string;
  active?: boolean;
}

interface RawIssue {
  key: string;
  fields: {
    summary: string;
    status?: { name: string; statusCategory?: { key: string } };
    assignee?: RawUser | null;
    priority?: { name: string } | null;
    issuetype?: { name: string };
    project?: { key: string; name: string };
    created: string;
    updated: string;
    resolutiondate?: string | null;
    duedate?: string | null;
    labels?: string[];
    parent?: { key: string; fields?: { summary?: string; issuetype?: { name: string } } };
  };
}

/**
 * Keeps real photos and drops Jira's generated "initials" images (they clash with our avatars).
 * - Direct ".../initials/XX-n.png" → no avatar.
 * - Gravatar with an initials fallback → ask Gravatar to 404 instead, so a real Gravatar photo
 *   still shows and people without one fall back to our initials (the Avatar handles onError).
 */
export function cleanAvatar(url?: string): string | undefined {
  if (!url) return undefined;
  try {
    const parsed = new URL(url);
    if (/\/initials\//i.test(parsed.pathname)) return undefined;

    const isGravatar = parsed.hostname.endsWith("gravatar.com");
    const fallsBackToInitials = /initials/i.test(parsed.searchParams.get("d") ?? "");
    if (isGravatar && fallsBackToInitials) {
      parsed.searchParams.set("d", "404");
      parsed.searchParams.set("s", "96");
      return parsed.toString();
    }
    return url;
  } catch {
    return undefined;
  }
}

function toPerson(user: RawUser): JiraPerson {
  return {
    accountId: user.accountId,
    displayName: user.displayName,
    email: user.emailAddress,
    avatarUrl: cleanAvatar(user.avatarUrls?.["48x48"]),
  };
}

const ACRONYMS = new Set(["QA", "UAT", "PO", "SA", "TM", "UI", "UX", "API", "BA", "PM", "SIT"]);
const LOWERCASE_WORDS = new Set(["for", "and", "of", "in", "to", "or", "on", "the", "&", "/"]);

/**
 * Tidies ALL-CAPS workflow names: "READY FOR UAT / PO REVIEW" → "Ready for UAT / PO Review".
 * Names that already use mixed case are left alone.
 */
export function prettyStatus(name: string): string {
  if (name !== name.toUpperCase()) return name;

  return name
    .toLowerCase()
    .split(/(\s+)/) // keep the whitespace so spacing is preserved
    .map((word, index) => {
      if (/^\s+$/.test(word)) return word;
      if (ACRONYMS.has(word.toUpperCase())) return word.toUpperCase();
      if (index > 0 && LOWERCASE_WORDS.has(word)) return word;
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join("");
}

const KNOWN_CATEGORIES: StatusCategory[] = ["new", "indeterminate", "done"];

function toIssue(raw: RawIssue): Issue {
  const fields = raw.fields;
  const category = (fields.status?.statusCategory?.key ?? "new") as StatusCategory;

  return {
    key: raw.key,
    url: browseUrl(raw.key),
    summary: fields.summary,
    project: { key: fields.project?.key ?? "", name: fields.project?.name ?? "" },
    type: fields.issuetype?.name ?? "Task",
    status: prettyStatus(fields.status?.name ?? "Unknown"),
    statusCategory: KNOWN_CATEGORIES.includes(category) ? category : "new",
    priority: fields.priority?.name ?? "None",
    assignee: fields.assignee ? toPerson(fields.assignee) : null,
    created: fields.created,
    updated: fields.updated,
    resolved: fields.resolutiondate ?? null,
    due: fields.duedate ?? null,
    labels: fields.labels ?? [],
    parent: fields.parent
      ? {
          key: fields.parent.key,
          summary: fields.parent.fields?.summary ?? "",
          type: fields.parent.fields?.issuetype?.name ?? "",
          url: browseUrl(fields.parent.key),
        }
      : null,
  };
}

/* -------------------------------------------------------------------------- */
/*  Endpoints                                                                 */
/* -------------------------------------------------------------------------- */

/** All issues matching the team query, following Jira's page tokens (up to MAX_PAGES). */
export async function searchIssues(
  query: IssueQuery,
): Promise<{ issues: Issue[]; truncated: boolean; jql: string }> {
  const jql = buildJql(query);
  const issues: Issue[] = [];
  let nextPageToken: string | undefined;

  for (let page = 0; page < MAX_PAGES; page++) {
    const result = await jiraFetch<{
      issues: RawIssue[];
      nextPageToken?: string;
      isLast?: boolean;
    }>("/rest/api/3/search/jql", {
      method: "POST",
      body: JSON.stringify({ jql, fields: ISSUE_FIELDS, maxResults: PAGE_SIZE, nextPageToken }),
    });

    issues.push(...result.issues.map(toIssue));
    if (result.isLast || !result.nextPageToken) return { issues, truncated: false, jql };
    nextPageToken = result.nextPageToken;
  }

  return { issues, truncated: true, jql };
}

/** People search (real, active Atlassian accounts only — no bots or app users). */
export async function searchUsers(query: string): Promise<JiraPerson[]> {
  await assertAuth();
  const users = await jiraFetch<RawUser[]>(
    `/rest/api/3/user/search?query=${encodeURIComponent(query)}&maxResults=25`,
  );
  return users
    .filter((user) => user.accountType === "atlassian" && user.active !== false)
    .map(toPerson);
}

/** Fresh profiles (name + avatar) for known account IDs, 50 per request. */
export async function getUsers(accountIds: string[]): Promise<JiraPerson[]> {
  await assertAuth();
  const BATCH = 50;
  const people: JiraPerson[] = [];

  for (let start = 0; start < accountIds.length; start += BATCH) {
    const params = accountIds
      .slice(start, start + BATCH)
      .map((id) => `accountId=${encodeURIComponent(id)}`)
      .join("&");
    const result = await jiraFetch<{ values: RawUser[] }>(
      `/rest/api/3/user/bulk?${params}&maxResults=${BATCH}`,
    );
    people.push(...result.values.map(toPerson));
  }
  return people;
}

/** All projects the token can see, sorted by name (max 500). */
export async function listProjects(): Promise<JiraProject[]> {
  const BATCH = 50;
  const MAX_BATCHES = 10;
  const projects: JiraProject[] = [];

  for (let batch = 0; batch < MAX_BATCHES; batch++) {
    const result = await jiraFetch<{ values: JiraProject[]; isLast: boolean }>(
      `/rest/api/3/project/search?startAt=${batch * BATCH}&maxResults=${BATCH}&orderBy=name`,
    );
    projects.push(...result.values.map(({ key, name }) => ({ key, name })));
    if (result.isLast) break;
  }
  return projects;
}

/* -------------------------------------------------------------------------- */
/*  Name → account lookup (for team members configured by name)               */
/* -------------------------------------------------------------------------- */

export interface Resolution {
  name: string;
  match: JiraPerson | null;
  candidates: JiraPerson[];
}

/** Lowercase, punctuation → spaces: "Made Agustha I.S." → "made agustha i s". */
const normalize = (text: string) =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

/** Exact name match first, then a prefix match either way, then the only candidate if just one. */
export function pickMatch(name: string, candidates: JiraPerson[]): JiraPerson | null {
  const wanted = normalize(name);
  const exact = candidates.find((person) => normalize(person.displayName) === wanted);
  const prefix = candidates.find((person) => {
    const found = normalize(person.displayName);
    return found.startsWith(wanted) || wanted.startsWith(found);
  });
  return exact ?? prefix ?? (candidates.length === 1 ? candidates[0] : null);
}

export async function resolveNames(names: string[]): Promise<Resolution[]> {
  await assertAuth();
  const resolutions: Resolution[] = [];

  for (const name of names) {
    let candidates = await searchUsers(name);
    if (!candidates.length) {
      // Retry with the first two words (handles suffixes like "Made Agustha I.S").
      const firstTwoWords = name.split(/\s+/).slice(0, 2).join(" ");
      if (firstTwoWords !== name) candidates = await searchUsers(firstTwoWords);
    }
    resolutions.push({
      name,
      match: pickMatch(name, candidates),
      candidates: candidates.slice(0, 8),
    });
  }
  return resolutions;
}
