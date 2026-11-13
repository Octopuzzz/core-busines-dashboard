"use client";

import { createContext, useContext, useMemo, useSyncExternalStore } from "react";
import { PALETTE_DARK, PALETTE_LIGHT, type ChartPalette } from "@/lib/theme";

type ThemeMode = "light" | "dark";
export const THEME_KEY = "kopnus.jira.theme";

export const themeBootScript = `try{var t=localStorage.getItem("${THEME_KEY}");if(t!=="light"&&t!=="dark"){t=matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"}document.documentElement.dataset.theme=t}catch(e){}`;

const listeners = new Set<() => void>();
const readMode = (): ThemeMode =>
  document.documentElement.dataset.theme === "dark" ? "dark" : "light";

function setMode(mode: ThemeMode) {
  document.documentElement.dataset.theme = mode;
  try {
    localStorage.setItem(THEME_KEY, mode);
  } catch {}
  listeners.forEach((notify) => notify());
}

const ThemeContext = createContext<{ mode: ThemeMode; toggle: () => void; palette: ChartPalette }>({
  mode: "light",
  toggle: () => {},
  palette: PALETTE_LIGHT,
});
export const useTheme = () => useContext(ThemeContext);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const mode = useSyncExternalStore(
    (onChange) => {
      listeners.add(onChange);
      return () => listeners.delete(onChange);
    },
    readMode,
    () => "light" as ThemeMode,
  );
  const value = useMemo(
    () => ({
      mode,
      palette: mode === "dark" ? PALETTE_DARK : PALETTE_LIGHT,
      toggle: () => setMode(mode === "dark" ? "light" : "dark"),
    }),
    [mode],
  );
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
