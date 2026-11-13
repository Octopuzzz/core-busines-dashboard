"use client";

import { useMemo, useState } from "react";
import { Check, ChevronDown, Search } from "lucide-react";
import { cn } from "@/lib/ui/cn";
import { Popover } from "./Popover";

export interface Option {
  value: string;
  label: string;
  hint?: string;
  leading?: React.ReactNode;
}

interface Props {
  options: Option[];
  value: string[];
  onChange: (v: string[]) => void;
  allLabel: string;
  icon?: React.ReactNode;
  searchPlaceholder?: string;
  className?: string;
}

export function MultiSelect({
  options,
  value,
  onChange,
  allLabel,
  icon,
  searchPlaceholder = "Filter…",
  className,
}: Props) {
  const [filterText, setFilterText] = useState("");
  const visibleOptions = useMemo(() => {
    const needle = filterText.trim().toLowerCase();
    if (!needle) return options;
    return options.filter((option) => option.label.toLowerCase().includes(needle));
  }, [options, filterText]);

  const toggleOption = (optionValue: string) => {
    const isSelected = value.includes(optionValue);
    onChange(
      isSelected ? value.filter((selected) => selected !== optionValue) : [...value, optionValue],
    );
  };

  let summary = `${value.length} selected`;
  if (value.length === 0) summary = allLabel;
  else if (value.length === 1) {
    summary = options.find((option) => option.value === value[0])?.label ?? "1 selected";
  }

  return (
    <Popover
      className="w-[min(320px,calc(100vw-32px))]"
      trigger={({ open, toggle: togglePopover }) => (
        <button
          type="button"
          onClick={togglePopover}
          aria-expanded={open}
          className={cn(
            "flex h-9 w-full min-w-0 items-center gap-2 rounded-md border border-line bg-surface px-3 text-left text-sm",
            "transition-colors duration-150 hover:border-line-strong focus-visible:outline-2 focus-visible:outline-accent",
            open && "border-accent ring-3 ring-accent/15",
            className,
          )}
        >
          {icon && <span className="flex text-muted">{icon}</span>}
          <span className={cn("min-w-0 flex-1 truncate", value.length ? "text-ink" : "text-muted")}>
            {summary}
          </span>
          {value.length > 1 && (
            <span className="rounded-pill bg-accent/12 px-1.5 font-mono text-[11px] text-accent">
              {value.length}
            </span>
          )}
          <ChevronDown
            className={cn("size-4 text-muted transition-transform", open && "rotate-180")}
          />
        </button>
      )}
    >
      {() => (
        <div>
          {options.length > 6 && (
            <label className="mb-1 flex h-8 items-center gap-2 rounded-md bg-surface-2 px-2.5 text-sm">
              <Search className="size-3.5 text-muted" />
              <input
                autoFocus
                value={filterText}
                onChange={(event) => setFilterText(event.target.value)}
                placeholder={searchPlaceholder}
                className="w-full bg-transparent text-ink outline-none placeholder:text-muted"
              />
            </label>
          )}
          <div
            role="listbox"
            aria-multiselectable
            className="max-h-72 overflow-y-auto overscroll-contain"
          >
            {visibleOptions.map((option) => {
              const isSelected = value.includes(option.value);
              return (
                <button
                  key={option.value}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => toggleOption(option.value)}
                  className="flex min-h-9 w-full items-center gap-2.5 rounded-md px-2 text-left text-sm text-ink transition-colors hover:bg-surface-2"
                >
                  <span
                    className={cn(
                      "grid size-4 shrink-0 place-items-center rounded-[5px] border transition-colors",
                      isSelected ? "border-accent bg-accent text-accent-ink" : "border-line-strong",
                    )}
                  >
                    {isSelected && <Check className="size-3" strokeWidth={3} />}
                  </span>
                  {option.leading}
                  <span className="min-w-0 flex-1 truncate">{option.label}</span>
                  {option.hint && (
                    <span className="font-mono text-[11px] text-muted">{option.hint}</span>
                  )}
                </button>
              );
            })}
            {!visibleOptions.length && <p className="px-2 py-3 text-sm text-muted">No matches</p>}
          </div>
          {value.length > 0 && (
            <div className="mt-1 border-t border-line pt-1">
              <button
                type="button"
                onClick={() => onChange([])}
                className="h-8 w-full rounded-md px-2 text-left text-[13px] text-muted hover:bg-surface-2 hover:text-ink"
              >
                Clear selection
              </button>
            </div>
          )}
        </div>
      )}
    </Popover>
  );
}
