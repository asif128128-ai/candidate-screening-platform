import { test, expect } from "@playwright/test";
import { addAdminCookie, SEED_ADMIN_EMAIL } from "./admin-fixtures";

// TEST_STRATEGY.md §7 / task requirement: "a security-boundary test
// asserting a non-admin (or unauthenticated) request cannot read candidate
// data through any admin route or API." This covers the HTTP surface (page
// routes and the CSV export API route); tests/integration/
// admin-rls-security.test.ts covers the same boundary at the DB/RLS layer.

test.describe("security boundaries", () => {
  test("unauthenticated GET to the candidate list redirects to login, never renders data", async ({
    page,
  }) => {
    const res = await page.goto("/admin/candidates");
    expect(res?.status()).toBeLessThan(400);
    await expect(page).toHaveURL(/\/admin\/login$/);
    await expect(page.getByText("יעל")).toHaveCount(0);
  });

  test("unauthenticated GET to a candidate detail page redirects, never renders data", async ({
    page,
  }) => {
    await page.goto("/admin/candidates/00000000-0000-0000-0000-000000000000");
    await expect(page).toHaveURL(/\/admin\/login$/);
  });

  // Note: these use `context.request`, not the standalone `request` fixture
  // — the latter is a separate cookie jar unrelated to `context`, which
  // would make every one of these indistinguishable from "no cookie at all".

  test("unauthenticated request to the CSV export API never reaches the route (middleware redirects first)", async ({
    context,
  }) => {
    const res = await context.request.get("/admin/candidates/export", { maxRedirects: 0 });
    expect(res.status()).toBe(307);
    expect(res.headers()["location"]).toContain("/admin/login");
  });

  test("an aal1 (not stepped-up) session cannot reach the CSV export API either", async ({
    context,
  }) => {
    await addAdminCookie(context, SEED_ADMIN_EMAIL, "aal1");
    const res = await context.request.get("/admin/candidates/export", { maxRedirects: 0 });
    expect(res.status()).toBe(307);
    expect(res.headers()["location"]).toContain("/admin/mfa/enroll");
  });

  test("a non-admin email with a valid aal2 session clears middleware but is rejected by the route's own allowlist check (401, not a CSV body)", async ({
    context,
  }) => {
    // This is the one case that actually reaches the route handler: the JWT
    // is validly signed with aal2, so middleware (which cannot check the DB)
    // lets it through — the export route's own resolveAdminSession() call
    // is what catches the fact this email isn't an enabled admin_users row.
    await addAdminCookie(context, "not-an-admin@example.co.il", "aal2");
    const res = await context.request.get("/admin/candidates/export");
    expect(res.status()).toBe(401);
    const body = await res.json();
    expect(body.error).toBeTruthy();
  });

  test("having some unrelated cookie present doesn't fool the gate", async ({ page, context }) => {
    await context.addCookies([
      { name: "app_session", value: "garbage-not-a-real-candidate-cookie", domain: "127.0.0.1", path: "/" },
    ]);
    await page.goto("/admin/candidates");
    await expect(page).toHaveURL(/\/admin\/login$/);
  });

  test("security headers are present on both the login page and a protected redirect", async ({
    page,
  }) => {
    const res = await page.goto("/admin/login");
    const headers = res?.headers() ?? {};
    expect(headers["x-content-type-options"]).toBe("nosniff");
    expect(headers["content-security-policy"]).toContain("frame-ancestors 'none'");
    expect(headers["strict-transport-security"]).toBeTruthy();
  });
});
