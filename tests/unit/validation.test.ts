import { describe, expect, it } from "vitest";
import { personalDetailsSchema } from "@/lib/validation";

// Red-team finding #5: `z.coerce.date().refine(...)` could never reach its
// custom Hebrew message — `z.coerce.date()` throws zod's own built-in
// English "Invalid date" error for empty/unparseable input *before*
// `.refine()` runs. Fixed by validating the raw string first (non-empty,
// parseable) and only then piping into `z.coerce.date()`.

const validBase = {
  firstName: "דנה",
  lastName: "כהן",
  dateOfBirth: "2001-05-20",
  phone: "0501234567",
  email: "dana@example.com",
  institution: "הטכניון",
  degreeProgram: "מדעי המחשב",
  studyYear: "2",
  academicAverage: "88",
  canWorkRishon: "yes",
  privacyConsent: "on",
};

describe("personalDetailsSchema.dateOfBirth", () => {
  it("accepts a well-formed date string", () => {
    const result = personalDetailsSchema.safeParse(validBase);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.dateOfBirth).toBeInstanceOf(Date);
      expect(Number.isNaN(result.data.dateOfBirth.getTime())).toBe(false);
    }
  });

  it("rejects an empty date-of-birth field with the Hebrew message, never zod's built-in 'Invalid date'", () => {
    const result = personalDetailsSchema.safeParse({ ...validBase, dateOfBirth: "" });
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues.find((i) => i.path[0] === "dateOfBirth");
      expect(issue?.message).toBe("יש לבחור תאריך לידה");
      expect(issue?.message).not.toMatch(/invalid date/i);
    }
  });

  it("rejects a missing date-of-birth field with the Hebrew message", () => {
    const rest: Record<string, string> = { ...validBase };
    delete rest.dateOfBirth;
    const result = personalDetailsSchema.safeParse(rest);
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues.find((i) => i.path[0] === "dateOfBirth");
      expect(issue?.message).toBe("יש לבחור תאריך לידה");
      expect(issue?.message).not.toMatch(/invalid date/i);
    }
  });

  it("rejects an unparseable date-of-birth string with the Hebrew message", () => {
    const result = personalDetailsSchema.safeParse({ ...validBase, dateOfBirth: "not-a-date" });
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues.find((i) => i.path[0] === "dateOfBirth");
      expect(issue?.message).toBe("יש לבחור תאריך לידה");
      expect(issue?.message).not.toMatch(/invalid date/i);
    }
  });
});

// FINTECH_REDESIGN_PLAN.md §R2.2 step 1 item 1: an empty studyYear used to
// leak zod's own "Expected number, received nan" and a missing
// canWorkRishon leaked "Required" — real English strings a Hebrew-only
// candidate flow must never show. `emptyForm` mirrors what a real browser
// actually submits for a completely untouched form (Object.fromEntries on
// the raw FormData, exactly what actions.ts does): plain text inputs are
// present with an empty string value, while studyYear, canWorkRishon, and
// privacyConsent are simply absent keys. Verified empirically against the
// real rendered form (Playwright + a production build): studyYear's
// `<select>` renders its disabled placeholder `<option value="" disabled>`
// as the current selection, and per the HTML spec a select's
// currently-selected-but-disabled option contributes NO entry at all to
// the submitted form data — so an untouched studyYear is a genuinely
// *missing* key, not "". Same story for the unchecked canWorkRishon radio
// group and the unchecked privacyConsent checkbox.
const emptyForm: Record<string, string> = {
  firstName: "",
  lastName: "",
  dateOfBirth: "",
  phone: "",
  email: "",
  institution: "",
  degreeProgram: "",
  academicAverage: "",
  linkedinUrl: "",
  githubUrl: "",
  pendingCvId: "",
  // studyYear (select w/ disabled placeholder), canWorkRishon (radio) and
  // privacyConsent (checkbox) omitted on purpose — see comment above.
};

describe("personalDetailsSchema — empty-form submission is Hebrew-only", () => {
  it("produces only Hebrew error messages, never zod's built-in English strings", () => {
    const result = personalDetailsSchema.safeParse(emptyForm);
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.issues.length).toBeGreaterThan(0);
    for (const issue of result.error.issues) {
      expect(issue.message).toMatch(/[֐-׿]/);
      expect(issue.message).not.toMatch(/Expected|Required|received/);
    }
  });

  it("studyYear: empty string gets the Hebrew message, not 'Expected number, received nan'", () => {
    const result = personalDetailsSchema.safeParse({ ...validBase, studyYear: "" });
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues.find((i) => i.path[0] === "studyYear");
      expect(issue?.message).toBe("יש לבחור שנת לימוד");
      expect(issue?.message).not.toMatch(/Expected|Required|received/);
    }
  });

  it("studyYear: missing field (the real behavior — the <select>'s current option is disabled, so the browser omits the key entirely) gets the Hebrew message, not 'Required'", () => {
    const rest: Record<string, string> = { ...validBase };
    delete rest.studyYear;
    const result = personalDetailsSchema.safeParse(rest);
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues.find((i) => i.path[0] === "studyYear");
      expect(issue?.message).toBe("יש לבחור שנת לימוד");
      expect(issue?.message).not.toMatch(/Expected|Required|received/);
    }
  });

  it("canWorkRishon: missing field (unchecked radio group) gets the Hebrew message, not 'Required'", () => {
    const rest: Record<string, string> = { ...validBase };
    delete rest.canWorkRishon;
    const result = personalDetailsSchema.safeParse(rest);
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues.find((i) => i.path[0] === "canWorkRishon");
      expect(issue?.message).toBe("יש לבחור תשובה");
      expect(issue?.message).not.toMatch(/Expected|Required|received/);
    }
  });
});
