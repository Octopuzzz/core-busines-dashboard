/**
 * Date-range helpers for the filter bar. A range is either a rolling preset ("Last 90 days",
 * recomputed from today every time) or fixed custom dates.
 */
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

/** Concrete dates for a range (presets roll with today). Null means "no date limit". */
export function rangeDates(range: RangeSetting): { from: string; to: string } | null {
  if ("from" in range) return range;
  if (range.preset === "all") return null;

  const today = dayjs();
  const start =
    range.preset === "year" ? today.startOf("year") : today.subtract(range.preset, "day");
  return { from: start.format(ISO_DATE), to: today.format(ISO_DATE) };
}

/** Short label for the filter button: "Last 90 days" or "01 Aug – 12 Nov 26". */
export function rangeLabel(range: RangeSetting, long = false): string {
  if ("preset" in range) {
    return RANGE_PRESETS.find((option) => option.preset === range.preset)?.label ?? "";
  }
  const fromFormat = long ? "DD MMM YYYY" : "DD MMM";
  const toFormat = long ? "DD MMM YYYY" : "DD MMM YY";
  return `${dayjs(range.from).format(fromFormat)} – ${dayjs(range.to).format(toFormat)}`;
}

/** Sentence used under the team name and in exports: "Updated 14 Aug 2026 – 12 Nov 2026". */
export function periodLabel(range: RangeSetting): string {
  const dates = rangeDates(range);
  if (!dates) return "All time";
  const format = (date: string) => dayjs(date).format("DD MMM YYYY");
  return `Updated ${format(dates.from)} – ${format(dates.to)}`;
}
