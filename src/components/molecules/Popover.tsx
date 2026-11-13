"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import { cn } from "@/lib/ui/cn";
import { motion as motionTokens } from "@/design/tokens";

interface Props {
  trigger: (p: { open: boolean; toggle: () => void }) => React.ReactNode;
  children: (close: () => void) => React.ReactNode;
  align?: "start" | "end";
  className?: string;
}

interface Pos {
  top: number;
  left: number;
  minWidth: number;
  maxHeight: number;
  up: boolean;
}

const GAP = 6;
const MARGIN = 12;

/**
 * Click-to-open floating panel, rendered in a portal so it is never clipped by
 * scrolling containers (dialogs, sheets, tables). Flips upward when there is no
 * room below and stays inside the viewport. Closes on outside click and Escape.
 */
export function Popover({ trigger, children, align = "start", className }: Props) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<Pos | null>(null);
  const anchor = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDivElement>(null);

  const place = useCallback(() => {
    const anchorRect = anchor.current?.getBoundingClientRect();
    if (!anchorRect) return;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const spaceBelow = viewportHeight - anchorRect.bottom - GAP - MARGIN;
    const spaceAbove = anchorRect.top - GAP - MARGIN;
    const wantedHeight = panel.current?.scrollHeight ?? 320;
    // Open upward only when there's clearly more room above than below.
    const up = spaceBelow < Math.min(wantedHeight, 280) && spaceAbove > spaceBelow;
    const width = panel.current?.offsetWidth ?? anchorRect.width;
    let left = align === "end" ? anchorRect.right - width : anchorRect.left;
    left = Math.max(MARGIN, Math.min(left, viewportWidth - width - MARGIN)); // keep on screen
    setPos({
      top: up ? anchorRect.top - GAP : anchorRect.bottom + GAP,
      left,
      minWidth: anchorRect.width,
      maxHeight: Math.max(160, up ? spaceAbove : spaceBelow),
      up,
    });
  }, [align]);

  useLayoutEffect(() => {
    if (!open) return;
    place();
    // Second pass once the panel has its real size.
    const raf = requestAnimationFrame(place);
    return () => cancelAnimationFrame(raf);
  }, [open, place]);

  useEffect(() => {
    if (!open) return;
    const closeOnOutsideClick = (event: PointerEvent) => {
      const target = event.target as Node;
      const inside = anchor.current?.contains(target) || panel.current?.contains(target);
      if (!inside) setOpen(false);
    };
    // Capture phase + stopPropagation: Escape closes this popover without also closing a parent dialog.
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.stopPropagation();
      setOpen(false);
    };
    document.addEventListener("pointerdown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape, true);
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape, true);
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open, place]);

  const close = useCallback(() => setOpen(false), []);

  return (
    <div ref={anchor} className="relative min-w-0">
      {trigger({ open, toggle: () => setOpen((isOpen) => !isOpen) })}
      {typeof document !== "undefined" &&
        createPortal(
          <AnimatePresence>
            {open && (
              <motion.div
                ref={panel}
                initial={{ opacity: 0, y: pos?.up ? 4 : -4, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: pos?.up ? 4 : -4, scale: 0.98 }}
                transition={{ duration: motionTokens.fast, ease: motionTokens.ease }}
                // Position is measured at runtime from the trigger; Tailwind can't express it statically.
                style={
                  pos
                    ? {
                        top: pos.top,
                        left: pos.left,
                        minWidth: pos.minWidth,
                        maxHeight: pos.maxHeight,
                        translate: pos.up ? "0 -100%" : undefined,
                      }
                    : { visibility: "hidden" }
                }
                className={cn(
                  "fixed z-[70] flex flex-col overflow-y-auto overscroll-contain rounded-lg border border-line bg-surface p-1.5 shadow-e3",
                  pos?.up ? "origin-bottom" : "origin-top",
                  className,
                )}
              >
                {children(close)}
              </motion.div>
            )}
          </AnimatePresence>,
          document.body,
        )}
    </div>
  );
}
