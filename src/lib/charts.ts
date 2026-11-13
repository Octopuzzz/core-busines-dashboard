/**
 * ECharts option builders.
 *
 * Shared by the live dashboard charts and the PDF export (which renders the same options
 * off-screen), so a chart looks the same on screen and on paper.
 */
import type { EChartsOption, TooltipComponentOption } from "echarts";
import type { Metrics } from "./metrics";
import type { ChartPalette } from "./theme";

const FONT = "var(--font-geist-sans), system-ui, sans-serif";

/* -------------------------------------------------------------------------- */
/*  Shared building blocks                                                    */
/* -------------------------------------------------------------------------- */

function baseTooltip(palette: ChartPalette): TooltipComponentOption {
  return {
    backgroundColor: palette.tooltipBg,
    borderColor: palette.grid,
    textStyle: { color: palette.text, fontSize: 12 },
    extraCssText: "box-shadow:0 8px 24px rgba(0,0,0,.12);border-radius:8px;",
  };
}

/** Settings every chart shares: animation, font and tooltip look. */
function baseOption(palette: ChartPalette, animate: boolean): EChartsOption {
  return {
    animation: animate,
    animationDuration: 700,
    animationEasing: "cubicOut",
    textStyle: { fontFamily: FONT, color: palette.text },
    tooltip: baseTooltip(palette),
  };
}

/** Legend in the top-right corner with small rounded swatches. */
function topRightLegend(palette: ChartPalette, swatchHeight: number) {
  return {
    top: 0,
    right: 0,
    icon: "roundRect",
    itemWidth: 10,
    itemHeight: swatchHeight,
    textStyle: { color: palette.subtle },
  };
}

/** A numeric axis with light grid lines. */
function valueAxis(palette: ChartPalette) {
  return {
    type: "value" as const,
    splitLine: { lineStyle: { color: palette.grid } },
    axisLabel: { color: palette.subtle },
  };
}

/* -------------------------------------------------------------------------- */
/*  Workload per person                                                       */
/* -------------------------------------------------------------------------- */

/** Stacked horizontal bars: each person's issues split into To Do / In Progress / Done. */
export function workloadOption(
  metrics: Metrics,
  palette: ChartPalette,
  animate = true,
): EChartsOption {
  // ECharts draws the first category at the bottom; reverse so the busiest person is on top.
  const people = [...metrics.byPerson].reverse();

  const stackedBar = (name: string, field: "todo" | "inProgress" | "done", color: string) => ({
    name,
    type: "bar" as const,
    stack: "workload",
    barMaxWidth: 18,
    itemStyle: { color, borderRadius: 0 },
    emphasis: { focus: "series" as const },
    data: people.map((person) => person[field]),
  });

  return {
    ...baseOption(palette, animate),
    tooltip: { ...baseTooltip(palette), trigger: "axis", axisPointer: { type: "shadow" } },
    legend: topRightLegend(palette, 10),
    grid: { left: 8, right: 16, top: 32, bottom: 8, containLabel: true },
    xAxis: valueAxis(palette),
    yAxis: {
      type: "category",
      data: people.map((person) => person.name),
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { color: palette.text, width: 170, overflow: "truncate", fontSize: 12 },
    },
    series: [
      stackedBar("To Do", "todo", palette.status.new),
      stackedBar("In Progress", "inProgress", palette.status.indeterminate),
      stackedBar("Done", "done", palette.status.done),
    ],
  };
}

/* -------------------------------------------------------------------------- */
/*  Status breakdown                                                          */
/* -------------------------------------------------------------------------- */

const CATEGORY_LABEL = { new: "To Do", indeterminate: "In Progress", done: "Done" } as const;
const CATEGORIES = ["new", "indeterminate", "done"] as const;

/**
 * Doughnut with one slice per status category (To Do / In Progress / Done) and the total
 * in the middle. The per-status detail is shown as a list next to it (see StatusPanel).
 */
