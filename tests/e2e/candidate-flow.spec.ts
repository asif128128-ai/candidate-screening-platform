import { expect, test, type Page } from "@playwright/test";

// TEST_STRATEGY.md §2 "Candidate flow steps 1-3, ordering, resume" /
// "Landing / terms-first" / "Hebrew RTL" rows.
//
// Rate-limit note: `submitPersonalDetails` is rate-limited at 5 signups per
// IP-prefix per hour (CANDIDATE_FLOW.md §2.2), and every request from this
// local Playwright run shares one "unknown" IP-prefix bucket (no
// X-Forwarded-For on localhost). This suite therefore keeps to exactly ONE
// signup per browser project (the full journey below), reusing that single
// application for the resume-flow and step-order-guard assertions instead
// of creating a fresh candidate per assertion.
//
// The assessment-start endpoint (`POST /api/assessment/start`) is real
// (assessment-engine engineer's work — see IMPLEMENTATION_STATE.md); this
// suite exercises it directly rather than mocking it via `page.route`, so
// the full journey below also creates a real assessment_sessions row.

function uniqueEmail(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 100000)}@example.com`;
}

async function fillPersonalDetails(page: Page, email: string) {
  await page.getByLabel("שם פרטי").fill("דנה");
  await page.getByLabel("שם משפחה").fill("כהן");
  await page.locator("#dateOfBirth").fill("2001-05-20");
  await page.getByLabel("טלפון נייד").fill(`050${Math.floor(1000000 + Math.random() * 8999999)}`);
  await page.getByLabel("אימייל").fill(email);
  await page.locator("#institution").fill("הטכניון");
  await page.locator("#degreeProgram").fill("מדעי המחשב");
  await page.locator("#studyYear").selectOption("2");
  await page.locator("#academicAverage").fill("88");
  await page.getByRole("radio", { name: "כן" }).check();
  await page.getByRole("checkbox", { name: /מדיניות הפרטיות/ }).check();
}

test.describe("landing page — terms before any form (decision #1)", () => {
  test("shows the terms card, tech-ops line and process outline above any input", async ({ page }) => {
    await page.goto("/jobs/student-tech-2026");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.getByTestId("terms-card")).toBeVisible();
    await expect(page.getByTestId("terms-card")).toContainText("₪ לשעה");
    // Numbers/currency stay LTR inside the RTL sentence via <bdi> (the
    // shared <Term> component, ARCHITECTURE.md §9).
    await expect(page.getByTestId("terms-card").locator("bdi")).toHaveCount(4);
    await expect(page.getByTestId("tech-ops-line")).toBeVisible();
    await expect(page.getByTestId("process-outline")).toContainText("במחשב");
    // No form input exists anywhere on the landing page.
    await expect(page.locator("input")).toHaveCount(0);
    await expect(page.getByTestId("cta-apply")).toBeVisible();
  });

  test("shows the same terms card on a 390px mobile viewport", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/jobs/student-tech-2026");
    await expect(page.getByTestId("terms-card")).toBeVisible();
    await expect(page.getByTestId("process-outline")).toBeVisible();
    // The page must not require horizontal scroll on mobile.
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1);
  });
});

test("full step 1 -> 2 -> 3 journey, resume, and step-order guards", async ({ page, context }) => {
  const email = uniqueEmail("flow");

  await test.step("step 1: personal details -> resume-code success card", async () => {
    await page.goto("/jobs/student-tech-2026/apply");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    // CANDIDATE_FLOW.md §2.1: phone/email inputs are dir="ltr" with
    // English placeholders so the caret and typed text behave correctly.
    await expect(page.getByLabel("טלפון נייד")).toHaveAttribute("dir", "ltr");
    await expect(page.getByLabel("אימייל")).toHaveAttribute("dir", "ltr");
    await expect(page.getByLabel("אימייל")).toHaveAttribute("placeholder", "name@example.com");
    await fillPersonalDetails(page, email);
    await page.getByRole("button", { name: "שליחת מועמדות" }).click();
    await expect(page.getByTestId("resume-code-card")).toBeVisible({ timeout: 10_000 });
  });

  const resumeCodeText = await page.getByTestId("resume-code").innerText();
  expect(resumeCodeText.replace("-", "")).toHaveLength(8);

  let applicationId = "";
  await test.step("continue to step 2 (job)", async () => {
    const continueLink = page.getByTestId("continue-to-step2");
    const href = await continueLink.getAttribute("href");
    expect(href).toMatch(/^\/apply\/[0-9a-f-]+\/job$/);
    applicationId = href!.split("/")[2]!;
    await continueLink.click();
    await expect(page).toHaveURL(new RegExp(`/apply/${applicationId}/job$`));
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.getByTestId("terms-card")).toBeVisible();
  });

  await test.step("step-order guard: jumping ahead to briefing before confirming job redirects back to job", async () => {
    await page.goto(`/apply/${applicationId}/briefing`);
    await expect(page).toHaveURL(new RegExp(`/apply/${applicationId}/job$`));
  });

  await test.step("step 2: confirm the 3 checkboxes -> step 3 (briefing)", async () => {
    await page.getByTestId("confirm1").check();
    await page.getByTestId("confirm2").check();
    await page.getByTestId("confirm3").check();
    await page.getByTestId("job-confirm-submit").click();
    await expect(page).toHaveURL(new RegExp(`/apply/${applicationId}/briefing$`));
  });

  await test.step("step-order guard: revisiting job after confirming shows a read-only summary", async () => {
    await page.goto(`/apply/${applicationId}/job`);
    await expect(page.getByText("כבר אישרת את השלב הזה")).toBeVisible();
    await page.goto(`/apply/${applicationId}/briefing`);
  });

  await test.step("step 3: monitoring consent + real assessment-start", async () => {
    // `POST /api/assessment/start` is real now (assessment-engine engineer's
    // work, IMPLEMENTATION_STATE.md) — this used to mock it via page.route()
    // since the route didn't exist yet; now it exercises the genuine start
    // -> session-created -> runner-guard path, which is a strictly better
    // test (and the mock stopped matching reality: the real assessment page
    // guard redirects back to /briefing when no session actually exists,
    // which a mocked 200 with no real DB write would always trigger).
    await expect(page.getByTestId("monitoring-disclosure")).toBeVisible();
    await page.getByTestId("monitoring-consent-checkbox").check();
    await page.getByTestId("start-assessment-button").click();
    await expect(page).toHaveURL(new RegExp(`/apply/${applicationId}/assessment$`), { timeout: 10_000 });
    await expect(page.getByTestId("block-intro")).toBeVisible({ timeout: 10_000 });
  });

  await test.step("resume flow: clearing cookies and using email + resume code returns to the same step", async () => {
    await context.clearCookies();
    await page.goto("/resume");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await page.locator("#email").fill(email);
    await page.locator("#code").fill(resumeCodeText);
    await page.getByRole("button", { name: "כניסה" }).click();
    // A real assessment session now exists (in_progress), so resume lands
    // on the assessment runner, not briefing.
    await expect(page).toHaveURL(new RegExp(`/apply/${applicationId}/assessment$`), { timeout: 10_000 });
  });

  await test.step("resume flow: a wrong code is rejected", async () => {
    await context.clearCookies();
    await page.goto("/resume");
    await page.locator("#email").fill(email);
    await page.locator("#code").fill("WRONGCODE");
    await page.getByRole("button", { name: "כניסה" }).click();
    await expect(page.getByText("האימייל או קוד החזרה שגויים")).toBeVisible();
  });
});
