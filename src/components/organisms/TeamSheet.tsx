"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { CircleAlert, Search, Trash2, UserPlus } from "lucide-react";
import type { JiraPerson } from "@/lib/jira/types";
import { newGroup, type Group, type Member } from "@/lib/groups/store";
import { DEFAULT_TEAMS } from "@/config/teams";
import { cn } from "@/lib/ui/cn";
import { Avatar, Badge, Button, Input } from "../atoms";
import { Overlay, PersonSearch, useToast } from "../molecules";

type JiraConnection = "live" | "sample" | "error" | "checking";

interface Props {
  open: boolean;
  onClose: () => void;
  group: Group | null;
  mode: "edit" | "new";
  onSave: (group: Group) => void;
  onDelete: (id: string) => void;
  jira: JiraConnection;
}

const isBuiltInTeam = (id: string) => DEFAULT_TEAMS.some((team) => team.id === id);

const sourceOf = (person: JiraPerson): Member["source"] =>
  person.accountId.startsWith("sample:") ? "sample" : "jira";

function unlinkedMessage(jira: JiraConnection) {
  if (jira === "live") return "No Jira account matched this name";
  if (jira === "error") return "Waiting for Jira login";
  return "Waiting for Jira";
}

export function TeamSheet({ open, onClose, group, mode, onSave, onDelete, jira }: Props) {
  const toast = useToast();
  const [draft, setDraft] = useState<Group | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset the draft each time the sheet opens
    if (open) setDraft(mode === "new" || !group ? newGroup("") : structuredClone(group));
  }, [open, mode, group]);

  if (!draft) return null;

  const setMembers = (members: Member[]) => setDraft({ ...draft, members });

  const addPerson = (person: JiraPerson) => {
    const alreadyMember = draft.members.some(
      (member) => member.person?.accountId === person.accountId,
    );
    if (alreadyMember) return;
    setMembers([...draft.members, { name: person.displayName, person, source: sourceOf(person) }]);
  };

  const linkMember = (memberName: string, person: JiraPerson) =>
    setMembers(
      draft.members.map((member) =>
        member.name === memberName ? { ...member, person, source: sourceOf(person) } : member,
      ),
    );

  const removeMember = (member: Member) =>
    setMembers(draft.members.filter((existing) => existing !== member));

  const save = () => {
    const name = draft.name.trim();
    if (!name) return toast("error", "Give the team a name.");
    if (!draft.members.length) return toast("error", "Add at least one person.");
    onSave({ ...draft, name });
    toast("success", `“${name}” saved`);
    onClose();
  };

  const deleteTeam = () => {
    onDelete(draft.id);
    onClose();
  };

  const unlinkedCount = draft.members.filter((member) => !member.person).length;
  const canDelete = mode === "edit" && !isBuiltInTeam(draft.id);

  const footer = (
    <div className="flex items-center justify-between gap-2">
      {canDelete ? (
        <Button variant="danger" icon={<Trash2 className="size-4" />} onClick={deleteTeam}>
          Delete
        </Button>
      ) : (
        <span />
      )}
      <div className="flex gap-2">
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button variant="primary" onClick={save}>
          Save
        </Button>
      </div>
    </div>
  );

  return (
    <Overlay
      open={open}
      onClose={onClose}
      kind="sheet"
      title={mode === "new" ? "New team" : "Edit team"}
      footer={footer}
    >
      <label className="grid gap-1.5 text-xs text-muted">
        Team name
        <Input
          autoFocus={mode === "new"}
          value={draft.name}
          placeholder="e.g. Mobile Squad"
          onChange={(event) => setDraft({ ...draft, name: event.target.value })}
        />
      </label>

      <div className="mt-5 flex items-center justify-between gap-2">
        <span className="text-xs text-muted">
          Members · {draft.members.length}
          {unlinkedCount > 0 && <span className="text-warn"> · {unlinkedCount} not linked</span>}
        </span>
      </div>

      {jira === "error" && (
        <p className="mt-2 flex items-start gap-2 rounded-md border border-overdue/30 bg-overdue/8 px-3 py-2 text-xs text-ink-2">
          <CircleAlert className="mt-px size-3.5 shrink-0 text-overdue" />
          Jira rejected the login, so people can&apos;t be looked up. Members link automatically
          once a valid token is in .env.local.
        </p>
      )}

      <div className="mt-1.5">
        <PersonSearch
          onPick={addPerson}
          placeholder="Add someone from Jira…"
          icon={<UserPlus className="size-4" />}
        />
      </div>

      <ul className="mt-3">
        <AnimatePresence initial={false}>
          {draft.members.map((member) => (
            <motion.li
              key={member.person?.accountId ?? member.name}
              layout
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <MemberRow
                member={member}
                jira={jira}
                onLink={(person) => linkMember(member.name, person)}
                onRemove={() => removeMember(member)}
              />
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>

      {isBuiltInTeam(draft.id) && (
        <p className="mt-4 text-xs text-muted">
          <Badge tone="accent">Saved team</Badge>{" "}
          <span className="ml-1">
            Changes are saved to the team database (or this browser if no database is set up).
          </span>
        </p>
      )}
    </Overlay>
  );
}

function MemberRow({
  member,
  jira,
  onLink,
  onRemove,
}: {
  member: Member;
  jira: JiraConnection;
  onLink: (person: JiraPerson) => void;
  onRemove: () => void;
}) {
  const { person } = member;
  const displayName = person?.displayName ?? member.name;
  const linkedDetail =
    person?.email ?? (member.source === "sample" ? "Sample stand-in" : "Linked to Jira");

  return (
    <div className="flex items-center gap-3 border-b border-line py-2.5">
      <Avatar
        name={displayName}
        src={person?.avatarUrl}
        size="md"
        className={cn(!person && "opacity-50 grayscale")}
      />

      <div className="min-w-0 flex-1">
        <div className="truncate text-sm text-ink">{displayName}</div>
        {person ? (
          <div className="truncate text-xs text-muted">{linkedDetail}</div>
        ) : (
          <div
            className={cn(
              "flex items-center gap-1 text-xs",
              jira === "live" ? "text-warn" : "text-muted",
            )}
          >
            <CircleAlert className="size-3" />
            {unlinkedMessage(jira)}
          </div>
        )}
      </div>

      {!person && jira === "live" && (
        <PersonSearch
          compact
          initial={member.name}
          onPick={onLink}
          placeholder="Find…"
          icon={<Search className="size-3.5" />}
        />
      )}

      <Button
        variant="ghost"
        size="sm"
        iconOnly
        aria-label={`Remove ${member.name}`}
        icon={<Trash2 className="size-4" />}
        onClick={onRemove}
      />
    </div>
  );
}
