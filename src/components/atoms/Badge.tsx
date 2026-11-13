import { cn } from "@/lib/ui/cn";

type Tone = "neutral" | "accent" | "done" | "warn" | "overdue";
const tones: Record<Tone, string> = {
  neutral: "bg-surface-2 text-ink-2 border-line",
  accent: "bg-accent/10 text-accent border-accent/25",
  done: "bg-done/10 text-done border-done/25",
  warn: "bg-warn/10 text-warn border-warn/30",
  overdue: "bg-overdue/10 text-overdue border-overdue/25",
};

export function Badge({
  tone = "neutral",
  className,
  children,
}: {
  tone?: Tone;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center gap-1.5 rounded-pill border px-2.5 text-xs font-medium whitespace-nowrap",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
