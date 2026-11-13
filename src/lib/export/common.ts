/**
 * Shared types and helpers for the PDF, Excel and PowerPoint exporters.
 */
import dayjs from "dayjs";
import type { Issue } from "@/lib/jira/types";
import type { Metrics } from "@/lib/metrics";
import { isOverdue } from "@/lib/metrics";

/** Everything an exporter needs — built by the Export dialog from the current dashboard state. */
export interface ExportInput {
  title: string;
  /** e.g. "Core Engineering · 6 people" */
  scope: string;
  /** e.g. "Updated 01 Aug 2026 – 12 Nov 2026" */
  period: string;
  source: "jira" | "sample";
  issues: Issue[];
  metrics: Metrics;
}

/** One person's slice of the export: their issues split into done and left. */
export interface PersonReport {
  accountId: string;
  name: string;
  issues: Issue[];
  /** Most recently resolved first. */
  done: Issue[];
  /** Not done: in progress before to do; overdue first; then by due date. */
  left: Issue[];
  todo: number;
  inProgress: number;
  overdue: number;
  /** done / total, 0–1. */
  rate: number;
}

const UNASSIGNED_ID = "unassigned";
const NO_DATE = "—";

/* -------------------------------------------------------------------------- */
/*  Formatting                                                                */
/* -------------------------------------------------------------------------- */

export const fmtDate = (date: string | null) =>
  date ? dayjs(date).format("DD MMM YYYY") : NO_DATE;

export const fmtDays = (days: number | null) => (days == null ? NO_DATE : `${days.toFixed(1)} d`);

/** An issue flattened into display strings — the same columns every exporter uses. */
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

/* -------------------------------------------------------------------------- */
/*  Grouping                                                                  */
/* -------------------------------------------------------------------------- */

/** Lower = shown earlier in "Left to do": in-progress before to-do, overdue first within each. */
function urgency(issue: Issue): number {
  const notStarted = issue.statusCategory === "indeterminate" ? 0 : 1;
  const notOverdue = isOverdue(issue) ? 0 : 1;
  return notStarted * 2 + notOverdue;
}

const byResolvedNewestFirst = (a: Issue, b: Issue) =>
  (b.resolved ?? "").localeCompare(a.resolved ?? "");

const byUrgencyThenDueDate = (a: Issue, b: Issue) =>
  urgency(a) - urgency(b) || (a.due ?? "9999").localeCompare(b.due ?? "9999");

/** Issues grouped per assignee, in the same order as metrics.byPerson (busiest first). */
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

/* -------------------------------------------------------------------------- */
/*  Files                                                                     */
/* -------------------------------------------------------------------------- */

/** "Core Engineering · 11 people" → "jira-core-engineering-20261112-1530.pdf" */
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

/** Saves a Blob as a file via a temporary download link. */
export function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Give the browser a moment to start the download before freeing the blob.
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
