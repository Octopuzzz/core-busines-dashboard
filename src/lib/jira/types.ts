export type StatusCategory = "new" | "indeterminate" | "done";

export interface JiraPerson {
  accountId: string;
  displayName: string;
  email?: string;
  avatarUrl?: string;
}

export interface Issue {
  key: string;
  url: string;
  summary: string;
  project: { key: string; name: string };
  type: string;
  status: string;
  statusCategory: StatusCategory;
  priority: string;
  assignee: JiraPerson | null;
  created: string;
  updated: string;
  resolved: string | null;
  due: string | null;
  labels: string[];
  parent: { key: string; summary: string; type: string; url: string } | null;
}

export interface IssueQuery {
  accountIds: string[];
  projectKeys?: string[];
  from?: string;
  to?: string;
  jql?: string;
  names?: Record<string, string>;
}

export interface IssueResponse {
  source: "jira" | "sample";
  issues: Issue[];
  truncated: boolean;
  jql: string;
}

export interface JiraProject {
  key: string;
  name: string;
}
