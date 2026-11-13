import dayjs from "dayjs";
import type { RangeSetting } from "@/lib/groups/store";

const ISO_DATE = "YYYY-MM-DD";

export const RANGE_PRESETS: { label: string; preset: 14 | 30 | 90 | "year" | "all" }[] = [
  { label: "Last 14 days", preset: 14 },
  { label: "Last 30 days", preset: 30 },
  { label: "Last 90 days", preset: 90 },
  { label: "This year", preset: "year" },
  { label: "All time", preset: "all" },
];

export function rangeDates(range: RangeSetting): { from: string; to: string } | null {
  if ("from" in range) return range;
  if (range.preset === "all") return null;

  const today = dayjs();
  const start =
    range.preset === "year" ? today.startOf("year") : today.subtract(range.preset, "day");
  return { from: start.format(ISO_DATE), to: today.format(ISO_DATE) };
}

export function rangeLabel(range: RangeSetting, long = false): string {
  if ("preset" in range) {
    return RANGE_PRESETS.find((option) => option.preset === range.preset)?.label ?? "";
  }
  const fromFormat = long ? "DD MMM YYYY" : "DD MMM";
  const toFormat = long ? "DD MMM YYYY" : "DD MMM YY";
  return `${dayjs(range.from).format(fromFormat)} – ${dayjs(range.to).format(toFormat)}`;
}

export function periodLabel(range: RangeSetting): string {
  const dates = rangeDates(range);
  if (!dates) return "All time";
  const format = (date: string) => dayjs(date).format("DD MMM YYYY");
  return `Updated ${format(dates.from)} – ${format(dates.to)}`;
}
