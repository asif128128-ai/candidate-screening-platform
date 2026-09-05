import type { Config } from "tailwindcss";

// ARCHITECTURE.md §9: logical properties only (ms-/me-/ps-/pe-/start-/end-).
// Tailwind ships these natively since v3.3; physical-direction utilities
// (ml-/mr-/pl-/pr-/left-/right-) remain available in Tailwind itself but are
// forbidden in this codebase by the custom ESLint rule in
// eslint-rules/no-physical-direction.mjs (wired into eslint.config.mjs).
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-heebo)", "Heebo", "system-ui", "sans-serif"],
        mono: ["var(--font-jetbrains-mono)", "JetBrains Mono", "monospace"],
      },
    },
  },
  plugins: [],
};

export default config;
