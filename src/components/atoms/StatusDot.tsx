import { cn } from "@/lib/ui/cn";
import type { StatusCategory } from "@/lib/jira/types";

const tone: Record<StatusCategory | "overdue", string> = {
  new: "bg-todo",
  indeterminate: "bg-accent",
  done: "bg-done",
  overdue: "bg-overdue",
};

export function StatusDot({
  category,
  className,
}: {
  category: StatusCategory | "overdue";
  className?: string;
}) {
  return (
    <i
      aria-hidden
      className={cn("inline-block size-2 shrink-0 rounded-full", tone[category], className)}
    />
  );
}
