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
