"use client";

import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import {
  useGroups,
  useRefreshProfiles,
  useResolveMembers,
  useStorageStatus,
} from "@/hooks/useGroups";
import { useIssues } from "@/hooks/useIssues";
import {
  DEFAULT_SETTINGS,
  resolvedPeople,
  type SavedView,
  type TeamSettings,
} from "@/lib/groups/store";
import { computeMetrics } from "@/lib/metrics";
import { periodLabel, rangeDates } from "@/lib/range";
import type { Issue, IssueQuery, JiraPerson, JiraProject } from "@/lib/jira/types";
import { SavedViews, useToast } from "../molecules";
import {
  ChartsGrid,
  ConnectionBanner,
  ExportDialog,
  FilterBar,
  IssueList,
  KpiGrid,
  TeamHeader,
  TeamSheet,
  TopBar,
  type ChartFilter,
  type Chip,
  type Connection,
} from "../organisms";
import { DashboardTemplate } from "../templates/DashboardTemplate";

/** localStorage key for the team that was open last. */
const ACTIVE_TEAM_KEY = "kopnus.jira.activeTeam";
const DEFAULT_TEAM_ID = "core-engineering";
/** Wait this long after the last filter change before saving the team's settings. */
const SETTINGS_SAVE_DELAY_MS = 400;

/** Response of GET /api/jira/status. */
interface JiraStatus {
  configured: boolean;
  site: string | null;
  authOk?: boolean;
  error?: string | null;
}

const sameSettings = (a: TeamSettings, b: TeamSettings) => JSON.stringify(a) === JSON.stringify(b);

/* ------------------------------------------------------------------------------------------ */
/* Pure helpers                                                                                */
/* ------------------------------------------------------------------------------------------ */

/** Does the issue match the free-text search? Checks key, summary, assignee, status, parent, labels. */
function matchesSearch(issue: Issue, searchText: string): boolean {
  if (!searchText) return true;
  const contains = (value: string | undefined) =>
    value?.toLowerCase().includes(searchText) ?? false;
  return (
    contains(issue.key) ||
    contains(issue.summary) ||
    contains(issue.assignee?.displayName) ||
    contains(issue.status) ||
    contains(issue.parent?.key) ||
    contains(issue.parent?.summary) ||
    issue.labels.some(contains)
  );
}

/** Applies the people filter, the chart click-filters and the text search (all client-side). */
function filterIssues(
  issues: Issue[],
  selectedPeople: string[],
  chartFilter: ChartFilter,
  searchText: string,
): Issue[] {
  return issues.filter((issue) => {
    const assigneeId = issue.assignee?.accountId;
    if (selectedPeople.length && !(assigneeId && selectedPeople.includes(assigneeId))) return false;
    if (chartFilter.person && assigneeId !== chartFilter.person) return false;
    if (chartFilter.status && issue.status !== chartFilter.status) return false;
    if (chartFilter.type && issue.type !== chartFilter.type) return false;
    return matchesSearch(issue, searchText);
  });
}

/** Removable chips for the active chart filters. */
function buildChartChips(
  chartFilter: ChartFilter,
  members: JiraPerson[],
  clear: (field: keyof ChartFilter) => void,
): Chip[] {
  const chips: Chip[] = [];
  if (chartFilter.person) {
    const person = members.find((member) => member.accountId === chartFilter.person);
    chips.push({
      key: "person",
      label: person?.displayName ?? chartFilter.person,
      onRemove: () => clear("person"),
    });
  }
  if (chartFilter.status) {
    chips.push({
      key: "status",
      label: `Status: ${chartFilter.status}`,
      onRemove: () => clear("status"),
    });
  }
  if (chartFilter.type) {
    chips.push({ key: "type", label: `Type: ${chartFilter.type}`, onRemove: () => clear("type") });
  }
  return chips;
}

/** Jira connection state shown in the top bar and banner. */
function connectionState(
  status: JiraStatus | null,
  authError: string | null,
  fetchError: string | null,
): Connection {
  if (!status) return "checking";
  if (!status.configured) return "sample";
  if (authError || fetchError) return "error";
  return "live";
}

/** Where member lookups come from: sample data, live Jira, or nowhere yet (unknown / login failed). */
function memberSourceOf(status: JiraStatus | null): "jira" | "sample" | null {
  if (!status) return null;
  if (!status.configured) return "sample";
  return status.authOk ? "jira" : null;
}

