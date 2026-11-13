"use client";

import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import {
  useGroups,
  useRefreshProfiles,
  useResolveMembers,
  useStorageStatus,
} from "@/hooks/useGroups";
import { useIssues } from "@/hooks/useIssues";
import { useSavedQueries } from "@/hooks/useSavedQueries";
import {
  DEFAULT_SETTINGS,
  resolvedPeople,
  type Group,
  type SavedView,
  type TeamSettings,
} from "@/lib/groups/store";
import { computeMetrics, type Metrics } from "@/lib/metrics";
import { savedQueryStore } from "@/lib/queries/store";
import { periodLabel, rangeDates } from "@/lib/range";
import type { Issue, IssueQuery, JiraPerson, JiraProject } from "@/lib/jira/types";
import {
  RefreshVeil,
  RevealEdge,
  SavedViews,
  SyncIndicator,
  useToast,
  type SyncPhase,
} from "../molecules";
import {
  ChartsGrid,
  ConnectionBanner,
  ExportDialog,
  FilterBar,
  IssueList,
  JqlEditor,
  KpiGrid,
  TeamHeader,
  TeamSheet,
  TopBar,
  type ChartFilter,
  type Chip,
  type Connection,
} from "../organisms";
import { DashboardTemplate } from "../templates/DashboardTemplate";

const ACTIVE_TEAM_KEY = "kopnus.jira.activeTeam";
const DEFAULT_TEAM_ID = "core-engineering";
const SETTINGS_SAVE_DELAY_MS = 400;
const SYNC_SUMMARY_MS = 2800;

interface JiraStatus {
  configured: boolean;
  site: string | null;
  authOk?: boolean;
  error?: string | null;
}

const sameSettings = (a: TeamSettings, b: TeamSettings) => JSON.stringify(a) === JSON.stringify(b);

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

function memberSourceOf(status: JiraStatus | null): "jira" | "sample" | null {
  if (!status) return null;
  if (!status.configured) return "sample";
  return status.authOk ? "jira" : null;
}

interface TeamDashboardProps {
  initialTeams?: Group[] | null;
}

export function TeamDashboard({ initialTeams }: TeamDashboardProps = {}) {
  const { groups, save, remove } = useGroups(initialTeams);
  const storage = useStorageStatus();
  const toast = useToast();

  const [jiraStatus, setJiraStatus] = useState<JiraStatus | null>(null);
  const [projects, setProjects] = useState<JiraProject[]>([]);
  const [activeTeamId, setActiveTeamId] = useState<string>(DEFAULT_TEAM_ID);
  const [teamSheetMode, setTeamSheetMode] = useState<"edit" | "new" | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [jqlOpen, setJqlOpen] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [chartFilter, setChartFilter] = useState<ChartFilter>({});

  const [settings, setSettings] = useState<TeamSettings>(DEFAULT_SETTINGS);
  const updateSettings = (changes: Partial<TeamSettings>) =>
    setSettings((current) => ({ ...current, ...changes }));
  const deferredSearch = useDeferredValue(settings.search);

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

  const settingsLoadedFor = useRef<string | null>(null);
  useEffect(() => {
    if (!team || settingsLoadedFor.current === team.id) return;
    settingsLoadedFor.current = team.id;
    const restored = { ...DEFAULT_SETTINGS, ...team.settings };

    setSettings(restored);
    setChartFilter({});
  }, [team]);

  useEffect(() => {
    if (!team || settingsLoadedFor.current !== team.id) return;
    if (team.settings && sameSettings(team.settings, settings)) return;
    const timer = setTimeout(() => save({ ...team, settings }), SETTINGS_SAVE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [settings, team, save]);

  const { queries: views, save: saveQuery, remove: removeQuery } = useSavedQueries();

  useEffect(() => {
    savedQueryStore.setErrorHandler((message) => toast("error", message));
    return () => savedQueryStore.setErrorHandler(null);
  }, [toast]);

  const memberIds = useMemo(() => new Set(members.map((person) => person.accountId)), [members]);
  const forThisTeam = (query: TeamSettings): TeamSettings => ({
    ...DEFAULT_SETTINGS,
    ...query,
    people: query.people.filter((id) => memberIds.has(id)),
  });
  const activeViewId =
    views.find((view) => sameSettings(forThisTeam(view.settings), settings))?.id ?? null;

  const applyView = (view: SavedView) => {
    const next = forThisTeam(view.settings);
    setSettings(next);
    setChartFilter({});
    const skipped = view.settings.people.length - next.people.length;
    if (skipped > 0) {
      toast(
        "success",
        `“${view.name}” applied — ${skipped} ${skipped === 1 ? "person isn't" : "people aren't"} in ${team?.name ?? "this team"}`,
      );
    }
  };

  const saveView = (name: string) => {
    const replaced = views.some((view) => view.name.toLowerCase() === name.toLowerCase());
    saveQuery(name, settings);
    toast("success", replaced ? `Query “${name}” updated` : `Query “${name}” saved`);
  };

  const deleteView = (id: string) => removeQuery(id);

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

  const jqlScope = useMemo(
    () =>
      issueQuery && {
        accountIds: issueQuery.accountIds,
        projectKeys: issueQuery.projectKeys,
        from: issueQuery.from,
        to: issueQuery.to,
      },
    [issueQuery],
  );

  const saveJqlQuery = (name: string, jql: string) => {
    const replaced = views.some((view) => view.name.toLowerCase() === name.toLowerCase());
    saveQuery(name, { ...settings, jql });
    toast("success", replaced ? `Query “${name}” updated` : `Query “${name}” saved`);
  };

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

  const syncing = loading && !!data;
  const [wasSyncing, setWasSyncing] = useState(false);
  const [sync, setSync] = useState<SyncPhase>({ phase: "idle" });
  const [baseline, setBaseline] = useState<{ metrics: Metrics; total: number } | null>(null);
  const [revealKey, setRevealKey] = useState(0);

  if (syncing !== wasSyncing) {
    setWasSyncing(syncing);
    if (syncing) {
      setBaseline({ metrics, total: allIssues.length });
      setSync({ phase: "syncing" });
    } else if (fetchError) {
      setBaseline(null);
      setSync({ phase: "idle" });
    } else {
      setSync({
        phase: "done",
        total: allIssues.length,
        issueDelta: allIssues.length - (baseline?.total ?? allIssues.length),
      });
      setRevealKey((key) => key + 1);
    }
  }

  useEffect(() => {
    if (sync.phase !== "done") return;
    const timer = setTimeout(() => {
      setSync({ phase: "idle" });
      setBaseline(null);
    }, SYNC_SUMMARY_MS);
    return () => clearTimeout(timer);
  }, [sync]);

  const clearChartFilter = (field: keyof ChartFilter) =>
    setChartFilter((current) => ({ ...current, [field]: undefined }));
  const chips = buildChartChips(chartFilter, members, clearChartFilter);

  if (!team) return null;

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
            jqlActive={!!settings.jql}
            onOpenJql={() => setJqlOpen(true)}
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
        kpis={
          <KpiGrid metrics={metrics} deltaFrom={sync.phase === "done" ? baseline?.metrics : null} />
        }
        overlay={
          <>
            <RefreshVeil active={syncing} />
            <RevealEdge play={revealKey} />
          </>
        }
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

      <SyncIndicator state={sync} />

      <JqlEditor
        open={jqlOpen}
        onClose={() => setJqlOpen(false)}
        value={settings.jql}
        teamName={team.name}
        scope={jqlScope}
        savedQueries={views}
        onApply={(jql) => updateSettings({ jql })}
        onSave={saveJqlQuery}
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
