"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowDown, ArrowUp } from "lucide-react";
import dayjs from "dayjs";
import type { Issue } from "@/lib/jira/types";
import { isOverdue } from "@/lib/metrics";
import { cn } from "@/lib/ui/cn";
import { Avatar, Mono, Skeleton, StatusDot } from "../atoms";
import { Pagination, Panel, Segmented } from "../molecules";

type SortKey = "key" | "assignee" | "status" | "due" | "updated";
type SortDirection = 1 | -1;
interface SortState {
  key: SortKey;
  direction: SortDirection;
}

const PAGE_SIZES = ["20", "50", "100"] as const;
type PageSize = (typeof PAGE_SIZES)[number];

/** The text each sortable column is compared by. Missing due dates sort last. */
const sortValue: Record<SortKey, (issue: Issue) => string> = {
  key: (issue) => issue.key,
  assignee: (issue) => issue.assignee?.displayName ?? "",
  status: (issue) => issue.status,
  due: (issue) => issue.due ?? "9999",
  updated: (issue) => issue.updated,
};

function sortIssues(issues: Issue[], sort: SortState): Issue[] {
  const valueOf = sortValue[sort.key];
  // numeric: true → "PROJ-9" sorts before "PROJ-10".
  return [...issues].sort(
    (a, b) => sort.direction * valueOf(a).localeCompare(valueOf(b), undefined, { numeric: true }),
  );
}

/* ---- Small cell components ------------------------------------------------------------ */

/** Issue key, linked to Jira (plain text for sample data). */
function KeyLink({ issue }: { issue: Issue }) {
  const keyClass = "font-mono text-[12.5px] text-accent whitespace-nowrap";
  if (issue.url === "#") return <span className={keyClass}>{issue.key}</span>;
  return (
    <a
      className={cn(keyClass, "hover:underline")}
      href={issue.url}
      target="_blank"
      rel="noreferrer"
    >
      {issue.key}
    </a>
  );
}

/** "↳ PARENT-1 Parent summary" line under an issue's summary. */
function ParentLine({ parent }: { parent: NonNullable<Issue["parent"]> }) {
  return (
    <div
      className="mt-0.5 flex min-w-0 items-center gap-1.5 text-xs text-muted"
      title={`${parent.type}: ${parent.summary}`}
    >
      <span className="shrink-0">↳</span>
      {parent.url === "#" ? (
        <span className="shrink-0 font-mono">{parent.key}</span>
      ) : (
        <a
          href={parent.url}
          target="_blank"
          rel="noreferrer"
          className="shrink-0 font-mono hover:text-accent hover:underline"
        >
          {parent.key}
        </a>
      )}
      <span className="truncate">{parent.summary}</span>
    </div>
  );
}

/** Due date, in red when overdue (with "Overdue by N days" on hover). */
function DueDate({ issue }: { issue: Issue }) {
  if (!issue.due) return <span className="text-muted">—</span>;
  const late = isOverdue(issue);
  const lateTooltip = late ? `Overdue by ${dayjs().diff(dayjs(issue.due), "day")} days` : undefined;
  return (
    <Mono className={cn("text-[12.5px]", late ? "font-semibold text-overdue" : "text-ink-2")}>
      <span title={lateTooltip}>{dayjs(issue.due).format("DD MMM")}</span>
    </Mono>
  );
}

function StatusLabel({ issue }: { issue: Issue }) {
  return (
    <span className="inline-flex items-center gap-2 text-[13px] whitespace-nowrap text-ink">
      <StatusDot category={issue.statusCategory} />
      {issue.status}
    </span>
  );
}

/** Column header; clickable (and shows an arrow) when the column is sortable. */
function ColumnHeader({
  sortKey,
  sort,
  onSort,
  children,
  className,
}: {
  sortKey?: SortKey;
  sort: SortState;
  onSort: (key: SortKey) => void;
  children: React.ReactNode;
  className?: string;
}) {
  const isSorted = sortKey !== undefined && sort.key === sortKey;
  const ariaSort = isSorted ? (sort.direction === 1 ? "ascending" : "descending") : undefined;
  const arrow =
    sort.direction === 1 ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />;

  return (
    <th
      scope="col"
      aria-sort={ariaSort}
      className={cn("h-10 px-3 text-left text-xs font-medium text-muted", className)}
    >
      {sortKey ? (
        <button
          type="button"
          onClick={() => onSort(sortKey)}
          className="inline-flex items-center gap-1 hover:text-ink"
        >
          {children}
          {isSorted && arrow}
        </button>
      ) : (
        children
      )}
    </th>
  );
}

/* ---- Rows ------------------------------------------------------------------------------ */

/** One row of the desktop table. */
function IssueTableRow({ issue }: { issue: Issue }) {
  return (
    <tr className="border-b border-line/70 transition-colors last:border-0 hover:bg-surface-2">
      <td className="px-3 py-2.5">
        <KeyLink issue={issue} />
      </td>
      <td className="max-w-0 px-3 py-2.5">
        <div className="truncate text-sm text-ink" title={issue.summary}>
          {issue.summary}
        </div>
        {issue.parent && <ParentLine parent={issue.parent} />}
      </td>
      <td className="px-3 py-2.5">
        {issue.assignee ? (
          <span className="inline-flex max-w-full items-center gap-2 text-[13px] text-ink">
            <Avatar name={issue.assignee.displayName} src={issue.assignee.avatarUrl} size="xs" />
            <span className="truncate">{issue.assignee.displayName}</span>
          </span>
        ) : (
          <span className="text-muted">Unassigned</span>
        )}
      </td>
      <td className="px-3 py-2.5">
        <StatusLabel issue={issue} />
      </td>
      <td className="hidden px-3 py-2.5 text-[13px] text-ink-2 lg:table-cell">{issue.priority}</td>
      <td className="px-3 py-2.5">
        <DueDate issue={issue} />
      </td>
      <td className="px-3 py-2.5">
        <Mono className="text-[12.5px] text-muted">{dayjs(issue.updated).format("DD MMM")}</Mono>
      </td>
    </tr>
  );
}

