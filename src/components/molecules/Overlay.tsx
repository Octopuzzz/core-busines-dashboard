"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import { X } from "lucide-react";
import { cn } from "@/lib/ui/cn";
import { motion as motionTokens } from "@/design/tokens";
import { Button } from "../atoms";

interface Props {
  open: boolean;
  onClose: () => void;
  title: React.ReactNode;
  kind?: "dialog" | "sheet";
  footer?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export function Overlay({
  open,
  onClose,
  title,
  kind = "dialog",
  footer,
  actions,
  children,
  className,
}: Props) {
  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", closeOnEscape);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", closeOnEscape);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, onClose]);

  if (typeof document === "undefined") return null;

  const isSheet = kind === "sheet";
  return createPortal(
    <AnimatePresence>
      {open && (
        <div
          className={cn(
            "fixed inset-0 z-50 flex",
            isSheet
              ? "items-end justify-end sm:items-stretch"
              : "items-end justify-center sm:items-center sm:p-6",
          )}
        >
          <motion.div
            className="absolute inset-0 bg-black/45 backdrop-blur-[2px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.section
            role="dialog"
            aria-modal
            aria-label={typeof title === "string" ? title : undefined}
            initial={isSheet ? { x: "100%" } : { opacity: 0, y: 24, scale: 0.98 }}
            animate={isSheet ? { x: 0 } : { opacity: 1, y: 0, scale: 1 }}
            exit={isSheet ? { x: "100%" } : { opacity: 0, y: 24, scale: 0.98 }}
            transition={{ duration: motionTokens.base + 0.06, ease: motionTokens.ease }}
            className={cn(
              "relative flex max-h-[92dvh] w-full flex-col bg-surface shadow-e3",
              isSheet
                ? "rounded-t-xl sm:max-h-none sm:w-[480px] sm:rounded-none sm:border-l sm:border-line"
                : "rounded-t-xl sm:max-w-[640px] sm:rounded-xl sm:border sm:border-line",
              className,
            )}
          >
            <header className="flex items-center gap-3 border-b border-line px-5 py-4">
              <h2 className="min-w-0 flex-1 truncate text-base font-semibold tracking-tight text-ink">
                {title}
              </h2>
              {actions}
              <Button
                variant="ghost"
                size="sm"
                iconOnly
                aria-label="Close"
                icon={<X className="size-4" />}
                onClick={onClose}
              />
            </header>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5">
              {children}
            </div>
            {footer && <footer className="border-t border-line px-5 py-3.5">{footer}</footer>}
          </motion.section>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
