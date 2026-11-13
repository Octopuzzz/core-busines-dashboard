import dayjs, { type Dayjs } from "dayjs";
import type { Issue, StatusCategory } from "@/lib/jira/types";

export interface PersonStat {
  accountId: string;
  name: string;
  total: number;
  todo: number;
  inProgress: number;
  done: number;
  overdue: number;
}

export interface Metrics {
  total: number;
  open: number;
  done: number;
  overdue: number;
  avgCycleDays: number | null;
  completionRate: number;
  byPerson: PersonStat[];
  byStatus: { name: string; category: StatusCategory; count: number }[];
  byType: { name: string; count: number }[];
  byPriority: { name: string; count: number }[];
  trend: { week: string; created: number; resolved: number }[];
}

const UNASSIGNED_ID = "unassigned";
const TREND_WEEKS = 12;
const CATEGORY_ORDER: Record<StatusCategory, number> = { new: 0, indeterminate: 1, done: 2 };

export function isOverdue(issue: Issue, today: Dayjs = dayjs()): boolean {
  return issue.statusCategory !== "done" && !!issue.due && dayjs(issue.due).isBefore(today, "day");
}

function countBy<T>(items: T[], keyOf: (item: T) => string): Map<string, number> {
  const counts = new Map<string, number>();
  for (const item of items) {
    const key = keyOf(item);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

function toSortedList(counts: Map<string, number>) {
  return [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);
}

function average(values: number[]): number | null {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
}

function workloadPerPerson(issues: Issue[], today: Dayjs): PersonStat[] {
  const people = new Map<string, PersonStat>();

  for (const issue of issues) {
    const id = issue.assignee?.accountId ?? UNASSIGNED_ID;
    const stat = people.get(id) ?? {
      accountId: id,
      name: issue.assignee?.displayName ?? "Unassigned",
      total: 0,
      todo: 0,
      inProgress: 0,
      done: 0,
      overdue: 0,
    };

    stat.total++;
    if (issue.statusCategory === "done") stat.done++;
    else if (issue.statusCategory === "indeterminate") stat.inProgress++;
    else stat.todo++;
    if (isOverdue(issue, today)) stat.overdue++;

    people.set(id, stat);
  }

  return [...people.values()].sort((a, b) => b.total - a.total);
}

function statusBreakdown(issues: Issue[]): Metrics["byStatus"] {
  const categoryOf = new Map<string, StatusCategory>();
  for (const issue of issues) categoryOf.set(issue.status, issue.statusCategory);

  return [...countBy(issues, (issue) => issue.status).entries()]
    .map(([name, count]) => ({ name, count, category: categoryOf.get(name) ?? "new" }))
    .sort((a, b) => CATEGORY_ORDER[a.category] - CATEGORY_ORDER[b.category] || b.count - a.count);
}

function weeklyTrend(issues: Issue[], today: Dayjs): Metrics["trend"] {
  const thisWeek = today.startOf("week");

  return Array.from({ length: TREND_WEEKS }, (_, index) => {
    const weekStart = thisWeek.subtract(TREND_WEEKS - 1 - index, "week");
    const weekEnd = weekStart.add(1, "week");
    const inThisWeek = (date: string | null) =>
      !!date && !dayjs(date).isBefore(weekStart) && dayjs(date).isBefore(weekEnd);

    return {
      week: weekStart.format("DD MMM"),
      created: issues.filter((issue) => inThisWeek(issue.created)).length,
      resolved: issues.filter((issue) => inThisWeek(issue.resolved)).length,
    };
  });
}

export function computeMetrics(issues: Issue[]): Metrics {
  const today = dayjs();
  const doneIssues = issues.filter((issue) => issue.statusCategory === "done");
  const cycleDays = doneIssues
    .filter((issue) => issue.resolved)
    .map((issue) => dayjs(issue.resolved).diff(dayjs(issue.created), "hour") / 24);

  return {
    total: issues.length,
    open: issues.length - doneIssues.length,
    done: doneIssues.length,
    overdue: issues.filter((issue) => isOverdue(issue, today)).length,
    avgCycleDays: average(cycleDays),
    completionRate: issues.length ? doneIssues.length / issues.length : 0,
    byPerson: workloadPerPerson(issues, today),
    byStatus: statusBreakdown(issues),
    byType: toSortedList(countBy(issues, (issue) => issue.type)),
    byPriority: toSortedList(countBy(issues, (issue) => issue.priority)),
    trend: weeklyTrend(issues, today),
  };
}