/** One card in the phone layout (replaces the table below the md breakpoint). */
function IssueCard({ issue }: { issue: Issue }) {
  return (
    <>
      <div className="flex items-center justify-between gap-2">
        <KeyLink issue={issue} />
        <StatusLabel issue={issue} />
      </div>
      <p className="mt-1.5 text-sm text-ink">{issue.summary}</p>
      {issue.parent && <ParentLine parent={issue.parent} />}
      <div className="mb-1.5" />
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
        {issue.assignee && (
          <span className="inline-flex items-center gap-1.5">
            <Avatar name={issue.assignee.displayName} src={issue.assignee.avatarUrl} size="xs" />
            {issue.assignee.displayName}
          </span>
        )}
        <span>{issue.priority}</span>
        <span className="inline-flex items-center gap-1">
          Due <DueDate issue={issue} />
        </span>
      </div>
    </>
  );
}

/* ---- List ------------------------------------------------------------------------------ */

/** The issue list: sortable, paginated table on desktop, animated cards on phones. */
export function IssueList({ issues, loading }: { issues: Issue[]; loading: boolean }) {
  const [sort, setSort] = useState<SortState>({ key: "updated", direction: -1 });
  const [pageSize, setPageSize] = useState<PageSize>("20");
  const [page, setPage] = useState(1);

  /** Clicking the sorted column flips direction; a new column starts ascending. */
  const sortBy = (key: SortKey) =>
    setSort((current) => ({
      key,
      direction: current.key === key ? (-current.direction as SortDirection) : 1,
    }));
  const headerProps = { sort, onSort: sortBy };

  const sortedIssues = useMemo(() => sortIssues(issues, sort), [issues, sort]);
  const rowsPerPage = Number(pageSize);
  const pageCount = Math.max(1, Math.ceil(sortedIssues.length / rowsPerPage));
  const currentPage = Math.min(page, pageCount); // filters may shrink the list under the current page
  const pageIssues = sortedIssues.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);

  const changePageSize = (size: PageSize) => {
    setPageSize(size);
    setPage(1);
  };

  const title = (
    <span>
      Issues <Mono className="ml-1 font-normal text-muted">{issues.length}</Mono>
    </span>
  );
  const pageSizePicker = (
    <Segmented
      ariaLabel="Rows per page"
      value={pageSize}
      onChange={changePageSize}
      options={PAGE_SIZES.map((size) => ({ value: size, label: size }))}
    />
  );

  if (loading && !issues.length) {
    return (
      <Panel title={title} hint={pageSizePicker}>
        <div className="grid gap-2 py-2">
          {Array.from({ length: 6 }, (_, index) => (
            <Skeleton key={index} className="h-9" />
          ))}
        </div>
      </Panel>
    );
  }

  if (!issues.length) {
    return (
      <Panel title={title} hint={pageSizePicker}>
        <p className="py-10 text-center text-sm text-muted">No issues match the current filters.</p>
      </Panel>
    );
  }

  return (
    <Panel title={title} hint={pageSizePicker}>
      {/* Desktop table */}
      <div className="-mx-1 hidden overflow-x-auto md:block">
        <table className="w-full min-w-[820px] border-collapse">
          <thead className="border-b border-line">
            <tr>
              <ColumnHeader {...headerProps} sortKey="key" className="w-28">
                Key
              </ColumnHeader>
              <ColumnHeader {...headerProps}>Summary</ColumnHeader>
              <ColumnHeader {...headerProps} sortKey="assignee" className="w-52">
                Assignee
              </ColumnHeader>
              <ColumnHeader {...headerProps} sortKey="status" className="w-36">
                Status
              </ColumnHeader>
              <ColumnHeader {...headerProps} className="hidden w-24 lg:table-cell">
                Priority
              </ColumnHeader>
              <ColumnHeader {...headerProps} sortKey="due" className="w-24">
                Due
              </ColumnHeader>
              <ColumnHeader {...headerProps} sortKey="updated" className="w-24">
                Updated
              </ColumnHeader>
            </tr>
          </thead>
          <tbody>
            {pageIssues.map((issue) => (
              <IssueTableRow key={issue.key} issue={issue} />
            ))}
          </tbody>
        </table>
      </div>

      {/* Phone cards */}
      <ul className="md:hidden">
        <AnimatePresence initial={false}>
          {pageIssues.map((issue) => (
            <motion.li
              key={issue.key}
              layout
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="border-b border-line py-3 last:border-0"
            >
              <IssueCard issue={issue} />
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>

      <div className="mt-3">
        <Pagination page={currentPage} pages={pageCount} onPage={setPage} />
      </div>
    </Panel>
  );
}
