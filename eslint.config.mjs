import { FlatCompat } from "@eslint/eslintrc";
import localRules from "./eslint-rules/no-physical-direction.mjs";

const compat = new FlatCompat({ baseDirectory: import.meta.dirname });

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    plugins: { local: localRules },
    rules: {
      "local/no-physical-direction": "error",
    },
  },
  {
    ignores: [
      ".next/**",
      "node_modules/**",
      "supabase/**",
      "playwright-report/**",
      "test-results/**",
    ],
  },
];

export default eslintConfig;
