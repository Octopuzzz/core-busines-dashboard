/**
 * Excel export.
 *
 * Sheets:
 *   Overview      — team totals + one row per person (each name links to their sheet)
 *   <one per person> — summary (done / left / overdue), parent issues, "Left to do", "Done"
 *   All issues    — every issue on one filterable sheet
 */
import type { Cell, Row, Workbook, Worksheet } from "exceljs";
import type { Issue } from "@/lib/jira/types";
import { color } from "@/design/tokens";
import type { ExportInput, IssueRow, PersonReport } from "./common";
import { byPerson, download, fileName, fmtDays, issueRow } from "./common";

const COLORS = color.light;
const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const OVERVIEW_SHEET = "Overview";
const ALL_ISSUES_SHEET = "All issues";

/** Excel colours are "AARRGGBB". */
const argb = (hex: string) => "FF" + hex.replace("#", "").toUpperCase();
const percent = (rate: number) => `${Math.round(rate * 100)}%`;

/** Columns used by every issue table (per-person sheets and "All issues"). */
const ISSUE_COLUMNS: { header: string; key: keyof IssueRow; width: number }[] = [
  { header: "Key", key: "key", width: 13 },
  { header: "Summary", key: "summary", width: 56 },
  { header: "Parent", key: "parentKey", width: 13 },
  { header: "Parent summary", key: "parentSummary", width: 40 },
  { header: "Parent type", key: "parentType", width: 12 },
  { header: "Status", key: "status", width: 22 },
  { header: "Type", key: "type", width: 11 },
  { header: "Priority", key: "priority", width: 10 },
  { header: "Due", key: "due", width: 13 },
  { header: "Updated", key: "updated", width: 13 },
  { header: "Resolved", key: "resolved", width: 13 },
];
const columnNumber = (key: keyof IssueRow) => ISSUE_COLUMNS.findIndex((c) => c.key === key) + 1;

/* -------------------------------------------------------------------------- */
/*  Cell styling helpers                                                      */
/* -------------------------------------------------------------------------- */

/** White bold text on a coloured band. */
function styleHeaderRow(row: Row, fill: string = COLORS.accent) {
  row.font = { bold: true, color: { argb: "FFFFFFFF" } };
  row.fill = { type: "pattern", pattern: "solid", fgColor: { argb: argb(fill) } };
  row.alignment = { vertical: "middle" };
  row.height = 22;
}

/** Turns a cell into a blue underlined hyperlink (skipped for sample data, which has no URL). */
function setLink(cell: Cell, text: string, url: string) {
  if (!text || !url || url === "#") return;
  cell.value = { text, hyperlink: url };
  cell.font = { color: { argb: argb(COLORS.accent) }, underline: true };
}

function setBoldColor(cell: Cell, hex: string) {
  cell.font = { bold: true, color: { argb: argb(hex) } };
}

function addMutedLine(sheet: Worksheet, text: string) {
  sheet.addRow([text]).font = { color: { argb: argb(COLORS.muted) } };
}

/**
 * Excel sheet names must be ≤ 31 characters, avoid []:*?/\' and be unique (case-insensitive).
 * Returns one safe name per person, never clashing with the reserved sheet names.
 */