export function statusOption(
  metrics: Metrics,
  palette: ChartPalette,
  animate = true,
): EChartsOption {
  const slices = CATEGORIES.map((category) => ({
    category,
    name: CATEGORY_LABEL[category],
    value: metrics.byStatus
      .filter((status) => status.category === category)
      .reduce((sum, status) => sum + status.count, 0),
  })).filter((slice) => slice.value > 0);

  return {
    ...baseOption(palette, animate),
    tooltip: { ...baseTooltip(palette), trigger: "item", formatter: "{b}: <b>{c}</b> ({d}%)" },
    title: {
      text: String(metrics.total),
      subtext: "issues",
      left: "center",
      top: "38%",
      textStyle: { color: palette.text, fontSize: 26, fontWeight: 600 },
      subtextStyle: { color: palette.subtle, fontSize: 12 },
    },
    series: [
      {
        type: "pie",
        cursor: "default", // display only — the status list is the click target
        radius: ["62%", "86%"],
        center: ["50%", "50%"],
        padAngle: 2,
        itemStyle: { borderRadius: 4 },
        label: { show: false },
        emphasis: { scale: true, scaleSize: 5 },
        data: slices.map((slice) => ({
          name: slice.name,
          value: slice.value,
          itemStyle: { color: palette.status[slice.category] },
        })),
      },
    ],
  };
}

/* -------------------------------------------------------------------------- */
/*  Created vs resolved                                                       */
/* -------------------------------------------------------------------------- */

/** One smooth line with a faint area fill. */
function trendLine(name: string, color: string, data: number[]) {
  return {
    name,
    type: "line" as const,
    cursor: "default", // lines aren't clickable
    smooth: 0.3,
    symbol: "circle",
    symbolSize: 6,
    showSymbol: false,
    lineStyle: { width: 2, color },
    itemStyle: { color },
    areaStyle: { color, opacity: 0.08 },
    data,
  };
}

/** Issues created vs resolved per week, last 12 weeks. */
export function trendOption(
  metrics: Metrics,
  palette: ChartPalette,
  animate = true,
): EChartsOption {
  return {
    ...baseOption(palette, animate),
    tooltip: { ...baseTooltip(palette), trigger: "axis" },
    legend: topRightLegend(palette, 3),
    grid: { left: 8, right: 16, top: 32, bottom: 8, containLabel: true },
    xAxis: {
      type: "category",
      boundaryGap: false,
      data: metrics.trend.map((week) => week.week),
      axisLine: { lineStyle: { color: palette.grid } },
      axisLabel: { color: palette.subtle },
    },
    yAxis: valueAxis(palette),
    series: [
      trendLine(
        "Created",
        palette.series[0],
        metrics.trend.map((week) => week.created),
      ),
      trendLine(
        "Resolved",
        palette.status.done,
        metrics.trend.map((week) => week.resolved),
      ),
    ],
  };
}

/* -------------------------------------------------------------------------- */
/*  Issue types                                                               */
/* -------------------------------------------------------------------------- */

/** Vertical bars, one per issue type, each in its own series colour. */
export function typeOption(metrics: Metrics, palette: ChartPalette, animate = true): EChartsOption {
  return {
    ...baseOption(palette, animate),
    tooltip: { ...baseTooltip(palette), trigger: "axis", axisPointer: { type: "shadow" } },
    grid: { left: 8, right: 16, top: 8, bottom: 8, containLabel: true },
    xAxis: {
      type: "category",
      data: metrics.byType.map((type) => type.name),
      axisTick: { show: false },
      axisLine: { lineStyle: { color: palette.grid } },
      axisLabel: { color: palette.subtle },
    },
    yAxis: valueAxis(palette),
    series: [
      {
        type: "bar",
        barMaxWidth: 28,
        data: metrics.byType.map((type, index) => ({
          value: type.count,
          itemStyle: {
            color: palette.series[index % palette.series.length],
            borderRadius: [4, 4, 0, 0],
          },
        })),
      },
    ],
  };
}
