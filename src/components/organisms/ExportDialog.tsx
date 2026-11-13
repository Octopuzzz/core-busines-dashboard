"use client";

import { useMemo, useState } from "react";
import { FileSpreadsheet, FileText, Presentation, Users } from "lucide-react";
import type { Issue } from "@/lib/jira/types";
import { resolvedPeople, type Group } from "@/lib/groups/store";
import { computeMetrics } from "@/lib/metrics";
import type { ExportInput } from "@/lib/export/common";
import { Avatar, Button, Input, Mono } from "../atoms";
import { FormatOption, MultiSelect, Overlay, Segmented, useToast } from "../molecules";

type Format = "pdf" | "xlsx" | "pptx";

const FORMATS: { id: Format; title: string; description: string; icon: React.ReactNode }[] = [
  {
    id: "pdf",
    title: "PDF report",
    description: "Team charts, then a page per person: done, left, and parent issues.",
    icon: <FileText className="size-5 text-overdue" />,
  },
  {
    id: "xlsx",
    title: "Excel",
    description: "Overview + one sheet per person with done/left summary and parent issues.",
    icon: <FileSpreadsheet className="size-5 text-done" />,
  },
  {
    id: "pptx",
    title: "PowerPoint",
    description: "Editable charts + one slide per person: done vs left, what\u2019s next.",
    icon: <Presentation className="size-5 text-warn" />,
  },
];

interface Props {
  open: boolean;
  onClose: () => void;
  group: Group;
  allIssues: Issue[];
  filteredIssues: Issue[];
  period: string;
  source: "jira" | "sample";
}

/**
 * Export dialog: choose format, title, people and which issues,
 * then build the PDF / Excel / PowerPoint file in the browser.
 */
export function ExportDialog({
  open,
  onClose,
  group,
  allIssues,
  filteredIssues,
  period,
  source,
}: Props) {
  const toast = useToast();
  const [format, setFormat] = useState<Format>("pdf");
  const [scope, setScope] = useState<"filtered" | "all">("filtered");
  const [people, setPeople] = useState<string[]>([]);
  const [title, setTitle] = useState(`${group.name} — Jira Report`);
  const [busy, setBusy] = useState(false);

  const members = resolvedPeople(group);
  const scopedIssues = scope === "filtered" ? filteredIssues : allIssues;
  const issues = useMemo(() => {
    if (!people.length) return scopedIssues;
    return scopedIssues.filter(
      (issue) => issue.assignee && people.includes(issue.assignee.accountId),
    );
  }, [scopedIssues, people]);

  const scopeLabel = useMemo(() => {
    if (!people.length) return `${group.name} · ${members.length} people`;
    const names = members
      .filter((member) => people.includes(member.accountId))
      .map((member) => member.displayName);
    // Name up to three people; beyond that just count them.
    const who = names.length <= 3 ? names.join(", ") : `${names.length} people`;
    return `${group.name} · ${who}`;
  }, [group.name, members, people]);

  const run = async () => {
    if (!issues.length) return;
    setBusy(true);
    const input: ExportInput = {
      title,
      scope: scopeLabel,
      period,
      source,
      issues,
      metrics: computeMetrics(issues),
    };
    try {
      if (format === "pdf") await (await import("@/lib/export/pdf")).exportPdf(input);
      if (format === "xlsx") await (await import("@/lib/export/excel")).exportExcel(input);
      if (format === "pptx") await (await import("@/lib/export/ppt")).exportPpt(input);
      toast("success", "Export ready — check your downloads.");
      onClose();
    } catch (e) {
      console.error(e);
      toast("error", "Export failed. See the browser console for details.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Overlay
      open={open}
      onClose={onClose}
      title="Export"
      footer={
        <div className="flex items-center justify-between gap-3">
          <Mono className="text-xs text-muted">{issues.length} issues</Mono>
          <Button variant="primary" loading={busy} disabled={!issues.length} onClick={run}>
            Export {FORMATS.find((option) => option.id === format)?.title}
          </Button>
        </div>
      }
    >
      <div
        role="radiogroup"
        aria-label="Format"
        className="grid grid-cols-1 gap-2.5 sm:grid-cols-3"
      >
        {FORMATS.map((option) => (
          <FormatOption
            key={option.id}
            selected={format === option.id}
            onSelect={() => setFormat(option.id)}
            icon={option.icon}
            title={option.title}
            description={option.description}
          />
        ))}
      </div>

      <div className="mt-5 grid gap-4">
        <label className="grid gap-1.5 text-xs text-muted">
          Title
          <Input value={title} onChange={(e) => setTitle(e.target.value)} />
        </label>
        <div className="grid gap-1.5 text-xs text-muted">
          People
          <MultiSelect
            icon={<Users className="size-4" />}
            allLabel={`Everyone in ${group.name}`}
            value={people}
            onChange={setPeople}
            options={members.map((member) => ({
              value: member.accountId,
              label: member.displayName,
              leading: <Avatar name={member.displayName} src={member.avatarUrl} size="xs" />,
            }))}
          />
        </div>
        <div className="grid gap-1.5 text-xs text-muted">
          Issues
          <Segmented
            ariaLabel="Which issues"
            className="w-full"
            value={scope}
            onChange={setScope}
            options={[
              { value: "filtered", label: `Current filters (${filteredIssues.length})` },
              { value: "all", label: `Everything loaded (${allIssues.length})` },
            ]}
          />
        </div>
      </div>
    </Overlay>
  );
}
