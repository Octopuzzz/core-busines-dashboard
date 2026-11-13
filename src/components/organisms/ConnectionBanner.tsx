import { CircleAlert, FlaskConical } from "lucide-react";
import { cn } from "@/lib/ui/cn";
import { Button } from "../atoms";

export function ConnectionBanner({
  kind,
  message,
  onRetry,
}: {
  kind: "sample" | "error";
  message?: string;
  onRetry?: () => void;
}) {
  return (
    <div
      role={kind === "error" ? "alert" : undefined}
      className={cn(
        "mb-4 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border px-4 py-3 text-[13px] text-ink-2",
        kind === "error" ? "border-overdue/30 bg-overdue/8" : "border-warn/35 bg-warn/8",
      )}
    >
      {kind === "error" ? (
        <CircleAlert className="size-4 shrink-0 text-overdue" />
      ) : (
        <FlaskConical className="size-4 shrink-0 text-warn" />
      )}
      <span className="min-w-0 flex-1">
        {kind === "error" ? (
          message
        ) : (
          <>
            Showing <b className="text-ink">sample data</b>. Add{" "}
            <code className="font-mono text-xs">JIRA_EMAIL</code> and{" "}
            <code className="font-mono text-xs">JIRA_API_TOKEN</code> to{" "}
            <code className="font-mono text-xs">.env.local</code> to load Jira.
          </>
        )}
      </span>
      {onRetry && (
        <Button size="sm" variant="secondary" onClick={onRetry}>
          Retry
        </Button>
      )}
    </div>
  );
}
