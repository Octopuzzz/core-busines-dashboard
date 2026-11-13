"use client";

import { useId } from "react";
import { motion } from "motion/react";
import { cn } from "@/lib/ui/cn";

interface Props<T extends string> {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: React.ReactNode }[];
  className?: string;
  ariaLabel: string;
}

/** Segmented control (a row of mutually exclusive options) with a sliding highlight. */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  className,
  ariaLabel,
}: Props<T>) {
  const id = useId();
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={cn(
        "inline-flex max-w-full rounded-md bg-surface-2 p-0.5 ring-1 ring-line",
        className,
      )}
    >
      {options.map((option) => {
        const isSelected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={isSelected}
            onClick={() => onChange(option.value)}
            className={cn(
              "relative h-8 min-w-0 flex-1 rounded-[7px] px-3 text-[13px] transition-colors",
              isSelected ? "text-ink" : "text-muted hover:text-ink",
            )}
          >
            {isSelected && (
              <motion.span
                layoutId={`seg-${id}`}
                className="absolute inset-0 rounded-[7px] bg-surface shadow-e1 ring-1 ring-line"
                transition={{ type: "spring", stiffness: 500, damping: 38 }}
              />
            )}
            <span className="relative truncate">{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}
