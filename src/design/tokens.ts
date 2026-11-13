export const color = {
  light: {
    bg: "#f4f5f7",
    surface: "#ffffff",
    "surface-2": "#f8f9fb",
    line: "#e9ebf0",
    "line-strong": "#d9dde5",
    ink: "#16191f",
    "ink-2": "#454c59",
    muted: "#6b7280",
    accent: "#3b6ef5",
    "accent-ink": "#ffffff",
    done: "#12a37f",
    todo: "#8a919e",
    overdue: "#d9534f",
    warn: "#d9822b",
  },
  dark: {
    bg: "#0e1014",
    surface: "#15181e",
    "surface-2": "#1a1e25",
    line: "#232731",
    "line-strong": "#2f3441",
    ink: "#e9ebf0",
    "ink-2": "#b8beca",
    muted: "#8b92a0",
    accent: "#5b87ff",
    "accent-ink": "#ffffff",
    done: "#1fb88f",
    todo: "#7d8594",
    overdue: "#ef6461",
    warn: "#e9973f",
  },
} as const;

export type ColorToken = keyof typeof color.light;

export const series = ["#3b6ef5", "#12a37f", "#d9822b", "#b5487e", "#7a5cf0", "#2a9bb8", "#8a919e"];

export const radius = { sm: "6px", md: "10px", lg: "14px", xl: "20px", pill: "999px" };

export const shadow = {
  1: "0 1px 2px rgb(16 24 40 / 0.04), 0 1px 3px rgb(16 24 40 / 0.04)",
  2: "0 4px 12px -2px rgb(16 24 40 / 0.08)",
  3: "0 16px 40px -12px rgb(16 24 40 / 0.22)",
};

export const motion = {
  ease: [0.22, 1, 0.36, 1] as [number, number, number, number],
  gsapEase: "power3.out",
  fast: 0.16,
  base: 0.24,
  slow: 0.6,
};

export const font = {
  sans: ["var(--font-geist-sans)", "system-ui", "sans-serif"],
  mono: ["var(--font-geist-mono)", "ui-monospace", "monospace"],
};

export const cssVar = (token: ColorToken) => `var(--c-${token})`;
