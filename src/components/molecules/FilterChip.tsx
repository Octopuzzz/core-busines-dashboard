"use client";

import { X } from "lucide-react";
import { motion } from "motion/react";

export function FilterChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <motion.span
      layout
      initial={{ opacity: 0, scale: 0.85 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.85 }}
      className="inline-flex h-7 items-center gap-1 rounded-pill border border-accent/30 bg-accent/10 pr-1 pl-3 text-xs font-medium text-accent"
    >
      {label}
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove filter ${label}`}
        className="grid size-5 place-items-center rounded-full transition-colors hover:bg-accent/15"
      >
        <X className="size-3" />
      </button>
    </motion.span>
  );
}
