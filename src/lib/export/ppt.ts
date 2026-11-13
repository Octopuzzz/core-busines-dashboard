/**
 * PowerPoint export.
 *
 * Charts are NATIVE PowerPoint charts — they stay editable in PowerPoint (hover values,
 * edit data, restyle) instead of being flat screenshots.
 *
 * Slides:
 *   01 Title · 02 At a glance (KPIs) · 03 Workload per person · 04 Status & types
 *   05 Created vs resolved · 06+ one slide per person (done vs left + what's next)
 */
import type PptxGenJS from "pptxgenjs";
import type { ExportInput, PersonReport } from "./common";
import { byPerson, fileName, fmtDays, issueRow } from "./common";
import { ACCENT, SERIES, STATUS_COLORS } from "@/lib/theme";

type Presentation = PptxGenJS;
type Slide = PptxGenJS.Slide;

/** Position and size in inches (the slide is 13.33 × 7.5). */
const box = (x: number, y: number, w: number, h: number) => ({ x, y, w, h });

/** pptxgenjs wants colours as "RRGGBB" without the hash. */
const hex = (color: string) => color.replace("#", "").toUpperCase();

const FONT = "Arial";
const INK = "1B1E24";
const MUTED = "6B7280";
const WHITE = "FFFFFF";
const TILE_FILL = "F7F8FA";
const TILE_BORDER = "E6E8EC";
const GRID_LINE = { color: "ECEEF2", size: 1 };

/** Rows of open work shown on each person's slide (the slide fits about this many). */
const MAX_ROWS_PER_PERSON = 9;

const percent = (rate: number) => `${Math.round(rate * 100)}%`;

/* -------------------------------------------------------------------------- */
/*  Shared slide pieces                                                       */
/* -------------------------------------------------------------------------- */

/** Accent bar on the left, slide number, title, and the scope line at the bottom. */
function addSlideFrame(
  pptx: Presentation,
  slide: Slide,
  input: ExportInput,
  title: string,
  number: number,
) {
  slide.background = { color: WHITE };
  slide.addShape(pptx.ShapeType.rect, {
    ...box(0, 0, 0.12, 7.5),
    fill: { color: hex(ACCENT) },
    line: { type: "none" },
  });
  slide.addText(String(number).padStart(2, "0"), {
    ...box(0.5, 0.35, 0.8, 0.4),
    fontFace: FONT,
    fontSize: 12,
    bold: true,
    color: hex(ACCENT),
  });
  slide.addText(title, {
    ...box(0.5, 0.65, 12, 0.7),
    fontFace: FONT,
    fontSize: 28,
    bold: true,
    color: INK,
  });
  slide.addText(input.scope, {
    ...box(0.5, 6.95, 8, 0.3),
    fontFace: FONT,
    fontSize: 10,
    color: MUTED,
  });
  if (input.source === "sample") {
    slide.addText("SAMPLE DATA", {
      ...box(10.3, 6.95, 2.6, 0.3),
      fontFace: FONT,
      fontSize: 10,
      bold: true,
      align: "right",
      color: hex(STATUS_COLORS.overdue),
    });
  }
}

interface Tile {
  label: string;
  value: string;
  color: string;
}

/** A rounded number tile: small caps label above a big value. */
function addTile(
  pptx: Presentation,
  slide: Slide,
  tile: Tile,
  area: { x: number; y: number; w: number; h: number; labelSize: number; valueSize: number },
) {
  slide.addShape(pptx.ShapeType.roundRect, {
    ...box(area.x, area.y, area.w, area.h),
    rectRadius: 0.07,
    fill: { color: TILE_FILL },
    line: { color: TILE_BORDER, width: 1 },
  });
  const inset = area.w * 0.07;
  slide.addText(tile.label.toUpperCase(), {
    ...box(area.x + inset, area.y + area.h * 0.08, area.w - inset * 2, area.h * 0.25),
    fontFace: FONT,
    fontSize: area.labelSize,
    color: MUTED,
    charSpacing: 1,
  });
  slide.addText(tile.value, {
    ...box(area.x + inset, area.y + area.h * 0.32, area.w - inset * 2, area.h * 0.55),
    fontFace: FONT,
    fontSize: area.valueSize,
    bold: true,
    color: tile.color,
  });
}

/** Chart options every native chart shares. */
const CHART_TEXT = {
  legendFontFace: FONT,
  catAxisLabelFontFace: FONT,
  valAxisLabelFontFace: FONT,
  valGridLine: GRID_LINE,
};

/* -------------------------------------------------------------------------- */
/*  Slides                                                                    */
/* -------------------------------------------------------------------------- */

