"use client";

import { useState } from "react";
import { Bookmark, BookmarkPlus, Check, Trash2 } from "lucide-react";
import type { SavedView } from "@/lib/groups/store";
import { cn } from "@/lib/ui/cn";
import { Button } from "../atoms";
import { Popover } from "./Popover";

interface Props {
  views: SavedView[];
  /** id of the view whose settings equal the current filters, if any. */
  activeId: string | null;
  onApply: (v: SavedView) => void;
  onSave: (name: string) => void;
  onDelete: (id: string) => void;
}

/** “Views” menu: apply, delete, or save the current filters as a named view for the team. */
export function SavedViews({ views, activeId, onApply, onSave, onDelete }: Props) {
  const [name, setName] = useState("");
  const activeView = views.find((view) => view.id === activeId);

  return (
    <Popover
      align="end"
      className="w-[min(320px,calc(100vw-32px))] p-2"
      trigger={({ open, toggle }) => (
        <Button
          variant={activeView ? "primary" : "secondary"}
          aria-expanded={open}
          onClick={toggle}
          icon={<Bookmark className="size-4" />}
          title="Saved views"
          className="max-w-48"
        >
          <span className="hidden truncate sm:inline">
            {activeView ? activeView.name : "Views"}
          </span>
        </Button>
      )}
    >
      {(close) => (
        <div>
          <p className="px-2 pt-1 pb-1.5 text-[11px] font-medium tracking-[0.07em] text-muted uppercase">
            Saved views
          </p>
          {views.length === 0 && (
            <p className="px-2 pb-2 text-sm text-muted">No saved views yet.</p>
          )}
          <ul className="max-h-60 overflow-y-auto">
            {views.map((view) => (
              <li
                key={view.id}
                className="group flex items-center gap-1 rounded-md hover:bg-surface-2"
              >
                <button
                  type="button"
                  onClick={() => {
                    onApply(view);
                    close();
                  }}
                  className="flex min-h-9 min-w-0 flex-1 items-center gap-2 px-2 text-left text-sm text-ink"
                >
                  <Check
                    className={cn(
                      "size-3.5 shrink-0 text-accent",
                      view.id !== activeId && "invisible",
                    )}
                  />
                  <span className="truncate">{view.name}</span>
                </button>
                <Button
                  variant="ghost"
                  size="sm"
                  iconOnly
                  aria-label={`Delete view ${view.name}`}
                  icon={<Trash2 className="size-3.5" />}
                  className="opacity-60 group-hover:opacity-100"
                  onClick={() => onDelete(view.id)}
                />
              </li>
            ))}
          </ul>
          <form
            className="mt-1.5 flex gap-1.5 border-t border-line pt-2"
            onSubmit={(event) => {
              event.preventDefault();
              const trimmed = name.trim();
              if (!trimmed) return;
              onSave(trimmed);
              setName("");
              close();
            }}
          >
            <input
              autoFocus
              aria-label="View name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Name this view…"
              className="h-8 min-w-0 flex-1 rounded-md border border-line bg-surface px-2.5 text-sm text-ink outline-none placeholder:text-muted focus:border-accent"
            />
            <Button
              type="submit"
              size="sm"
              variant="primary"
              icon={<BookmarkPlus className="size-3.5" />}
              disabled={!name.trim()}
            >
              Save
            </Button>
          </form>
          <p className="px-1 pt-2 text-[11px] leading-relaxed text-muted">
            Saves search, people, projects, dates and JQL for the whole team. Your last filters are
            also remembered automatically.
          </p>
        </div>
      )}
    </Popover>
  );
}
