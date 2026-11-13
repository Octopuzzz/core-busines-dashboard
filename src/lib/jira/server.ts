import "server-only";
import { dbConfigured, ensureSchema, getDb } from "@/lib/db";
import { appConfig } from "@/lib/db/schema";
import type { Issue, IssueQuery, JiraPerson, JiraProject, StatusCategory } from "./types";

const PAGE_SIZE = 100;
const MAX_PAGES = 20;
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

export interface JiraConfig {
  baseUrl: string;
  email: string;
  apiToken: string;
  cloudId?: string;
}

let cachedConfig: JiraConfig | null = null;
let lastCheck = 0;
const CONFIG_TTL_MS = 15_000;

const clean = (value?: string | null) => value?.trim().replace(/^["']|["']$/g, "") || "";

async function readDbConfig(): Promise<Record<string, string>> {
  if (!dbConfigured()) return {};
  try {
    await ensureSchema();
    const rows = await getDb().select().from(appConfig);
    return Object.fromEntries(rows.map((row) => [row.key, clean(row.value)]));
  } catch (e) {
    console.error("[jira] couldn't load config from database:", (e as Error).message);
    return {};
  }
}

export async function getJiraConfig(): Promise<JiraConfig | null> {
  const now = Date.now();
  if (now - lastCheck < CONFIG_TTL_MS) return cachedConfig;

  const db = await readDbConfig();
  const pick = (key: string) => db[key] || clean(process.env[key]);

  const baseUrl = pick("JIRA_BASE_URL");
  const email = pick("JIRA_EMAIL");
  const apiToken = pick("JIRA_API_TOKEN");
  const cloudId = pick("JIRA_CLOUD_ID") || undefined;

  cachedConfig = baseUrl && email && apiToken ? { baseUrl, email, apiToken, cloudId } : null;
  lastCheck = now;
  return cachedConfig;
}

export async function jiraConfigured(): Promise<boolean> {
  const config = await getJiraConfig();
  return Boolean(config?.baseUrl && config?.email && config?.apiToken);
}

function siteUrl(config?: JiraConfig | null) {
  const url = config?.baseUrl ?? cachedConfig?.baseUrl ?? "";
  return url.replace(/\/+$/, "");
}

function apiRoot(config?: JiraConfig | null) {
  const cloudId = config ? config.cloudId : cachedConfig?.cloudId;
  return cloudId ? `https://api.atlassian.com/ex/jira/${cloudId}` : siteUrl(config);
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

async function jiraFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const config = await getJiraConfig();
  if (!config)
    throw new JiraError(500, "Jira credentials are not configured in environment or database.");
  const credentials = `${config.email}:${config.apiToken}`;
  const response = await fetch(`${apiRoot(config)}${path}`, {
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

const AUTH_CHECK_TTL_MS = 60_000;
let authVerifiedUntil = 0;

export async function whoAmI(): Promise<JiraPerson> {
  return toPerson(await jiraFetch<RawUser>("/rest/api/3/myself"));
}

export async function assertAuth() {
  if (Date.now() < authVerifiedUntil) return;
  await whoAmI();
  authVerifiedUntil = Date.now() + AUTH_CHECK_TTL_MS;
}

const SAFE_ACCOUNT_ID = /^[A-Za-z0-9:_-]+$/;
const SAFE_PROJECT_KEY = /^[A-Z][A-Z0-9_]+$/;
const SAFE_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function withoutOrderBy(jql: string): string {
  return jql.replace(/\s*\bORDER\s+BY\s+[^"']*$/i, "").trim();
}

export function buildJql(query: IssueQuery): string {
  const accountIds = query.accountIds.filter((id) => SAFE_ACCOUNT_ID.test(id));
  const projectKeys = (query.projectKeys ?? []).filter((key) => SAFE_PROJECT_KEY.test(key));

  const clauses = [`assignee in (${accountIds.map((id) => `"${id}"`).join(", ")})`];
  if (projectKeys.length) clauses.push(`project in (${projectKeys.join(", ")})`);
  if (query.from && SAFE_DATE.test(query.from)) clauses.push(`updated >= "${query.from}"`);
  if (query.to && SAFE_DATE.test(query.to)) clauses.push(`updated <= "${query.to} 23:59"`);
  const userJql = withoutOrderBy(query.jql ?? "");
  if (userJql) clauses.push(`(${userJql})`);

  return `${clauses.join(" AND ")} ORDER BY updated DESC`;
}

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

export function prettyStatus(name: string): string {
  if (name !== name.toUpperCase()) return name;

  return name
    .toLowerCase()
    .split(/(\s+)/)
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

export async function searchUsers(query: string): Promise<JiraPerson[]> {
  await assertAuth();
  const users = await jiraFetch<RawUser[]>(
    `/rest/api/3/user/search?query=${encodeURIComponent(query)}&maxResults=25`,
  );
  return users
    .filter((user) => user.accountType === "atlassian" && user.active !== false)
    .map(toPerson);
}

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

export interface Resolution {
  name: string;
  match: JiraPerson | null;
  candidates: JiraPerson[];
}

const normalize = (text: string) =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

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

export interface JqlTestResult {
  valid: boolean;
  jql: string;
  errors: string[];
  warnings: string[];
  count: number | null;
  issues: Issue[];
  tookMs: number;
}

const JQL_PREVIEW_SIZE = 10;

function jiraMessages(error: unknown): string[] {
  if (!(error instanceof JiraError)) return [(error as Error)?.message ?? "Unknown error."];
  try {
    const body = JSON.parse(error.body) as {
      errorMessages?: string[];
      errors?: Record<string, string>;
      warningMessages?: string[];
    };
    const messages = [...(body.errorMessages ?? []), ...Object.values(body.errors ?? {})];
    if (messages.length) return messages;
  } catch {}
  return [`Jira responded ${error.status}${error.body ? `: ${error.body}` : ""}`];
}

async function parseJql(jql: string) {
  const parsed = await jiraFetch<{ queries: { errors?: string[]; warnings?: string[] }[] }>(
    "/rest/api/3/jql/parse?validation=strict",
    { method: "POST", body: JSON.stringify({ queries: [jql] }) },
  );
  return { errors: parsed.queries[0]?.errors ?? [], warnings: parsed.queries[0]?.warnings ?? [] };
}

export async function testJql(jql: string, userJql = jql): Promise<JqlTestResult> {
  const started = Date.now();
  const done = (result: Omit<JqlTestResult, "jql" | "tookMs">): JqlTestResult => ({
    ...result,
    jql,
    tookMs: Date.now() - started,
  });

  const own = await parseJql(userJql);
  if (own.errors.length)
    return { ...done({ valid: false, ...own, count: null, issues: [] }), jql: userJql };

  const { errors, warnings } = userJql === jql ? own : await parseJql(jql);
  if (errors.length) return done({ valid: false, errors, warnings, count: null, issues: [] });

  try {
    const [count, preview] = await Promise.all([
      jiraFetch<{ count: number }>("/rest/api/3/search/approximate-count", {
        method: "POST",
        body: JSON.stringify({ jql }),
      })
        .then((body) => body.count)
        .catch(() => null),
      jiraFetch<{ issues: RawIssue[] }>("/rest/api/3/search/jql", {
        method: "POST",
        body: JSON.stringify({ jql, fields: ISSUE_FIELDS, maxResults: JQL_PREVIEW_SIZE }),
      }),
    ]);
    return done({ valid: true, errors: [], warnings, count, issues: preview.issues.map(toIssue) });
  } catch (error) {
    if (error instanceof JiraError && error.status === 401) throw error;
    return done({ valid: false, errors: jiraMessages(error), warnings, count: null, issues: [] });
  }
}
