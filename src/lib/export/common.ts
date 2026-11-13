import dayjs from "dayjs";
import type { Issue } from "@/lib/jira/types";
import type { Metrics } from "@/lib/metrics";
import { isOverdue } from "@/lib/metrics";

export interface ExportInput {
  title: string;
  scope: string;
  period: string;
  source: "jira" | "sample";
  issues: Issue[];
  metrics: Metrics;
}

export interface PersonReport {
  accountId: string;
  name: string;
  issues: Issue[];
  done: Issue[];
  left: Issue[];
  todo: number;
  inProgress: number;
  overdue: number;
  rate: number;
}

const UNASSIGNED_ID = "unassigned";
const NO_DATE = "—";

export const fmtDate = (date: string | null) =>
  date ? dayjs(date).format("DD MMM YYYY") : NO_DATE;

export const fmtDays = (days: number | null) => (days == null ? NO_DATE : `${days.toFixed(1)} d`);

export function issueRow(issue: Issue) {
  return {
    key: issue.key,
    summary: issue.summary,
    assignee: issue.assignee?.displayName ?? "Unassigned",
    status: issue.status,
    type: issue.type,
    priority: issue.priority,
    project: issue.project.key,
    created: fmtDate(issue.created),
    updated: fmtDate(issue.updated),
    due: fmtDate(issue.due),
    resolved: fmtDate(issue.resolved),
    overdue: isOverdue(issue) ? "Yes" : "",
    url: issue.url,
    parentKey: issue.parent?.key ?? "",
    parentSummary: issue.parent?.summary ?? "",
    parentType: issue.parent?.type ?? "",
    parentUrl: issue.parent?.url ?? "",
  };
}

export type IssueRow = ReturnType<typeof issueRow>;

function urgency(issue: Issue): number {
  const notStarted = issue.statusCategory === "indeterminate" ? 0 : 1;
  const notOverdue = isOverdue(issue) ? 0 : 1;
  return notStarted * 2 + notOverdue;
}

const byResolvedNewestFirst = (a: Issue, b: Issue) =>
  (b.resolved ?? "").localeCompare(a.resolved ?? "");

const byUrgencyThenDueDate = (a: Issue, b: Issue) =>
  urgency(a) - urgency(b) || (a.due ?? "9999").localeCompare(b.due ?? "9999");

export function byPerson(input: ExportInput): PersonReport[] {
  return input.metrics.byPerson.map((stat) => {
    const issues = input.issues.filter(
      (issue) => (issue.assignee?.accountId ?? UNASSIGNED_ID) === stat.accountId,
    );
    return {
      accountId: stat.accountId,
      name: stat.name,
      issues,
      done: issues.filter((issue) => issue.statusCategory === "done").sort(byResolvedNewestFirst),
      left: issues.filter((issue) => issue.statusCategory !== "done").sort(byUrgencyThenDueDate),
      todo: stat.todo,
      inProgress: stat.inProgress,
      overdue: stat.overdue,
      rate: stat.total ? stat.done / stat.total : 0,
    };
  });
}

export function fileName(input: ExportInput, extension: string) {
  const teamSlug = input.scope
    .split("·")[0]
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  const timestamp = dayjs().format("YYYYMMDD-HHmm");
  return `jira-${teamSlug || "report"}-${timestamp}.${extension}`;
}

export function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
