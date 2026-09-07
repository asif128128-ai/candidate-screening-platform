import { defineConfig } from "vitest/config";
import path from "node:path";

// TEST_STRATEGY.md §1: Vitest for unit/integration. Path alias mirrors
// tsconfig.json's "@/*" so test files can import the same way app code does.
export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/unit/**/*.test.ts", "tests/integration/**/*.test.ts"],
    // The integration suites all talk to ONE real Postgres, and some of what
    // they exercise is global by nature: `apply_outage_credit(window)` credits
    // every live item overlapping the window, across every session in the
    // database. Run in parallel, outage-credit.test.ts credits
    // assessment-runner.test.ts's live items too — which both breaks its own
    // "exactly 1 item credited" assertion and extends the other suite's
    // deadlines, so an answer that should be recorded `expired` comes back
    // `answered`. Both are real failures of the test setup, not the code.
    //
    // Unit tests are pure and unaffected, but vitest's file parallelism is a
    // global switch, so this trades a little wall-clock time for determinism.
    // Sharding by suite would be the faster fix if that ever matters.
    fileParallelism: false,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
