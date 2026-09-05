import { test, expect } from "@playwright/test";

// Trivial smoke test proving the Playwright harness (config, webServer,
// RTL locale) works end-to-end. Real coverage of the candidate flow now
// lives in tests/e2e/candidate-flow.spec.ts (TEST_STRATEGY.md §2); this
// file just needs to keep passing against the real (no longer placeholder)
// landing page built there.
test("job landing renders RTL", async ({ page }) => {
  await page.goto("/jobs/student-tech-2026");
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(page.locator("html")).toHaveAttribute("lang", "he");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("סטודנט");
});
