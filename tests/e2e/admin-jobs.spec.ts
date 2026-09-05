import { test, expect } from "@playwright/test";
import { addAdminCookie, SEED_ADMIN_EMAIL } from "./admin-fixtures";

// ADMIN_UX.md §5: jobs list/create/edit/activate-deactivate.

test.describe("jobs management", () => {
  test.beforeEach(async ({ context }) => {
    await addAdminCookie(context, SEED_ADMIN_EMAIL, "aal2");
  });

  test("jobs list shows the seeded job", async ({ page }) => {
    await page.goto("/admin/jobs");
    await expect(page.getByText("student-tech-2026")).toBeVisible();
    await expect(page.getByText("פעיל").first()).toBeVisible();
  });

  test("creating a job redirects to its edit page and it then appears in the list", async ({
    page,
  }) => {
    const uniqueTitle = `משרת בדיקה ${Date.now()}`;
    await page.goto("/admin/jobs/new");
    await page.locator('input[name="titleHe"]').fill(uniqueTitle);
    await page.locator('input[name="summaryHe"]').fill("תקציר לבדיקה");
    await page.locator('textarea[name="descriptionHe"]').fill("תיאור לבדיקה");
    await page.locator('input[name="locationHe"]').fill("ראשון לציון");

    await page.getByRole("button", { name: "שמור", exact: true }).click();
    await expect(page).toHaveURL(/\/admin\/jobs\/[0-9a-f-]+$/);

    await page.goto("/admin/jobs");
    await expect(page.getByText(uniqueTitle)).toBeVisible();
  });

  test("editing a job persists a changed summary", async ({ page }) => {
    await page.goto("/admin/jobs");
    await page
      .getByRole("row", { name: /student-tech-2026/ })
      .getByRole("link", { name: "ערוך" })
      .click();
    await expect(page).toHaveURL(/\/admin\/jobs\/[0-9a-f-]+$/);

    const newSummary = `תקציר מעודכן ${Date.now()}`;
    await page.locator('input[name="summaryHe"]').fill(newSummary);
    await page.getByRole("button", { name: "שמור", exact: true }).click();
    await page.waitForTimeout(500);

    await page.reload();
    await expect(page.locator('input[name="summaryHe"]')).toHaveValue(newSummary);
  });

  test("deactivating and reactivating a job toggles its badge from the list", async ({
    page,
  }) => {
    // Creates its own job rather than toggling `.first()` of the shared
    // list: with several jobs present (the seeded one plus whatever other
    // tests created), ".first()" is not stable across re-sorts triggered by
    // the toggle itself (is_active desc, created_at desc) and can end up
    // flipping the WRONG row — this corrupted the seeded job's is_active
    // flag once while writing this suite, breaking every other test that
    // depends on it being the default active job.
    const uniqueTitle = `משרת הפעלה/השבתה ${Date.now()}`;
    await page.goto("/admin/jobs/new");
    await page.locator('input[name="titleHe"]').fill(uniqueTitle);
    await page.locator('input[name="summaryHe"]').fill("תקציר");
    await page.locator('textarea[name="descriptionHe"]').fill("תיאור");
    await page.locator('input[name="locationHe"]').fill("ראשון לציון");
    await page.locator('input[name="isActive"]').check();
    await page.getByRole("button", { name: "שמור", exact: true }).click();
    await expect(page).toHaveURL(/\/admin\/jobs\/[0-9a-f-]+$/);

    await page.goto("/admin/jobs");
    const row = page.getByRole("row", { name: new RegExp(uniqueTitle) });
    await expect(row.getByRole("button", { name: "פעיל" })).toBeVisible();

    await row.getByRole("button", { name: "פעיל" }).click();
    await expect(row.getByRole("button", { name: "לא פעיל" })).toBeVisible();

    await row.getByRole("button", { name: "לא פעיל" }).click();
    await expect(row.getByRole("button", { name: "פעיל" })).toBeVisible();
  });
});
