"use client";

import { useEffect, useState } from "react";
import {
  AlertTriangle,
  BookmarkPlus,
  CheckCircle2,
  ExternalLink,
  Play,
  WandSparkles,
  XCircle,
} from "lucide-react";
import { formatJql } from "@/lib/jira/jql";
import type { Issue, IssueQuery } from "@/lib/jira/types";
import type { SavedQuery } from "@/lib/queries/store";
import { cn } from "@/lib/ui/cn";
import { Button, JqlHighlight, StatusDot } from "../atoms";
import { JqlInput, Overlay } from "../molecules";

interface JqlTestResult {
  valid: boolean;
  jql: string;
  errors: string[];
  warnings: string[];
  count: number | null;
  issues: Issue[];
  tookMs: number;
}

type TestState =
  | { status: "idle" }
  | { status: "testing" }
  | { status: "done"; result: JqlTestResult }
  | { status: "failed"; message: string };

type Scope = "team" | "all";

interface Props {
  open: boolean;
  onClose: () => void;
  value: string;
  teamName: string;
  scope: Omit<IssueQuery, "jql"> | null;
  savedQueries: SavedQuery[];
  onApply: (jql: string) => void;
  onSave: (name: string, jql: string) => void;
}

const EXAMPLE = "status != Done AND priority IN (High, Highest)\nORDER BY duedate ASC";

