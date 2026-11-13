"use client";

import { AnimatePresence, motion } from "motion/react";
import { Code2, FolderKanban, RotateCw, Search, Users, X } from "lucide-react";
import type { JiraProject } from "@/lib/jira/types";
import type { RangeSetting } from "@/lib/groups/store";
import { cn } from "@/lib/ui/cn";
import { Avatar, Button, Input } from "../atoms";
import { DateRange, FilterChip, MultiSelect } from "../molecules";

/** A removable filter tag shown under the bar (e.g. set by clicking a chart). */
export interface Chip {
  key: string;
  label: string;
  onRemove: () => void;
}

interface Props {
  search: string;
  onSearch: (value: string) => void;
  people: { accountId: string; displayName: string; avatarUrl?: string }[];
  selectedPeople: string[];
  onPeople: (accountIds: string[]) => void;
  projects: JiraProject[];
  selectedProjects: string[];
  onProjects: (projectKeys: string[]) => void;
  range: RangeSetting;
  onRange: (range: RangeSetting) => void;
  /** Saved-views control (rendered next to the action buttons). */
  views: React.ReactNode;
  showJql: boolean;
  onToggleJql: () => void;
  jqlDraft: string;
  onJqlDraft: (value: string) => void;
  /** True when an advanced JQL filter is applied. */
  jqlActive: boolean;
  onApplyJql: () => void;
  loading: boolean;
  onReload: () => void;
  chips: Chip[];
}

/** Search box, people/project/date filters, saved views, advanced JQL and active filter chips. */
export function FilterBar(props: Props) {
  const peopleOptions = props.people.map((person) => ({
    value: person.accountId,
    label: person.displayName,
    leading: <Avatar name={person.displayName} src={person.avatarUrl} size="xs" />,
  }));

  const projectOptions = props.projects.map((project) => ({
    value: project.key,
    label: project.name,
    hint: project.key,
  }));

  const clearSearchButton = props.search && (
    <button
      type="button"
      aria-label="Clear search"
      onClick={() => props.onSearch("")}
      className="text-muted hover:text-ink"
    >
      <X className="size-4" />
    </button>
  );

  const submitJql = (event: React.FormEvent) => {
    event.preventDefault();
    props.onApplyJql();
  };

  return (
    <div className="mb-3">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-[minmax(220px,1.4fr)_1fr_1fr_minmax(170px,0.8fr)_auto]">
        <Input
          className="sm:col-span-2 xl:col-span-1"
          leading={<Search className="size-4" />}
          placeholder="Search key, summary, person, status…"
          value={props.search}
          onChange={(event) => props.onSearch(event.target.value)}
          trailing={clearSearchButton}
        />

        <MultiSelect
          icon={<Users className="size-4" />}
          allLabel="Everyone"
          searchPlaceholder="Find a person…"
          value={props.selectedPeople}
          onChange={props.onPeople}
          options={peopleOptions}
        />

        <MultiSelect
          icon={<FolderKanban className="size-4" />}
          allLabel="All projects"
          searchPlaceholder="Find a project…"
          value={props.selectedProjects}
          onChange={props.onProjects}
          options={projectOptions}
        />

        <DateRange value={props.range} onChange={props.onRange} />

        <div className="flex gap-2 sm:col-span-2 xl:col-span-1">
          {props.views}
          <Button
            variant={props.showJql || props.jqlActive ? "primary" : "secondary"}
            iconOnly
            aria-label="Advanced JQL"
            aria-pressed={props.showJql}
            title="Advanced JQL"
            icon={<Code2 className="size-4" />}
            onClick={props.onToggleJql}
          />
          <Button
            variant="secondary"
            iconOnly
            aria-label="Reload from Jira"
            title="Reload from Jira"
            icon={<RotateCw className={cn("size-4", props.loading && "animate-spin")} />}
            onClick={props.onReload}
          />
        </div>
      </div>

      <AnimatePresence initial={false}>
        {props.showJql && (
          <motion.form
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
            onSubmit={submitJql}
          >
            <div className="flex gap-2 pt-2">
              <Input
                mono
                leading={<Code2 className="size-4" />}
                placeholder="sprint in openSprints() AND labels = backend"
                value={props.jqlDraft}
                onChange={(event) => props.onJqlDraft(event.target.value)}
              />
              <Button type="submit" variant="primary">
                Apply
              </Button>
            </div>
            <p className="mt-1.5 text-xs text-muted">
              Added on top of the team, project and date filters.
            </p>
          </motion.form>
        )}
      </AnimatePresence>

      <div className="mt-2 flex min-h-0 flex-wrap gap-1.5">
        <AnimatePresence>
          {props.chips.map((chip) => (
            <FilterChip key={chip.key} label={chip.label} onRemove={chip.onRemove} />
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
