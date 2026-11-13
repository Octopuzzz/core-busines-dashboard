"use client";

import { useMemo } from "react";
import type { Metrics } from "@/lib/metrics";
import { statusOption } from "@/lib/charts";
import { cn } from "@/lib/ui/cn";
import { EChart, Mono, StatusDot } from "../atoms";
import { Panel } from "../molecules";
import { useTheme } from "../providers/ThemeProvider";

const barColorByCategory = {
  new: "bg-todo",
  indeterminate: "bg-accent",
  done: "bg-done",
} as const;

interface Props {
  metrics: Metrics;
  active?: string;
  onPick: (status: string) => void;
  className?: string;
}

export function StatusPanel({ metrics, active, onPick, className }: Props) {
  const { palette } = useTheme();
  const doughnut = useMemo(() => statusOption(metrics, palette), [metrics, palette]);

  const openCounts = metrics.byStatus
    .filter((status) => status.category !== "done")
    .map((status) => status.count);
  const largestOpen = Math.max(1, ...openCounts);
  const barScale = (count: number) => Math.min(1, count / largestOpen);

  return (
    <Panel
      title="Status breakdown"
      hint={`${metrics.byStatus.length} statuses`}
      className={className}
    >
      <div className="grid gap-4 sm:grid-cols-[minmax(0,200px)_1fr] lg:grid-cols-1 xl:grid-cols-[minmax(0,190px)_1fr]">
        <EChart
          option={doughnut}
          className="mx-auto h-48 w-full max-w-[220px]"
          ariaLabel="Doughnut: issues by status category"
        />

        <ul className="max-h-[22rem] min-w-0 overflow-y-auto overscroll-contain pr-1">
          {metrics.byStatus.map((status) => {
            const isActive = active === status.name;
            const scale = barScale(status.count);
            return (
              <li key={status.name}>
                <button
                  type="button"
                  onClick={() => onPick(status.name)}
                  aria-pressed={isActive}
                  className={cn(
                    "grid w-full grid-cols-[auto_1fr_auto] items-center gap-x-2.5 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-surface-2",
                    isActive && "bg-accent/10",
                  )}
                >
                  <StatusDot category={status.category} />
                  <span className="truncate text-[13px] text-ink" title={status.name}>
                    {status.name}
                  </span>
                  <Mono className="text-xs text-ink-2">{status.count}</Mono>
                  <span className="col-start-2 col-end-4 mt-1 h-1 overflow-hidden rounded-full bg-line">
                    <span
                      data-bar={scale}
                      ref={(bar) => {
                        if (bar) bar.style.transform = `scaleX(${scale})`;
                      }}
                      className={cn(
                        "block h-full origin-left rounded-full transition-transform duration-500 ease-out",
                        barColorByCategory[status.category],
                      )}
                    />
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </Panel>
  );
}
