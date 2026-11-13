"use client";

import { createContext, useCallback, useContext, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { CircleAlert, CircleCheck } from "lucide-react";
import { cn } from "@/lib/ui/cn";

type Tone = "success" | "error";
interface Toast {
  id: number;
  tone: Tone;
  text: string;
}

const ToastContext = createContext<(tone: Tone, text: string) => void>(() => {});

export const useToast = () => useContext(ToastContext);

const TOAST_DURATION_MS = 3600;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);
  const push = useCallback((tone: Tone, text: string) => {
    const id = Date.now() + Math.random();
    setItems((current) => [...current, { id, tone, text }]);
    setTimeout(
      () => setItems((current) => current.filter((toast) => toast.id !== id)),
      TOAST_DURATION_MS,
    );
  }, []);

  return (
    <ToastContext.Provider value={push}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-4 z-[60] flex flex-col items-center gap-2 px-4"
      >
        <AnimatePresence>
          {items.map((toast) => (
            <motion.div
              key={toast.id}
              layout
              initial={{ opacity: 0, y: 16, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.96 }}
              className="pointer-events-auto flex max-w-md items-center gap-2.5 rounded-lg border border-line bg-surface px-4 py-2.5 text-sm text-ink shadow-e3"
            >
              {toast.tone === "success" ? (
                <CircleCheck className="size-4 text-done" />
              ) : (
                <CircleAlert className="size-4 text-overdue" />
              )}
              <span className={cn(toast.tone === "error" && "text-ink")}>{toast.text}</span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}
