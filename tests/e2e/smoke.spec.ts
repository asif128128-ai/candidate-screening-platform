import { test, expect } from "@playwright/test";

// Trivial smoke test proving the Playwright harness (config, webServer,
// RTL locale) works end-to-end. Real coverage — the requirement -> test map
// in TEST_STRATEGY.md §2 — lands with the candidate-flow, assessment-engine
// and admin-ui engineers.
test("job landing placeholder renders RTL", async ({ page }) => {
  await page.goto("/jobs/student-tech-2026");
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(page.locator("html")).toHaveAttribute("lang", "he");
  await expect(page.getByRole("heading")).toContainText("student-tech-2026");
});
