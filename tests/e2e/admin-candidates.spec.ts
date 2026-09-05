import { test, expect } from "@playwright/test";
import { addAdminCookie, SEED_ADMIN_EMAIL, SEED_YAEL_EMAIL } from "./admin-fixtures";

// ADMIN_UX.md §3/§4: candidate list + detail, pipeline stage change.
// Requires the local Postgres stand-in seeded via
// `./scripts/local-pg-setup.sh` + `psql -f scripts/dev-seed.sql`
// (IMPLEMENTATION_NOTES.md) — these tests read real rows, not mocks.

test.describe("candidate list and detail", () => {
  test.beforeEach(async ({ context }) => {
    await addAdminCookie(context, SEED_ADMIN_EMAIL, "aal2");
  });

  test("candidate list shows seeded candidates with scores and stage pills", async ({ page }) => {
    await page.goto("/admin/candidates");
    await expect(page.getByRole("link", { name: /יעל כהן/ })).toBeVisible();
    await expect(page.getByText("עבר מועד התשובה").first()).toBeVisible();
  });

  test("quick filter 'מובילים' narrows the list", async ({ page }) => {
    await page.goto("/admin/candidates");
    await page.getByRole("link", { name: "מובילים" }).click();
    await expect(page).toHaveURL(/quick=top/);
  });

  test("free-text search finds a candidate by name", async ({ page }) => {
    await page.goto("/admin/candidates");
    // The search field lives in the collapsible "סינון מתקדם" <details>
    // panel, closed by default.
    await page.getByText("סינון מתקדם").click();
    await page.locator('input[name="q"]').fill("יעל");
    await page.getByRole("button", { name: "החל סינון" }).click();
    await expect(page.getByRole("link", { name: /יעל כהן/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /נועה לוי/ })).not.toBeVisible();
  });

  test("opening a candidate shows the profile card and score breakdown", async ({ page }) => {
    await page.goto("/admin/candidates");
    await page.getByRole("link", { name: /יעל כהן/ }).click();
    await expect(page).toHaveURL(/\/admin\/candidates\/[0-9a-f-]+$/);
    await expect(page.getByText(SEED_YAEL_EMAIL)).toBeVisible();
    await expect(page.getByRole("button", { name: "תוצאות המבחן" })).toBeVisible();
  });

  test("changing pipeline stage writes to stage history and shows the new stage on reload", async ({
    page,
  }) => {
    await page.goto("/admin/candidates");
    await page.getByRole("link", { name: /יעל כהן/ }).click();
    await expect(page).toHaveURL(/\/admin\/candidates\/[0-9a-f-]+$/);

    await page.locator('select[name="toStage"]').selectOption("interview");
    await page.getByRole("button", { name: "עדכן שלב" }).click();
    await page.waitForTimeout(500);

    await page.reload();
    await expect(page.locator('select[name="toStage"]')).toHaveValue("interview");

    await page.getByRole("button", { name: "היסטוריה" }).click();
    // Scoped to <li> so it doesn't match the (hidden) <option value="interview">
    // in the profile card's stage <select>.
    await expect(page.locator("li", { hasText: "ראיון" }).first()).toBeVisible();
  });

  test("adding a note attributes it to the acting admin (multi-admin: never anonymous)", async ({
    page,
  }) => {
    await page.goto("/admin/candidates");
    await page.getByRole("link", { name: /יעל כהן/ }).click();
    await page.getByRole("button", { name: "הערות" }).click();
    await page.locator("textarea").fill("הערת בדיקה אוטומטית");
    await page.getByRole("button", { name: "שמור הערה" }).click();
    await expect(page.getByText("הערת בדיקה אוטומטית")).toBeVisible();
    // The author name (not a generic/anonymous label) must appear next to it.
    await expect(page.getByText("רותם לוי").first()).toBeVisible();
  });
});
