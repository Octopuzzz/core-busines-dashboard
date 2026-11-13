import type { Config } from "tailwindcss";
import plugin from "tailwindcss/plugin";
import { color, cssVar, font, radius, shadow, type ColorToken } from "./src/design/tokens";

const vars = (palette: Record<string, string>) =>
  Object.fromEntries(Object.entries(palette).map(([k, v]) => [`--c-${k}`, v]));

export default {
  content: ["./src/**/*.{ts,tsx}"],
  darkMode: ["selector", '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: Object.fromEntries(Object.keys(color.light).map((k) => [k, cssVar(k as ColorToken)])),
      fontFamily: { sans: font.sans, mono: font.mono },
      borderRadius: radius,
      boxShadow: { e1: shadow[1], e2: shadow[2], e3: shadow[3] },
      transitionTimingFunction: { out: "cubic-bezier(0.22, 1, 0.36, 1)" },
    },
  },
  plugins: [
    plugin(({ addBase }) => {
      addBase({
        ":root": { ...vars(color.light), colorScheme: "light" },
        '[data-theme="dark"]': { ...vars(color.dark), colorScheme: "dark" },
        body: {
          backgroundColor: cssVar("bg"),
          color: cssVar("ink"),
          fontFamily: font.sans.join(","),
          "-webkit-font-smoothing": "antialiased",
        },
        "h1, h2, h3, p": { textWrap: "pretty" },
        'button:not(:disabled), [role="button"], [role="option"], [role="radio"], [role="tab"], a[href], summary, select, label:has(> input[type="checkbox"]), input[type="date"]::-webkit-calendar-picker-indicator':
          { cursor: "pointer" },
        'button:disabled, [aria-disabled="true"]': { cursor: "not-allowed" },
        "@media (prefers-reduced-motion: reduce)": {
          "*, *::before, *::after": {
            animationDuration: "0.01ms !important",
            transitionDuration: "0.01ms !important",
          },
        },
      });
    }),
  ],
} satisfies Config;
