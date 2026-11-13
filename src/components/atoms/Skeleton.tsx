import { cn } from "@/lib/ui/cn";

/** Pulsing grey placeholder shown while content loads. */
export function Skeleton({ className }: { className?: string }) {
  return (
    <span aria-hidden className={cn("block animate-pulse rounded-md bg-line/70", className)} />
  );
}