/* ------------------------------------------------------------------------------------------ */
/* Page                                                                                        */
/* ------------------------------------------------------------------------------------------ */

/**
 * The whole dashboard page. Owns all state — which team is open, its query (filters), Jira data,
 * and which dialogs are open. Everything it renders is presentational.
 */
export function TeamDashboard() {
  /* ---- State ------------------------------------------------------------------------- */

  const { groups, save, remove } = useGroups();
  const storage = useStorageStatus();
  const toast = useToast();

  const [jiraStatus, setJiraStatus] = useState<JiraStatus | null>(null);
  const [projects, setProjects] = useState<JiraProject[]>([]);
  const [activeTeamId, setActiveTeamId] = useState<string>(DEFAULT_TEAM_ID);
  const [teamSheetMode, setTeamSheetMode] = useState<"edit" | "new" | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [showJql, setShowJql] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [chartFilter, setChartFilter] = useState<ChartFilter>({});

  // The team's query. Restored from, and auto-saved to, the team's settings.
  const [settings, setSettings] = useState<TeamSettings>(DEFAULT_SETTINGS);
  const [jqlDraft, setJqlDraft] = useState("");
  const updateSettings = (changes: Partial<TeamSettings>) =>
    setSettings((current) => ({ ...current, ...changes }));
  // Keeps typing responsive: filtering runs on a slightly delayed copy of the search text.
  const deferredSearch = useDeferredValue(settings.search);

  /* ---- Data loading ------------------------------------------------------------------ */

  useEffect(() => {
    fetch("/api/jira/status")
      .then((response) => response.json())
      .then(setJiraStatus)
      .catch(() => setJiraStatus({ configured: false, site: null }));

    fetch("/api/jira/projects")
      .then((response) => (response.ok ? response.json() : { projects: [] }))
      .then((body) => setProjects(body.projects ?? []))
      .catch(() => {});

    try {
      const savedTeamId = localStorage.getItem(ACTIVE_TEAM_KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- restore browser-only preference
      if (savedTeamId) setActiveTeamId(savedTeamId);
    } catch {}
  }, []);

  const memberSource = memberSourceOf(jiraStatus);
  useResolveMembers(groups, memberSource);
  useRefreshProfiles(groups, memberSource === "jira");

  const team = groups.find((group) => group.id === activeTeamId) ?? groups[0] ?? null;
  const members = useMemo(() => (team ? resolvedPeople(team) : []), [team]);

  const openTeam = (id: string) => {
    setActiveTeamId(id);
    try {
      localStorage.setItem(ACTIVE_TEAM_KEY, id);
    } catch {}
  };

  /* ---- Team settings persistence ----------------------------------------------------- */

  // Restore the team's saved query when the team (or storage) first becomes available.
  const settingsLoadedFor = useRef<string | null>(null);
  useEffect(() => {
    if (!team || settingsLoadedFor.current === team.id) return;
    settingsLoadedFor.current = team.id;
    const restored = { ...DEFAULT_SETTINGS, ...team.settings };

    setSettings(restored);
    setJqlDraft(restored.jql);
    setShowJql(!!restored.jql);
    setChartFilter({});
  }, [team]);

  // Save the query back to the team (debounced) whenever it changes.
  useEffect(() => {
    if (!team || settingsLoadedFor.current !== team.id) return;
    if (team.settings && sameSettings(team.settings, settings)) return;
    const timer = setTimeout(() => save({ ...team, settings }), SETTINGS_SAVE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [settings, team, save]);

  /* ---- Saved views ------------------------------------------------------------------- */

  const views = team?.views ?? [];
  const activeViewId = views.find((view) => sameSettings(view.settings, settings))?.id ?? null;

  const applyView = (view: SavedView) => {
    setSettings(view.settings);
    setJqlDraft(view.settings.jql);
    setShowJql(!!view.settings.jql);
    setChartFilter({});
  };

  const saveView = (name: string) => {
    if (!team) return;
    const view: SavedView = {
      id: crypto.randomUUID(),
      name,
      settings,
      createdAt: new Date().toISOString(),
    };
    // Saving under an existing name replaces that view.
    const otherViews = views.filter((existing) => existing.name !== name);
    save({ ...team, settings, views: [...otherViews, view] });
    toast("success", `View “${name}” saved`);
  };

  const deleteView = (id: string) => {
    if (team) save({ ...team, views: views.filter((view) => view.id !== id) });
  };

  /* ---- Derived data ------------------------------------------------------------------ */

  const dates = rangeDates(settings.range);
  const issueQuery: IssueQuery | null = useMemo(() => {
    if (!members.length) return null;
    return {
      accountIds: members.map((member) => member.accountId),
      names: Object.fromEntries(members.map((member) => [member.accountId, member.displayName])),
      projectKeys: settings.projectKeys,
      from: dates?.from,
      to: dates?.to,
      jql: settings.jql || undefined,
    };
  }, [members, settings.projectKeys, dates?.from, dates?.to, settings.jql]);

  const { data, loading, error: fetchError } = useIssues(issueQuery, reloadKey);
  const allIssues = useMemo(() => data?.issues ?? [], [data]);

  const visibleIssues = useMemo(
    () =>
      filterIssues(allIssues, settings.people, chartFilter, deferredSearch.trim().toLowerCase()),
    [allIssues, settings.people, chartFilter, deferredSearch],
  );

  const metrics = useMemo(() => computeMetrics(visibleIssues), [visibleIssues]);
  const period = periodLabel(settings.range);

  const authError =
    jiraStatus?.configured && !jiraStatus.authOk
      ? (jiraStatus.error ?? "Jira connection failed.")
      : null;
  const connection = connectionState(jiraStatus, authError, fetchError);

  const clearChartFilter = (field: keyof ChartFilter) =>
    setChartFilter((current) => ({ ...current, [field]: undefined }));
  const chips = buildChartChips(chartFilter, members, clearChartFilter);

  if (!team) return null;

  /* ---- Render ------------------------------------------------------------------------ */

  const errorMessage = authError ?? fetchError;
  let banner: React.ReactNode = null;
  if (connection === "sample") banner = <ConnectionBanner kind="sample" />;
  else if (errorMessage) {
    banner = (
      <ConnectionBanner kind="error" message={errorMessage} onRetry={() => location.reload()} />
    );
  }

  return (
    <>
      <DashboardTemplate
        topBar={
          <TopBar
            connection={connection}
            site={jiraStatus?.site}
            canExport={allIssues.length > 0}
            onExport={() => setExportOpen(true)}
            onTeams={() => setTeamSheetMode("edit")}
            storage={storage}
          />
        }
        banner={banner}
        header={
          <TeamHeader
            groups={groups}
            active={team}
            period={period}
            onSelect={openTeam}
            onNew={() => setTeamSheetMode("new")}
            sample={connection === "sample"}
          />
        }
        filters={
          <FilterBar
            search={settings.search}
            onSearch={(search) => updateSettings({ search })}
            people={members}
            selectedPeople={settings.people}
            onPeople={(people) => updateSettings({ people })}
            projects={projects}
            selectedProjects={settings.projectKeys}
            onProjects={(projectKeys) => updateSettings({ projectKeys })}
            range={settings.range}
            onRange={(range) => updateSettings({ range })}
            showJql={showJql}
            onToggleJql={() => setShowJql((shown) => !shown)}
            jqlDraft={jqlDraft}
            onJqlDraft={setJqlDraft}
            jqlActive={!!settings.jql}
            onApplyJql={() => updateSettings({ jql: jqlDraft.trim() })}
            loading={loading}
            onReload={() => setReloadKey((key) => key + 1)}
            chips={chips}
            views={
              <SavedViews
                views={views}
                activeId={activeViewId}
                onApply={applyView}
                onSave={saveView}
                onDelete={deleteView}
              />
            }
          />
        }
        kpis={<KpiGrid metrics={metrics} />}
        charts={
          <ChartsGrid
            metrics={metrics}
            activeStatus={chartFilter.status}
            onFilter={(filter) => setChartFilter((current) => ({ ...current, ...filter }))}
          />
        }
        issues={<IssueList issues={visibleIssues} loading={loading} />}
      />

      <TeamSheet
        open={teamSheetMode !== null}
        mode={teamSheetMode ?? "edit"}
        group={team}
        jira={connection}
        onClose={() => setTeamSheetMode(null)}
        onSave={(savedTeam) => {
          save(savedTeam);
          openTeam(savedTeam.id);
        }}
        onDelete={(id) => {
          remove(id);
          openTeam(DEFAULT_TEAM_ID);
        }}
      />

      <ExportDialog
        key={team.id}
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        group={team}
        allIssues={allIssues}
        filteredIssues={visibleIssues}
        period={period}
        source={data?.source ?? "sample"}
      />
    </>
  );
}
