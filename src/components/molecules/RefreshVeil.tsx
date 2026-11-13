"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";

const WIPE = { duration: 0.75, ease: [0.65, 0, 0.35, 1] as const };

export function RefreshVeil({ active }: { active: boolean }) {
  const reduce = useReducedMotion();

  return (
    <AnimatePresence>
      {active && (
        <motion.div
          key="veil"
          aria-hidden
          className="pointer-events-none absolute -inset-x-2 -inset-y-1 z-20 overflow-hidden rounded-xl backdrop-contrast-[1.08] backdrop-grayscale"
          initial={{ opacity: 0, clipPath: "inset(0 0 0 0%)" }}
          animate={{ opacity: 1, clipPath: "inset(0 0 0 0%)" }}
          exit={
            reduce
              ? { opacity: 0, transition: { duration: 0.2 } }
              : { clipPath: "inset(0 0 0 100%)", transition: WIPE }
          }
          transition={{ duration: 0.35, ease: "easeOut" }}
        >
          {!reduce && (
            <motion.div
              className="absolute inset-y-0 left-0 w-[38%] -skew-x-12 bg-linear-to-r from-transparent via-white/45 to-transparent mix-blend-soft-light dark:via-white/15"
              initial={{ x: "-120%" }}
              animate={{ x: "320%" }}
              transition={{ duration: 1.6, ease: "linear", repeat: Infinity, repeatDelay: 0.15 }}
            />
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function RevealEdge({ play }: { play: number }) {
  const reduce = useReducedMotion();
  if (reduce || !play) return null;
  return (
    <motion.div
      key={play}
      aria-hidden
      className="pointer-events-none absolute -inset-y-1 z-30 w-px bg-ink shadow-[0_0_18px_2px_var(--c-ink)]"
      initial={{ left: "0%", opacity: 0.9 }}
      animate={{ left: "100%", opacity: [0.9, 0.9, 0] }}
      transition={{ ...WIPE, opacity: { duration: WIPE.duration, times: [0, 0.85, 1] } }}
    />
  );
}