export function JqlEditor({
  open,
  onClose,
  value,
  teamName,
  scope,
  savedQueries,
  onApply,
  onSave,
}: Props) {
  const [draft, setDraft] = useState(value);
  const [scopeMode, setScopeMode] = useState<Scope>("team");
  const [test, setTest] = useState<TestState>({ status: "idle" });
  const [name, setName] = useState("");

  useEffect(() => {
    if (!open) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- start from the applied JQL each time the editor opens
    setDraft(value);
    setTest({ status: "idle" });
    setName("");
  }, [open, value]);

  const changeDraft = (next: string) => {
    setDraft(next);
    if (test.status === "done" || test.status === "failed") setTest({ status: "idle" });
  };

  const runTest = async () => {
    const jql = draft.trim();
    if (!jql) return;
    setTest({ status: "testing" });
    try {
      const response = await fetch("/api/jira/jql", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jql, scope: scopeMode === "team" ? scope : null }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? `Request failed (${response.status})`);
      setTest({ status: "done", result: body as JqlTestResult });
    } catch (error) {
      setTest({ status: "failed", message: (error as Error).message });
    }
  };

  const format = () => setDraft((current) => formatJql(current));
  const withJql = savedQueries.filter((query) => query.settings.jql.trim());
  const invalid = test.status === "done" && !test.result.valid;

  return (
    <Overlay
      open={open}
      onClose={onClose}
      title="JQL editor"
      className="sm:max-w-[760px]"
      footer={
        <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
          <form
            className="flex min-w-0 flex-1 gap-1.5"
            onSubmit={(event) => {
              event.preventDefault();
              if (!name.trim() || !draft.trim()) return;
              onSave(name.trim(), draft.trim());
              setName("");
            }}
          >
            <input
              aria-label="Query name"
              value={name}
              maxLength={80}
              onChange={(event) => setName(event.target.value)}
              placeholder="Name to save this query…"
              className="h-9 min-w-0 flex-1 rounded-md border border-line bg-surface px-3 text-sm text-ink outline-none placeholder:text-muted focus:border-accent"
            />
            <Button
              type="submit"
              icon={<BookmarkPlus className="size-4" />}
              disabled={!name.trim() || !draft.trim()}
            >
              Save
            </Button>
          </form>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                onApply(draft.trim());
                onClose();
              }}
            >
              {draft.trim() ? "Apply to dashboard" : "Clear JQL"}
            </Button>
          </div>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        {withJql.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="mr-1 text-xs text-muted">Load saved:</span>
            {withJql.map((query) => (
              <button
                key={query.id}
                type="button"
                onClick={() => changeDraft(query.settings.jql)}
                className="h-7 max-w-48 truncate rounded-pill border border-line bg-surface px-2.5 text-xs text-ink-2 transition-colors hover:border-accent hover:text-ink"
              >
                {query.name}
              </button>
            ))}
          </div>
        )}

        <JqlInput
          value={draft}
          onChange={changeDraft}
          onSubmit={runTest}
          onFormat={format}
          invalid={invalid}
          placeholder={EXAMPLE}
        />

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="primary"
            icon={<Play className="size-4" />}
            loading={test.status === "testing"}
            disabled={!draft.trim()}
            onClick={runTest}
          >
            Test in Jira
          </Button>
          <Button
            icon={<WandSparkles className="size-4" />}
            disabled={!draft.trim()}
            onClick={format}
          >
            Format
          </Button>
          <div className="ml-auto">
            <div
              role="radiogroup"
              aria-label="Test scope"
              className="inline-flex rounded-md bg-surface-2 p-0.5 ring-1 ring-line"
            >
              {(
                [
                  ["team", scope ? `Within ${teamName}` : "Within team"],
                  ["all", "JQL only"],
                ] as const
              ).map(([mode, label]) => (
                <button
                  key={mode}
                  type="button"
                  role="radio"
                  aria-checked={scopeMode === mode}
                  onClick={() => {
                    setScopeMode(mode);
                    if (test.status !== "testing") setTest({ status: "idle" });
                  }}
                  className={cn(
                    "h-8 max-w-56 truncate rounded-[7px] px-3 text-[13px] transition-colors",
                    scopeMode === mode
                      ? "bg-surface text-ink shadow-e1 ring-1 ring-line"
                      : "text-muted hover:text-ink",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>
        <p className="-mt-2 text-xs text-muted">
          ⌘/Ctrl + Enter to test · Shift + Alt + F to format. On the dashboard the JQL is added on
          top of the team, project and date filters, and its ORDER BY is ignored.
        </p>

        <TestOutput state={test} />
      </div>
    </Overlay>
  );
}

function TestOutput({ state }: { state: TestState }) {
  if (state.status === "idle" || state.status === "testing") {
    return (
      <div
        className={cn(
          "rounded-lg border border-dashed border-line px-4 py-6 text-center text-sm text-muted",
          state.status === "testing" && "animate-pulse",
        )}
      >
        {state.status === "testing"
          ? "Asking Jira…"
          : "Test the query to see Jira's response before applying it."}
      </div>
    );
  }

  if (state.status === "failed") {
    return (
      <div className="flex gap-2.5 rounded-lg border border-overdue/30 bg-overdue/8 px-4 py-3 text-sm text-ink">
        <XCircle className="mt-0.5 size-4 shrink-0 text-overdue" />
        {state.message}
      </div>
    );
  }

  const { result } = state;
  return (
    <div className="flex flex-col gap-3">
      {result.valid ? (
        <div className="flex items-center gap-2.5 rounded-lg border border-done/30 bg-done/8 px-4 py-3 text-sm text-ink">
          <CheckCircle2 className="size-4 shrink-0 text-done" />
          <span>
            Valid JQL ·{" "}
            <strong className="font-semibold">
              {result.count === null ? "?" : `≈ ${result.count.toLocaleString()}`}
            </strong>{" "}
            {result.count === 1 ? "issue" : "issues"}
          </span>
          <span className="ml-auto font-mono text-xs text-muted">{result.tookMs} ms</span>
        </div>
      ) : (
        <div className="rounded-lg border border-overdue/30 bg-overdue/8 px-4 py-3 text-sm text-ink">
          <p className="flex items-center gap-2 font-medium">
            <XCircle className="size-4 shrink-0 text-overdue" />
            Jira rejected the query
          </p>
          <ul className="mt-1.5 flex flex-col gap-1 pl-6 font-mono text-[12.5px] leading-5 text-ink-2">
            {result.errors.map((error, index) => (
              <li key={index} className="list-disc">
                {error}
              </li>
            ))}
          </ul>
        </div>
      )}

      {result.warnings.length > 0 && (
        <div className="flex gap-2.5 rounded-lg border border-warn/30 bg-warn/8 px-4 py-3 text-sm text-ink">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warn" />
          <ul className="flex flex-col gap-1">
            {result.warnings.map((warning, index) => (
              <li key={index}>{warning}</li>
            ))}
          </ul>
        </div>
      )}

      {result.valid && result.issues.length > 0 && (
        <div className="overflow-hidden rounded-lg border border-line">
          <p className="border-b border-line bg-surface-2 px-3.5 py-2 text-[11px] font-medium tracking-[0.07em] text-muted uppercase">
            First {result.issues.length} results
          </p>
          <ul className="divide-y divide-line">
            {result.issues.map((issue) => (
              <li key={issue.key} className="flex items-center gap-3 px-3.5 py-2 text-sm">
                <a
                  href={issue.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex shrink-0 items-center gap-1 font-mono text-xs text-accent hover:underline"
                >
                  {issue.key}
                  <ExternalLink className="size-3" />
                </a>
                <span className="min-w-0 flex-1 truncate text-ink">{issue.summary}</span>
                <span className="hidden shrink-0 items-center gap-1.5 text-xs text-ink-2 sm:inline-flex">
                  <StatusDot category={issue.statusCategory} />
                  {issue.status}
                </span>
                <span className="hidden w-32 shrink-0 truncate text-right text-xs text-muted md:inline">
                  {issue.assignee?.displayName ?? "Unassigned"}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {result.valid && result.issues.length === 0 && (
        <p className="text-sm text-muted">The query is valid but matches no issues.</p>
      )}

      <details className="group text-xs text-muted">
        <summary className="cursor-pointer select-none hover:text-ink">JQL sent to Jira</summary>
        <div className="mt-2 rounded-md border border-line bg-surface-2 px-3 py-2 text-[12.5px] leading-5">
          <JqlHighlight jql={formatJql(result.jql)} />
        </div>
      </details>
    </div>
  );
}
