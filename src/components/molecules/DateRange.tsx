"use client";

import dayjs from "dayjs";
import { CalendarRange } from "lucide-react";
import type { RangeSetting } from "@/lib/groups/store";
import { RANGE_PRESETS, rangeDates, rangeLabel } from "@/lib/range";
import { cn } from "@/lib/ui/cn";
import { Popover } from "./Popover";

const dateInput =
  "h-9 w-full rounded-md border border-line bg-surface px-2.5 font-mono text-[13px] text-ink outline-none focus:border-accent focus:ring-3 focus:ring-accent/15";

export function DateRange({
  value,
  onChange,
}: {
  value: RangeSetting;
  onChange: (r: RangeSetting) => void;
}) {
  const dates = rangeDates(value);
  const today = dayjs().format("YYYY-MM-DD");

  const setFrom = (from: string) => {
    if (from) onChange({ from, to: dates?.to ?? today });
  };
  const setTo = (to: string) => {
    if (to) onChange({ from: dates?.from ?? to, to });
  };
  return (
    <Popover
      align="end"
      className="w-[min(300px,calc(100vw-32px))] p-3"
      trigger={({ open, toggle }) => (
        <button
          type="button"
          onClick={toggle}
          aria-expanded={open}
          className={cn(
            "flex h-9 w-full min-w-0 items-center gap-2 rounded-md border border-line bg-surface px-3 text-left text-sm text-ink",
            "transition-colors hover:border-line-strong focus-visible:outline-2 focus-visible:outline-accent",
            open && "border-accent ring-3 ring-accent/15",
          )}
        >
          <CalendarRange className="size-4 shrink-0 text-muted" />
          <span className="truncate">{rangeLabel(value)}</span>
        </button>
      )}
    >
      {(close) => (
        <div className="grid gap-3">
          <div className="flex flex-wrap gap-1.5">
            {RANGE_PRESETS.map((preset) => {
              const isCurrent = "preset" in value && value.preset === preset.preset;
              return (
                <button
                  key={preset.label}
                  type="button"
                  aria-pressed={isCurrent}
                  onClick={() => {
                    onChange({ preset: preset.preset });
                    close();
                  }}
                  className={cn(
                    "h-7 rounded-pill border px-2.5 text-xs transition-colors",
                    isCurrent
                      ? "border-accent bg-accent/10 text-accent"
                      : "border-line text-ink-2 hover:border-accent hover:text-accent",
                  )}
                >
                  {preset.label}
                </button>
              );
            })}
          </div>
          <p className="text-[11px] text-muted">
            Presets roll forward with today. Custom dates stay fixed.
          </p>
          <div className="grid grid-cols-2 gap-2">
            <label className="grid gap-1 text-xs text-muted">
              From
              <input
                type="date"
                className={dateInput}
                value={dates?.from ?? ""}
                max={dates?.to ?? today}
                onChange={(event) => setFrom(event.target.value)}
              />
            </label>
            <label className="grid gap-1 text-xs text-muted">
              To
              <input
                type="date"
                className={dateInput}
                value={dates?.to ?? ""}
                min={dates?.from}
                onChange={(event) => setTo(event.target.value)}
              />
            </label>
          </div>
        </div>
      )}
    </Popover>
  );
}
