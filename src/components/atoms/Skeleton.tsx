import { cn } from "@/lib/ui/cn";

export function Skeleton({ className }: { className?: string }) {
  return (
    <span aria-hidden className={cn("block animate-pulse rounded-md bg-line/70", className)} />
  );
}