function addTitleSlide(pptx: Presentation, input: ExportInput) {
  const slide = pptx.addSlide();
  slide.background = { color: INK };
  slide.addShape(pptx.ShapeType.rect, {
    ...box(0.6, 2.6, 0.9, 0.08),
    fill: { color: hex(ACCENT) },
    line: { type: "none" },
  });
  slide.addText(input.title, {
    ...box(0.6, 2.8, 12, 1.2),
    fontFace: FONT,
    fontSize: 44,
    bold: true,
    color: WHITE,
  });
  slide.addText(input.scope, {
    ...box(0.6, 4.0, 12, 0.5),
    fontFace: FONT,
    fontSize: 18,
    color: "C9CDD6",
  });
  slide.addText(input.period, {
    ...box(0.6, 4.5, 12, 0.4),
    fontFace: FONT,
    fontSize: 14,
    color: "8D94A1",
  });
  if (input.source === "sample") {
    slide.addText("SAMPLE DATA — not from Jira", {
      ...box(0.6, 6.6, 12, 0.4),
      fontFace: FONT,
      fontSize: 12,
      bold: true,
      color: hex(STATUS_COLORS.overdue),
    });
  }
}

function addKpiSlide(pptx: Presentation, input: ExportInput) {
  const { metrics } = input;
  const slide = pptx.addSlide();
  addSlideFrame(pptx, slide, input, "At a glance", 2);

  const tiles: Tile[] = [
    { label: "Total issues", value: String(metrics.total), color: INK },
    { label: "Open", value: String(metrics.open), color: hex(ACCENT) },
    { label: "Done", value: String(metrics.done), color: hex(STATUS_COLORS.done) },
    {
      label: "Overdue",
      value: String(metrics.overdue),
      color: metrics.overdue ? hex(STATUS_COLORS.overdue) : INK,
    },
    { label: "Completion", value: percent(metrics.completionRate), color: INK },
    { label: "Avg. cycle time", value: fmtDays(metrics.avgCycleDays), color: INK },
  ];

  // 3 × 2 grid
  tiles.forEach((tile, index) => {
    const column = index % 3;
    const row = Math.floor(index / 3);
    addTile(pptx, slide, tile, {
      ...box(0.5 + column * 4.15, 1.8 + row * 2.4, 3.9, 2.1),
      labelSize: 11,
      valueSize: 54,
    });
  });
}

function addWorkloadSlide(pptx: Presentation, input: ExportInput) {
  const slide = pptx.addSlide();
  addSlideFrame(pptx, slide, input, "Workload per person", 3);

  // Bar charts draw the first category at the bottom — reverse so the busiest person is on top.
  const people = [...input.metrics.byPerson].reverse();
  const names = people.map((person) => person.name);

  slide.addChart(
    pptx.ChartType.bar,
    [
      { name: "To Do", labels: names, values: people.map((person) => person.todo) },
      { name: "In Progress", labels: names, values: people.map((person) => person.inProgress) },
      { name: "Done", labels: names, values: people.map((person) => person.done) },
    ],
    {
      ...box(0.5, 1.5, 12.3, 5.3),
      barDir: "bar",
      barGrouping: "stacked",
      chartColors: [
        hex(STATUS_COLORS.new),
        hex(STATUS_COLORS.indeterminate),
        hex(STATUS_COLORS.done),
      ],
      showLegend: true,
      legendPos: "t",
      catAxisLabelFontSize: 11,
      showValue: false,
      ...CHART_TEXT,
    },
  );
}

function addStatusAndTypeSlide(pptx: Presentation, input: ExportInput) {
  const { byStatus, byType } = input.metrics;
  const slide = pptx.addSlide();
  addSlideFrame(pptx, slide, input, "Status & issue types", 4);

  slide.addChart(
    pptx.ChartType.doughnut,
    [
      {
        name: "Status",
        labels: byStatus.map((status) => status.name),
        values: byStatus.map((status) => status.count),
      },
    ],
    {
      ...box(0.5, 1.5, 6, 5.3),
      holeSize: 58,
      chartColors: byStatus.map((status) => hex(STATUS_COLORS[status.category])),
      showLegend: true,
      legendPos: "b",
      showPercent: true,
      dataLabelColor: WHITE,
      dataLabelFontFace: FONT,
      ...CHART_TEXT,
    },
  );

  slide.addChart(
    pptx.ChartType.bar,
    [
      {
        name: "Issues",
        labels: byType.map((type) => type.name),
        values: byType.map((type) => type.count),
      },
    ],
    {
      ...box(6.8, 1.5, 6, 5.3),
      barDir: "col",
      chartColors: SERIES.slice(0, Math.max(1, byType.length)).map(hex),
      showValue: true,
      dataLabelFontFace: FONT,
      ...CHART_TEXT,
    },
  );
}

