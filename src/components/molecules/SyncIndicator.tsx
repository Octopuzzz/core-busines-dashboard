"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Check } from "lucide-react";

export type SyncPhase =
  { phase: "idle" } | { phase: "syncing" } | { phase: "done"; issueDelta: number; total: number };

function summary(state: Extract<SyncPhase, { phase: "done" }>) {
  if (state.issueDelta === 0) return `Up to date · ${state.total.toLocaleString()} issues`;
  const sign = state.issueDelta > 0 ? "+" : "−";
  const count = Math.abs(state.issueDelta);
  return `Updated · ${sign}${count} ${count === 1 ? "issue" : "issues"}`;
}

export function SyncIndicator({ state }: { state: SyncPhase }) {
  const reduce = useReducedMotion();
  const syncing = state.phase === "syncing";

  return (
    <>
      <AnimatePresence>
        {state.phase !== "idle" && (
          <motion.div
            key="bar"
            aria-hidden
            className="fixed inset-x-0 top-0 z-[70] h-[2px] overflow-hidden"
            exit={{ opacity: 0, transition: { duration: 0.4, delay: 0.2 } }}
          >
            {syncing && !reduce ? (
              <motion.span
                className="absolute inset-y-0 left-0 w-[35%] bg-ink"
                initial={{ x: "-100%" }}
                animate={{ x: "300%" }}
                transition={{ duration: 1.1, ease: [0.45, 0, 0.2, 1], repeat: Infinity }}
              />
            ) : (
              <motion.span
                className="absolute inset-0 origin-left bg-ink"
                initial={{ scaleX: syncing ? 0.35 : 0.6 }}
                animate={{ scaleX: 1 }}
                transition={{ duration: 0.45, ease: "easeOut" }}
              />
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="pointer-events-none fixed inset-x-0 top-3 z-[65] flex justify-center px-4">
        <AnimatePresence>
          {state.phase !== "idle" && (
            <motion.div
              key="pill"
              role="status"
              aria-live="polite"
              layout
              initial={{ opacity: 0, y: -12, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -12, scale: 0.96 }}
              transition={{ type: "spring", stiffness: 520, damping: 36 }}
              className="flex h-8 items-center gap-2 overflow-hidden rounded-pill bg-ink px-3.5 text-[12.5px] font-medium whitespace-nowrap text-bg shadow-e3"
            >
              <AnimatePresence mode="popLayout" initial={false}>
                {syncing ? (
                  <motion.span
                    key="syncing"
                    className="flex items-center gap-2"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                  >
                    <span className="relative flex size-2">
                      <span className="absolute inset-0 animate-ping rounded-full bg-bg/60" />
                      <span className="relative size-2 rounded-full bg-bg" />
                    </span>
                    Syncing with Jira…
                  </motion.span>
                ) : state.phase === "done" ? (
                  <motion.span
                    key="done"
                    className="flex items-center gap-2"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                  >
                    <span className="grid size-4 place-items-center rounded-full bg-bg text-ink">
                      <Check className="size-3" strokeWidth={3} />
                    </span>
                    {summary(state)}
                  </motion.span>
                ) : null}
              </AnimatePresence>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </>
  );
}
