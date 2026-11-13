"use client";

import { useRef, useState } from "react";
import { Plus, Search } from "lucide-react";
import type { JiraPerson } from "@/lib/jira/types";
import { Avatar, Button, Input, Spinner } from "../atoms";
import { Popover } from "./Popover";

type SearchState = "idle" | "loading" | "error";

const MIN_QUERY_LENGTH = 2;
const DEBOUNCE_MS = 250;

interface Props {
  onPick: (person: JiraPerson) => void;
  /** Text on the full-width trigger button. */
  placeholder: string;
  icon: React.ReactNode;
  /** Small "Link" button instead of the full-width trigger (used on unlinked member rows). */
  compact?: boolean;
  /** Pre-filled search text, e.g. the member's configured name. */
  initial?: string;
}

/** Searches Jira users (debounced) in a popover and returns the picked person. Used in the team sheet. */
export function PersonSearch({ onPick, placeholder, icon, compact, initial = "" }: Props) {
  const [query, setQuery] = useState(initial);
  const [results, setResults] = useState<JiraPerson[]>([]);
  const [state, setState] = useState<SearchState>("idle");
  const debounceTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const search = (value: string) => {
    setQuery(value);
    clearTimeout(debounceTimer.current);
    if (value.trim().length < MIN_QUERY_LENGTH) {
      setResults([]);
      return;
    }
    debounceTimer.current = setTimeout(async () => {
      setState("loading");
      try {
        const response = await fetch(`/api/jira/users?q=${encodeURIComponent(value.trim())}`);
        const body = await response.json();
        if (!response.ok) throw new Error(body.error);
        setResults(body.users);
        setState("idle");
      } catch {
        setState("error");
      }
    }, DEBOUNCE_MS);
  };

  const nobodyFound =
    state === "idle" && query.trim().length >= MIN_QUERY_LENGTH && results.length === 0;

  const renderTrigger = ({ toggle, open }: { toggle: () => void; open: boolean }) => {
    if (compact) {
      const openAndSearch = () => {
        toggle();
        if (!open) search(query); // run the pre-filled search straight away
      };
      return (
        <Button variant="secondary" size="sm" icon={icon} onClick={openAndSearch}>
          Link
        </Button>
      );
    }
    return (
      <Button variant="secondary" className="w-full justify-start" icon={icon} onClick={toggle}>
        <span className="text-muted">{placeholder}</span>
      </Button>
    );
  };

  return (
    <Popover align="end" className="w-[min(340px,calc(100vw-48px))]" trigger={renderTrigger}>
      {(close) => (
        <div>
          <Input
            autoFocus
            leading={<Search className="size-4" />}
            value={query}
            placeholder="Type a name…"
            onChange={(event) => search(event.target.value)}
          />
          <div className="mt-1 max-h-64 overflow-y-auto">
            {state === "loading" && (
              <div className="flex items-center gap-2 px-2 py-3 text-sm text-muted">
                <Spinner /> Searching…
              </div>
            )}
            {state === "error" && (
              <p className="px-2 py-3 text-sm text-overdue">
                Search failed — check the Jira connection.
              </p>
            )}
            {nobodyFound && <p className="px-2 py-3 text-sm text-muted">No one found.</p>}

            {results.map((person) => (
              <button
                key={person.accountId}
                type="button"
                onClick={() => {
                  onPick(person);
                  close();
                }}
                className="flex min-h-10 w-full items-center gap-2.5 rounded-md px-2 text-left text-sm hover:bg-surface-2"
              >
                <Avatar name={person.displayName} src={person.avatarUrl} size="sm" />
                <span className="min-w-0 flex-1 truncate text-ink">{person.displayName}</span>
                <Plus className="size-4 text-muted" />
              </button>
            ))}
          </div>
        </div>
      )}
    </Popover>
  );
}
