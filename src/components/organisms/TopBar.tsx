"use client";

import { Database, Download, Moon, Sun, Users } from "lucide-react";
import type { StorageStatus } from "@/lib/groups/store";
import { cn } from "@/lib/ui/cn";
import { Button } from "../atoms";
import { useTheme } from "../providers/ThemeProvider";

export type Connection = "live" | "sample" | "error" | "checking";

const pill: Record<Connection, { dot: string; label: string }> = {
  live: { dot: "bg-done shadow-[0_0_0_3px] shadow-done/20", label: "Live · Jira" },
  sample: { dot: "bg-warn shadow-[0_0_0_3px] shadow-warn/20", label: "Sample data" },
  error: { dot: "bg-overdue shadow-[0_0_0_3px] shadow-overdue/20", label: "Jira error" },
  checking: { dot: "bg-todo animate-pulse", label: "Connecting…" },
};

interface Props {
  connection: Connection;
  site?: string | null;
  canExport: boolean;
  onExport: () => void;
  onTeams: () => void;
  storage: StorageStatus;
}

const storageUi: Record<StorageStatus["mode"], { tone: string; label: string }> = {
  loading: { tone: "text-muted", label: "Loading teams…" },
  database: { tone: "text-done", label: "Teams saved to database" },
  browser: {
    tone: "text-warn",
    label: "No database configured — teams saved in this browser only",
  },
  error: { tone: "text-overdue", label: "Database error" },
};

/** Sticky top bar: logo, Jira and storage status, theme toggle, Team and Export buttons. */
export function TopBar({ connection, site, canExport, onExport, onTeams, storage }: Props) {
  const { mode, toggle } = useTheme();
  return (
    <header className="sticky top-0 z-30 -mx-4 mb-6 flex items-center gap-3 border-b border-line bg-bg/80 px-4 py-3 backdrop-blur-md backdrop-saturate-150 sm:-mx-6 sm:px-6">
      <div className="flex min-w-0 items-center gap-2.5">
        <div
          title="Kopnus logo goes here"
          className="grid size-8 shrink-0 place-items-center rounded-md border border-dashed border-line-strong text-[9px] text-muted"
        >
          logo
        </div>
        <div className="min-w-0">
          <div className="truncate text-[15px] font-semibold tracking-tight text-ink">
            Team Pulse
          </div>
          <div className="hidden truncate text-xs text-muted sm:block">
            Jira workload · corekopnus
          </div>
        </div>
      </div>

      <div className="ml-auto flex items-center gap-2">
        <span
          title={site ?? undefined}
          className="inline-flex h-7 items-center gap-2 rounded-pill border border-line bg-surface px-2.5 text-xs text-ink-2"
        >
          <span className={cn("size-[7px] rounded-full", pill[connection].dot)} />
          <span className="hidden sm:inline">{pill[connection].label}</span>
        </span>
        <span
          role="status"
          title={
            storage.mode === "error"
              ? storage.error
              : storage.pending
                ? "Saving to database…"
                : storageUi[storage.mode].label
          }
          aria-label={storage.mode === "error" ? storage.error : storageUi[storage.mode].label}
          className={cn(
            "inline-flex h-7 items-center gap-1.5 rounded-pill border border-line bg-surface px-2.5 text-xs",
            storageUi[storage.mode].tone,
          )}
        >
          <Database className={cn("size-3.5", storage.pending && "animate-pulse")} />
          <span className="hidden text-ink-2 lg:inline">
            {storage.mode === "database"
              ? storage.pending
                ? "Saving…"
                : "Saved"
              : storage.mode === "browser"
                ? "Browser"
                : storage.mode === "error"
                  ? "DB error"
                  : "…"}
          </span>
        </span>
        <Button
          variant="secondary"
          iconOnly
          aria-label={mode === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          icon={mode === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
          onClick={toggle}
        />
        <Button
          variant="secondary"
          icon={<Users className="size-4" />}
          onClick={onTeams}
          aria-label="Teams"
        >
          <span className="hidden sm:inline">Team</span>
        </Button>
        <Button
          variant="primary"
          icon={<Download className="size-4" />}
          disabled={!canExport}
          onClick={onExport}
          aria-label="Export"
        >
          <span className="hidden sm:inline">Export</span>
        </Button>
      </div>
    </header>
  );
}
