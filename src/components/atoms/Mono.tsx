import { cn } from "@/lib/ui/cn";

export function Mono({ className, children }: { className?: string; children: React.ReactNode }) {
  return <span className={cn("font-mono tabular-nums", className)}>{children}</span>;
}
