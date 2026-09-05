import { defineConfig } from "vitest/config";
import path from "node:path";

// TEST_STRATEGY.md §1: Vitest for unit/integration. Path alias mirrors
// tsconfig.json's "@/*" so test files can import the same way app code does.
export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/unit/**/*.test.ts", "tests/integration/**/*.test.ts"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
