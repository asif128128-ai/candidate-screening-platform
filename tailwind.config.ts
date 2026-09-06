import type { Config } from "tailwindcss";

// ARCHITECTURE.md §9: logical properties only (ms-/me-/ps-/pe-/start-/end-).
// Tailwind ships these natively since v3.3; physical-direction utilities
// (ml-/mr-/pl-/pr-/left-/right-) remain available in Tailwind itself but are
// forbidden in this codebase by the custom ESLint rule in
// eslint-rules/no-physical-direction.mjs (wired into eslint.config.mjs).
//
// FINTECH_REDESIGN_PLAN.md §1.2/§1.3/§1.5: color tokens are defined once as
// CSS custom properties in src/app/globals.css and mapped onto Tailwind's
// color palette here, so the rest of the app can use ordinary utility
// classes (bg-ink-900, text-text-2, border-line, ...) instead of arbitrary
// value syntax everywhere.
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          950: "var(--ink-950)",
          900: "var(--ink-900)",
          800: "var(--ink-800)",
          200: "var(--ink-200)",
          100: "var(--ink-100)",
        },
        brand: {
          700: "var(--brand-700)",
          600: "var(--brand-600)",
          400: "var(--brand-400)",
          100: "var(--brand-100)",
          50: "var(--brand-50)",
        },
        mint: {
          600: "var(--mint-600)",
          800: "var(--mint-800)",
          300: "var(--mint-300)",
        },
        amber: {
          500: "var(--amber-500)",
          800: "var(--amber-800)",
          50: "var(--amber-50)",
        },
        red: {
          600: "var(--red-600)",
          50: "var(--red-50)",
        },
        canvas: "var(--canvas)",
        surface: "var(--surface)",
        line: "var(--line)",
        "line-strong": "var(--line-strong)",
        text: {
          DEFAULT: "var(--text)",
          2: "var(--text-2)",
          3: "var(--text-3)",
        },
      },
      fontFamily: {
        sans: ["var(--font-heebo)", "Heebo", "system-ui", "sans-serif"],
        // FINTECH_REDESIGN_PLAN.md §1.3: Hebrew inside <pre>/<code> (artifact
        // bodies contain Hebrew, CANDIDATE_FLOW.md §9) falls back to Heebo
        // rather than the browser's generic monospace face.
        mono: [
          "var(--font-jetbrains-mono)",
          "JetBrains Mono",
          "var(--font-heebo)",
          "Heebo",
          "monospace",
        ],
      },
      borderRadius: {
        8: "8px",
        10: "10px",
        12: "12px",
        16: "16px",
      },
      boxShadow: {
        // FINTECH_REDESIGN_PLAN.md §R2.3.1: the round-1 shadow (.04/.06 at 8px
        // 24px) was too faint against the new, darker canvas for the card
        // edge to register. Two-layer shadow, exact value from the plan.
        card: "0 1px 2px rgba(11,21,48,.06), 0 10px 30px rgba(11,21,48,.08)",
      },
    },
  },
  plugins: [],
};

export default config;
