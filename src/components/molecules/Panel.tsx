import { cn } from "@/lib/ui/cn";

interface Props {
  title: React.ReactNode;
  hint?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}

export function Panel({ title, hint, className, children }: Props) {
  return (
    <section
      data-anim="panel"
      className={cn(
        "min-w-0 rounded-lg border border-line bg-surface p-4 shadow-e1 sm:p-5",
        className,
      )}
    >
      <header className="mb-2 flex items-baseline justify-between gap-3">
        <h3 className="text-sm font-semibold tracking-tight text-ink">{title}</h3>
        {hint && <span className="text-xs text-muted">{hint}</span>}
      </header>
      {children}
    </section>
  );
}