function addTrendSlide(pptx: Presentation, input: ExportInput) {
  const { trend } = input.metrics;
  const slide = pptx.addSlide();
  addSlideFrame(pptx, slide, input, "Created vs resolved — last 12 weeks", 5);

  const weeks = trend.map((week) => week.week);
  slide.addChart(
    pptx.ChartType.line,
    [
      { name: "Created", labels: weeks, values: trend.map((week) => week.created) },
      { name: "Resolved", labels: weeks, values: trend.map((week) => week.resolved) },
    ],
    {
      ...box(0.5, 1.5, 12.3, 5.3),
      lineSize: 3,
      lineDataSymbol: "circle",
      lineDataSymbolSize: 7,
      chartColors: [hex(ACCENT), hex(STATUS_COLORS.done)],
      showLegend: true,
      legendPos: "t",
      ...CHART_TEXT,
    },
  );
}

/** One person: Done / Left / Overdue / Completion tiles, then the next open items with parents. */
function addPersonSlide(
  pptx: Presentation,
  input: ExportInput,
  person: PersonReport,
  number: number,
) {
  const slide = pptx.addSlide();
  addSlideFrame(pptx, slide, input, person.name, number);

  const tiles: Tile[] = [
    { label: "Done", value: String(person.done.length), color: hex(STATUS_COLORS.done) },
    { label: "Left", value: String(person.left.length), color: hex(ACCENT) },
    {
      label: "Overdue",
      value: String(person.overdue),
      color: person.overdue ? hex(STATUS_COLORS.overdue) : INK,
    },
    { label: "Completion", value: percent(person.rate), color: INK },
  ];
  tiles.forEach((tile, index) =>
    addTile(pptx, slide, tile, {
      ...box(0.5 + index * 3.1, 1.45, 2.95, 1.0),
      labelSize: 9,
      valueSize: 26,
    }),
  );

  if (!person.left.length) {
    slide.addText("Nothing left — all issues in this period are done.", {
      ...box(0.5, 2.8, 12, 0.5),
      fontFace: FONT,
      fontSize: 16,
      color: MUTED,
    });
    return;
  }

  const rows = person.left.slice(0, MAX_ROWS_PER_PERSON).map(issueRow);
  const isTruncated = person.left.length > rows.length;
  slide.addText(
    isTruncated ? `Left to do — top ${rows.length} of ${person.left.length}` : "Left to do",
    {
      ...box(0.5, 2.6, 12, 0.35),
      fontFace: FONT,
      fontSize: 12,
      bold: true,
      color: INK,
    },
  );

  const headerRow = ["Key", "Summary", "Parent", "Status", "Due"].map((label) => ({
    text: label,
    options: { bold: true, color: WHITE, fill: { color: hex(ACCENT) } },
  }));

  const bodyRows = rows.map((row) => {
    const hasLink = row.url !== "#";
    const parent = row.parentKey ? `${row.parentKey} · ${row.parentSummary}` : "—";
    return [
      {
        text: row.key,
        options: hasLink ? { hyperlink: { url: row.url }, color: hex(ACCENT) } : {},
      },
      { text: row.summary },
      { text: parent, options: { color: MUTED } },
      { text: row.status },
      {
        text: row.due,
        options: row.overdue ? { color: hex(STATUS_COLORS.overdue), bold: true } : {},
      },
    ];
  });

  slide.addTable([headerRow, ...bodyRows], {
    x: 0.5,
    y: 3.0,
    w: 12.3,
    colW: [1.2, 5.0, 3.4, 1.6, 1.1],
    rowH: 0.34,
    fontFace: FONT,
    fontSize: 10,
    color: INK,
    border: { type: "solid", color: GRID_LINE.color, pt: 1 },
    autoPage: false,
  });
}

/* -------------------------------------------------------------------------- */
/*  Entry point                                                               */
/* -------------------------------------------------------------------------- */

export async function exportPpt(input: ExportInput) {
  const PptxGenJS = (await import("pptxgenjs")).default;
  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_WIDE"; // 13.33 × 7.5 in
  pptx.title = input.title;

  addTitleSlide(pptx, input);
  addKpiSlide(pptx, input);
  addWorkloadSlide(pptx, input);
  addStatusAndTypeSlide(pptx, input);
  addTrendSlide(pptx, input);

  const FIRST_PERSON_SLIDE = 6;
  byPerson(input).forEach((person, index) =>
    addPersonSlide(pptx, input, person, FIRST_PERSON_SLIDE + index),
  );

  await pptx.writeFile({ fileName: fileName(input, "pptx") });
}
