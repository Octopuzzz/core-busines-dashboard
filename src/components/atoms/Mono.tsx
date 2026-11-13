import { cn } from "@/lib/ui/cn";

/** Tabular monospace numbers/keys. */
export function Mono({ className, children }: { className?: string; children: React.ReactNode }) {
  return <span className={cn("font-mono tabular-nums", className)}>{children}</span>;
}
