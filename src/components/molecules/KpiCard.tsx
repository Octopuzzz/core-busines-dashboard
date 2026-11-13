"use client";

import { AnimatePresence, motion } from "motion/react";
import { cn } from "@/lib/ui/cn";

type Tone = "ink" | "accent" | "done" | "overdue";
const tones: Record<Tone, string> = {
  ink: "text-ink",
  accent: "text-accent",
  done: "text-done",
  overdue: "text-overdue",
};

interface Props {
  label: string;
  display: string;
  value: number;
  foot?: string;
  tone?: Tone;
  progress?: number;
  delta?: number | null;
}

export function KpiCard({ label, display, value, foot, tone = "ink", progress, delta }: Props) {
  return (
    <div
      data-anim="kpi"
      className="min-w-0 rounded-lg border border-line bg-surface px-4 pt-4 pb-3.5 shadow-e1"
    >
      <div className="truncate text-[11px] font-medium tracking-[0.07em] text-muted uppercase">
        {label}
      </div>
      <div className="mt-2 flex items-center gap-2">
        <div
          data-kpi-value={value}
          className={cn(
            "text-[clamp(28px,2.8vw,36px)] leading-none font-semibold tracking-[-0.03em] tabular-nums",
            tones[tone],
          )}
        >
          {display}
        </div>
        <AnimatePresence>
          {delta ? (
            <motion.span
              key={delta}
              initial={{ opacity: 0, y: 6, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ type: "spring", stiffness: 520, damping: 30, delay: 0.35 }}
              className={cn(
                "inline-flex h-5 items-center rounded-pill px-1.5 font-mono text-[11px] font-semibold tabular-nums",
                delta > 0 ? "bg-ink text-bg" : "border border-ink/70 text-ink",
              )}
              aria-label={`${delta > 0 ? "up" : "down"} ${Math.abs(delta)} since last sync`}
            >
              {delta > 0 ? "▲" : "▼"}
              {Math.abs(delta)}
            </motion.span>
          ) : null}
        </AnimatePresence>
      </div>
      {progress != null ? (
        <div className="mt-3 h-[3px] overflow-hidden rounded-full bg-line">
          <span data-kpi-bar={progress} className="block h-full origin-left rounded-full bg-done" />
        </div>
      ) : (
        <div className="mt-2 truncate text-xs text-muted">{foot}</div>
      )}
    </div>
  );
}
