import type { jsPDF as JsPdf } from "jspdf";
import type { Issue } from "@/lib/jira/types";
import type { ExportInput, PersonReport } from "./common";
import { byPerson, download, fileName, fmtDays, issueRow } from "./common";
import { chartToImage } from "./chartImage";
import { statusOption, trendOption, workloadOption } from "@/lib/charts";
import { ACCENT, PALETTE_LIGHT, STATUS_COLORS } from "@/lib/theme";

type Rgb = [number, number, number];
type AutoTable = typeof import("jspdf-autotable").autoTable;

function rgb(hex: string): Rgb {
  const value = parseInt(hex.slice(1), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

const INK: Rgb = [27, 30, 36];
const MUTED: Rgb = [107, 114, 128];
const ZEBRA: Rgb = [248, 249, 251];
const TILE_BORDER: Rgb = [230, 232, 236];

const MARGIN = 40;
const percent = (rate: number) => `${Math.round(rate * 100)}%`;

const CHART = {
  width: 900,
  statusHeight: 520,
  trendWidth: 1800,
  trendHeight: 520,
  workloadHeight: (people: number) => Math.max(360, people * 34 + 60),
};

function setText(doc: JsPdf, size: number, color: Rgb, weight: "normal" | "bold" = "normal") {
  doc
    .setFont("helvetica", weight)
    .setFontSize(size)
    .setTextColor(...color);
}

function lastTableBottom(doc: JsPdf): number {
  return (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;
}

function drawHeader(doc: JsPdf, input: ExportInput, pageWidth: number) {
  setText(doc, 22, INK, "bold");
  doc.text(input.title, MARGIN, 56);
  setText(doc, 11, MUTED);
  doc.text(`${input.scope}   ·   ${input.period}`, MARGIN, 76);

  if (input.source === "sample") {
    setText(doc, 11, rgb(STATUS_COLORS.overdue), "bold");
    doc.text("SAMPLE DATA — not from Jira", pageWidth - MARGIN, 56, { align: "right" });
  }
}

function drawKpiStrip(doc: JsPdf, input: ExportInput, pageWidth: number) {
  const { metrics } = input;
  const kpis: { label: string; value: string; color: Rgb }[] = [
    { label: "Total", value: String(metrics.total), color: INK },
    { label: "Open", value: String(metrics.open), color: INK },
    { label: "Done", value: String(metrics.done), color: INK },
    {
      label: "Overdue",
      value: String(metrics.overdue),
      color: metrics.overdue ? rgb(STATUS_COLORS.overdue) : INK,
    },
    { label: "Completion", value: percent(metrics.completionRate), color: INK },
    { label: "Avg. cycle", value: fmtDays(metrics.avgCycleDays), color: INK },
  ];

  const gap = 10;
  const tileWidth = (pageWidth - MARGIN * 2 - gap * (kpis.length - 1)) / kpis.length;
  const top = 96;

  kpis.forEach((kpi, index) => {
    const x = MARGIN + index * (tileWidth + gap);
    doc
      .setDrawColor(...TILE_BORDER)
      .setFillColor(...ZEBRA)
      .roundedRect(x, top, tileWidth, 58, 6, 6, "FD");
    setText(doc, 9, MUTED);
    doc.text(kpi.label.toUpperCase(), x + 12, top + 18);
    setText(doc, 20, kpi.color, "bold");
    doc.text(kpi.value, x + 12, top + 46);
  });
}

async function drawFirstPageCharts(doc: JsPdf, input: ExportInput, pageWidth: number) {
  const { metrics } = input;
  const columnGap = 16;
  const halfWidth = (pageWidth - MARGIN * 2 - columnGap) / 2;
  const workloadPx = CHART.workloadHeight(metrics.byPerson.length);

  const [workloadImage, statusImage] = await Promise.all([
    chartToImage(workloadOption(metrics, PALETTE_LIGHT, false), CHART.width, workloadPx),
    chartToImage(statusOption(metrics, PALETTE_LIGHT, false), CHART.width, CHART.statusHeight),
  ]);

  const titleY = 180;
  const imageY = 190;
  setText(doc, 11, INK, "bold");
  doc.text("Workload per person", MARGIN, titleY);
  doc.text("Status breakdown", MARGIN + halfWidth + columnGap, titleY);

  const workloadHeight = Math.min(320, halfWidth * (workloadPx / CHART.width));
  const statusHeight = halfWidth * (CHART.statusHeight / CHART.width);
  doc.addImage(workloadImage, "JPEG", MARGIN, imageY, halfWidth, workloadHeight, undefined, "FAST");
  doc.addImage(
    statusImage,
    "JPEG",
    MARGIN + halfWidth + columnGap,
    imageY,
    halfWidth,
    statusHeight,
    undefined,
    "FAST",
  );
}

async function drawTrendAndTeamTable(
  doc: JsPdf,
  autoTable: AutoTable,
  input: ExportInput,
  pageWidth: number,
) {
  const { metrics } = input;
  doc.addPage();
  setText(doc, 11, INK, "bold");
  doc.text("Created vs resolved — last 12 weeks", MARGIN, 50);

  const trendImage = await chartToImage(
    trendOption(metrics, PALETTE_LIGHT, false),
    CHART.trendWidth,
    CHART.trendHeight,
  );
  const width = pageWidth - MARGIN * 2;
  const height = width * (CHART.trendHeight / CHART.trendWidth);
  doc.addImage(trendImage, "JPEG", MARGIN, 60, width, height, undefined, "FAST");

  autoTable(doc, {
    startY: 60 + height + 24,
    head: [["Person", "Total", "To Do", "In Progress", "Done", "Overdue", "Completion"]],
    body: metrics.byPerson.map((person) => [
      person.name,
      person.total,
      person.todo,
      person.inProgress,
      person.done,
      person.overdue,
      percent(person.total ? person.done / person.total : 0),
    ]),
    styles: { font: "helvetica", fontSize: 9, cellPadding: 5 },
    headStyles: { fillColor: rgb(ACCENT), textColor: 255 },
    alternateRowStyles: { fillColor: ZEBRA },
    margin: { left: MARGIN, right: MARGIN },
  });
}

const ISSUE_HEADER = ["Key", "Summary", "Parent", "Status", "Priority", "Due", "Updated"];
const DUE_COLUMN = 5;
const OVERDUE_MARK = "  !";

function issueTableRows(issues: Issue[]) {
  return issues.map((issue) => {
    const row = issueRow(issue);
    return [
      row.key,
      row.summary,
      row.parentKey ? `${row.parentKey} ${row.parentSummary}` : "—",
      row.status,
      row.priority,
      row.due + (row.overdue ? OVERDUE_MARK : ""),
      row.updated,
    ];
  });
}

function drawIssueTable(
  doc: JsPdf,
  autoTable: AutoTable,
  startY: number,
  issues: Issue[],
  headerColor: Rgb,
) {
  autoTable(doc, {
    startY,
    head: [ISSUE_HEADER],
    body: issueTableRows(issues),
    styles: { font: "helvetica", fontSize: 8, cellPadding: 4, overflow: "linebreak" },
    columnStyles: {
      0: { cellWidth: 60 },
      1: { cellWidth: "auto" },
      2: { cellWidth: 170 },
      3: { cellWidth: 90 },
      4: { cellWidth: 50 },
      5: { cellWidth: 56 },
      6: { cellWidth: 56 },
    },
    headStyles: { fillColor: headerColor, textColor: 255 },
    alternateRowStyles: { fillColor: ZEBRA },
    margin: { left: MARGIN, right: MARGIN },
    didParseCell: (cell) => {
      const isOverdueDate =
        cell.section === "body" &&
        cell.column.index === DUE_COLUMN &&
        String(cell.cell.raw).endsWith(OVERDUE_MARK.trim());
      if (isOverdueDate) {
        cell.cell.styles.textColor = rgb(STATUS_COLORS.overdue);
        cell.cell.styles.fontStyle = "bold";
      }
    },
  });
}

function personSummaryLine(person: PersonReport): string {
  return [
    `${person.issues.length} issues`,
    `${person.done.length} done`,
    `${person.left.length} left (${person.inProgress} in progress, ${person.todo} to do)`,
    `${person.overdue} overdue`,
    `${percent(person.rate)} complete`,
  ].join("   ·   ");
}

function drawPersonSection(doc: JsPdf, autoTable: AutoTable, person: PersonReport) {
  doc.addPage();
  setText(doc, 18, INK, "bold");
  doc.text(person.name, MARGIN, 52);
  setText(doc, 10, MUTED);
  doc.text(personSummaryLine(person), MARGIN, 70);

  const accent = rgb(ACCENT);
  setText(doc, 11, accent, "bold");
  doc.text(`Left to do (${person.left.length})`, MARGIN, 96);
  if (person.left.length) drawIssueTable(doc, autoTable, 104, person.left, accent);

  let doneTop = person.left.length ? lastTableBottom(doc) + 26 : 118;
  if (doneTop > doc.internal.pageSize.getHeight() - 80) {
    doc.addPage();
    doneTop = 50;
  }
  const green = rgb(STATUS_COLORS.done);
  setText(doc, 11, green, "bold");
  doc.text(`Done (${person.done.length})`, MARGIN, doneTop);
  if (person.done.length) drawIssueTable(doc, autoTable, doneTop + 8, person.done, green);
}

function drawFooters(doc: JsPdf, pageWidth: number) {
  const pageCount = doc.getNumberOfPages();
  const footerY = doc.internal.pageSize.getHeight() - 20;
  const generatedAt = `Generated ${new Date().toLocaleString()}`;

  for (let page = 1; page <= pageCount; page++) {
    doc.setPage(page);
    doc.setFont("helvetica", "normal").setFontSize(8).setTextColor(150);
    doc.text(generatedAt, MARGIN, footerY);
    doc.text(`${page} / ${pageCount}`, pageWidth - MARGIN, footerY, { align: "right" });
  }
}

export async function exportPdf(input: ExportInput) {
  const [{ jsPDF }, { autoTable }] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4", compress: true });
  const pageWidth = doc.internal.pageSize.getWidth();

  drawHeader(doc, input, pageWidth);
  drawKpiStrip(doc, input, pageWidth);
  await drawFirstPageCharts(doc, input, pageWidth);
  await drawTrendAndTeamTable(doc, autoTable, input, pageWidth);
  for (const person of byPerson(input)) drawPersonSection(doc, autoTable, person);
  drawFooters(doc, pageWidth);

  download(doc.output("blob"), fileName(input, "pdf"));
}
