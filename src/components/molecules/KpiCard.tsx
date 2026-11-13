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
  /** Initial text; GSAP counts the number up into [data-kpi-value]. */
  display: string;
  value: number;
  foot?: string;
  tone?: Tone;
  /** 0–1 progress bar instead of footnote. */
  progress?: number;
}

/** One headline number card (label, big value, footnote or progress bar). Animated by KpiGrid. */
export function KpiCard({ label, display, value, foot, tone = "ink", progress }: Props) {
  return (
    <div
      data-anim="kpi"
      className="min-w-0 rounded-lg border border-line bg-surface px-4 pt-4 pb-3.5 shadow-e1"
    >
      <div className="truncate text-[11px] font-medium tracking-[0.07em] text-muted uppercase">
        {label}
      </div>
      <div
        data-kpi-value={value}
        className={cn(
          "mt-2 text-[clamp(28px,2.8vw,36px)] leading-none font-semibold tracking-[-0.03em] tabular-nums",
          tones[tone],
        )}
      >
        {display}
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
