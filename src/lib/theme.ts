import { color, series } from "@/design/tokens";

export const ACCENT = color.light.accent;

export const STATUS_COLORS = {
  new: color.light.todo,
  indeterminate: color.light.accent,
  done: color.light.done,
  overdue: color.light.overdue,
} as const;

export const SERIES = series;

export interface ChartPalette {
  text: string;
  subtle: string;
  grid: string;
  bg: string;
  tooltipBg: string;
  status: { new: string; indeterminate: string; done: string; overdue: string };
  series: string[];
}

export const PALETTE_LIGHT: ChartPalette = {
  text: color.light.ink,
  subtle: color.light.muted,
  grid: color.light.line,
  bg: color.light.surface,
  tooltipBg: color.light.surface,
  status: STATUS_COLORS,
  series,
};

export const PALETTE_DARK: ChartPalette = {
  text: color.dark.ink,
  subtle: color.dark.muted,
  grid: color.dark.line,
  bg: color.dark.surface,
  tooltipBg: color.dark["surface-2"],
  status: {
    new: color.dark.todo,
    indeterminate: color.dark.accent,
    done: color.dark.done,
    overdue: color.dark.overdue,
  },
  series: [color.dark.accent, ...series.slice(1)],
};