function safeSheetNames(names: string[], reserved: string[]): string[] {
  const used = new Set(reserved.map((name) => name.toLowerCase()));

  return names.map((name) => {
    const base =
      name
        .replace(/[[\]:*?/\\']/g, " ")
        .trim()
        .slice(0, 31) || "Sheet";
    let candidate = base;
    for (let suffix = 2; used.has(candidate.toLowerCase()); suffix++) {
      candidate = `${base.slice(0, 28)} ${suffix}`;
    }
    used.add(candidate.toLowerCase());
    return candidate;
  });
}

/** A heading like "Left to do (12)" followed by an issue table (or a dash when empty). */
function addIssueTable(sheet: Worksheet, title: string, issues: Issue[], tone: string) {
  sheet.addRow([]);
  sheet.addRow([`${title} (${issues.length})`]).font = {
    bold: true,
    size: 12,
    color: { argb: argb(tone) },
  };

  if (!issues.length) {
    addMutedLine(sheet, "—");
    return;
  }

  styleHeaderRow(sheet.addRow(ISSUE_COLUMNS.map((column) => column.header)), tone);
  for (const issue of issues) {
    const values = issueRow(issue);
    const row = sheet.addRow(ISSUE_COLUMNS.map((column) => values[column.key]));
    setLink(row.getCell(columnNumber("key")), values.key, values.url);
    setLink(row.getCell(columnNumber("parentKey")), values.parentKey, values.parentUrl);
    if (values.overdue) setBoldColor(row.getCell(columnNumber("due")), COLORS.overdue);
  }
}

/* -------------------------------------------------------------------------- */
/*  Sheets                                                                    */
/* -------------------------------------------------------------------------- */

function addOverviewSheet(
  workbook: Workbook,
  input: ExportInput,
  people: PersonReport[],
  sheetNames: string[],
) {
  const { metrics } = input;
  const sheet = workbook.addWorksheet(OVERVIEW_SHEET, { views: [{ showGridLines: false }] });
  sheet.columns = [30, 10, 10, 10, 13, 10, 12, 12].map((width) => ({ width }));

  sheet.addRow([input.title]).font = { bold: true, size: 16 };
  addMutedLine(sheet, input.scope);
  addMutedLine(sheet, input.period);
  if (input.source === "sample") {
    setBoldColor(sheet.addRow(["SAMPLE DATA — not from Jira"]).getCell(1), COLORS.overdue);
  }

  // Team totals
  sheet.addRow([]);
  styleHeaderRow(sheet.addRow(["Team total", "Issues"]));
  const totals: [string, string | number][] = [
    ["Total", metrics.total],
    ["Done", metrics.done],
    ["Left (to do + in progress)", metrics.open],
    ["Overdue", metrics.overdue],
    ["Completion", percent(metrics.completionRate)],
    ["Avg. cycle time", fmtDays(metrics.avgCycleDays)],
  ];
  totals.forEach((total) => sheet.addRow(total));

  // One row per person
  sheet.addRow([]);
  styleHeaderRow(
    sheet.addRow([
      "Person",
      "Total",
      "Done",
      "Left",
      "In progress",
      "To do",
      "Overdue",
      "Completion",
    ]),
  );
  people.forEach((person, index) => {
    const row = sheet.addRow([
      person.name,
      person.issues.length,
      person.done.length,
      person.left.length,
      person.inProgress,
      person.todo,
      person.overdue,
      person.rate,
    ]);
    row.getCell(8).numFmt = "0%";
    // Clicking a name jumps to that person's sheet.
    setLink(row.getCell(1), person.name, `#'${sheetNames[index]}'!A1`);
    if (person.overdue) setBoldColor(row.getCell(7), COLORS.overdue);
  });
}

interface ParentSummary {
  summary: string;
  type: string;
  url: string;
  done: number;
  left: number;
}

/** The parent issues a person's work rolls up to, with how much is done / left under each. */
function parentsOf(issues: Issue[]): [string, ParentSummary][] {
  const parents = new Map<string, ParentSummary>();
  for (const issue of issues) {
    if (!issue.parent) continue;
    const entry = parents.get(issue.parent.key) ?? {
      summary: issue.parent.summary,
      type: issue.parent.type,
      url: issue.parent.url,
      done: 0,
      left: 0,
    };
    if (issue.statusCategory === "done") entry.done++;
    else entry.left++;
    parents.set(issue.parent.key, entry);
  }
  // Most remaining work first.
  return [...parents.entries()].sort(([, a], [, b]) => b.left - a.left || b.done - a.done);
}

function addPersonSheet(
  workbook: Workbook,
  input: ExportInput,
  person: PersonReport,
  sheetName: string,
) {
  const sheet = workbook.addWorksheet(sheetName, { views: [{ showGridLines: false }] });
  sheet.columns = ISSUE_COLUMNS.map((column) => ({ width: column.width }));

  const teamName = input.scope.split("·")[0].trim();
  sheet.addRow([person.name]).font = { bold: true, size: 16 };
  addMutedLine(sheet, `${teamName} · ${input.period}`);
  sheet.addRow([]);

  // Summary: what's done, what's left.
  styleHeaderRow(sheet.addRow(["Summary", "Count"]));
  const summary: { label: string; value: number | string; tone?: string }[] = [
    { label: "Total issues", value: person.issues.length },
    { label: "Done", value: person.done.length, tone: COLORS.done },
    { label: "Left", value: person.left.length, tone: COLORS.accent },
    { label: "  · In progress", value: person.inProgress },
    { label: "  · To do", value: person.todo },
    { label: "Overdue", value: person.overdue, tone: person.overdue ? COLORS.overdue : undefined },
    { label: "Completion", value: percent(person.rate) },
  ];
  for (const line of summary) {
    const row = sheet.addRow([line.label, line.value]);
    if (line.tone) setBoldColor(row.getCell(2), line.tone);
  }

  // Parent issues
  const parents = parentsOf(person.issues);
  if (parents.length) {
    sheet.addRow([]);
    sheet.addRow([`Parent issues (${parents.length})`]).font = { bold: true, size: 12 };
    styleHeaderRow(sheet.addRow(["Parent", "Summary", "Type", "Done", "Left"]), COLORS["ink-2"]);
    for (const [key, parent] of parents) {
      const row = sheet.addRow([key, parent.summary, parent.type, parent.done, parent.left]);
      setLink(row.getCell(1), key, parent.url);
    }
  }

  addIssueTable(sheet, "Left to do", person.left, COLORS.accent);
  addIssueTable(sheet, "Done", person.done, COLORS.done);
}

function addAllIssuesSheet(workbook: Workbook, issues: Issue[]) {
  const sheet = workbook.addWorksheet(ALL_ISSUES_SHEET, {
    views: [{ state: "frozen", ySplit: 1 }],
  });
  sheet.columns = [{ header: "Assignee", key: "assignee", width: 26 }, ...ISSUE_COLUMNS];
  styleHeaderRow(sheet.getRow(1));

  for (const issue of issues) {
    const values = issueRow(issue);
    const row = sheet.addRow(values);
    setLink(row.getCell("key"), values.key, values.url);
    setLink(row.getCell("parentKey"), values.parentKey, values.parentUrl);
  }

  sheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: ISSUE_COLUMNS.length + 1 },
  };
}

/* -------------------------------------------------------------------------- */
/*  Entry point                                                               */
/* -------------------------------------------------------------------------- */

export async function exportExcel(input: ExportInput) {
  // Loaded on demand so ExcelJS doesn't weigh down the dashboard.
  const ExcelJS = (await import("exceljs")).default;
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Kopnus Team Pulse";
  workbook.created = new Date();

  const people = byPerson(input);
  const sheetNames = safeSheetNames(
    people.map((person) => person.name),
    [OVERVIEW_SHEET, ALL_ISSUES_SHEET],
  );

  addOverviewSheet(workbook, input, people, sheetNames);
  people.forEach((person, index) => addPersonSheet(workbook, input, person, sheetNames[index]));
  addAllIssuesSheet(workbook, input.issues);

  const buffer = await workbook.xlsx.writeBuffer();
  download(new Blob([buffer], { type: XLSX_MIME }), fileName(input, "xlsx"));
}
