import { z } from "zod";

// CANDIDATE_FLOW.md §2.1: zod schema for the raw step-1 form submission
// (before normalization — normalize.ts does phone/email/URL normalization
// separately so client + server share the same normalization code, not just
// the same schema). Server actions re-validate everything the client
// validated inline (ARCHITECTURE.md §5.1 / §6 "Input: zod schemas for every
// action/route"). Written against zod 3.x's error-customization API
// (`.refine`'s `{ message }`, not the v4-only base-schema `{ message }`
// shorthand which this pinned version doesn't support).

const nameRe = /^[a-zA-Zא-ת][a-zA-Zא-ת'׳\- ]{1,39}$/;

const checkboxOn = (message: string) =>
  z
    .string()
    .optional()
    .default("")
    .refine((v) => v === "on" || v === "true", { message });

export const personalDetailsSchema = z.object({
  firstName: z
    .string()
    .trim()
    .min(2, "שם פרטי חייב להכיל לפחות 2 תווים")
    .max(40, "שם פרטי ארוך מדי")
    .regex(nameRe, "שם פרטי יכול להכיל אותיות בעברית או באנגלית בלבד"),
  lastName: z
    .string()
    .trim()
    .min(2, "שם משפחה חייב להכיל לפחות 2 תווים")
    .max(40, "שם משפחה ארוך מדי")
    .regex(nameRe, "שם משפחה יכול להכיל אותיות בעברית או באנגלית בלבד"),
  // Red-team finding #5: `z.coerce.date().refine(...)` could never reach its
  // custom Hebrew message — `z.coerce.date()` itself throws zod's own
  // built-in English "Invalid date" error for any empty/unparseable input
  // *before* `.refine()` ever runs, which is exactly the case (an empty
  // date-of-birth field, the very first form in the funnel) this message
  // exists to handle. Fixed by validating the raw string is non-empty
  // *before* coercing to a Date, via `.pipe()`.
  dateOfBirth: z
    .string({ required_error: "יש לבחור תאריך לידה" })
    .trim()
    .min(1, "יש לבחור תאריך לידה")
    .refine((v) => !Number.isNaN(Date.parse(v)), { message: "יש לבחור תאריך לידה" })
    .pipe(z.coerce.date()),
  phone: z.string().trim().min(1, "יש להזין מספר טלפון"),
  email: z.string().trim().min(1, "יש להזין כתובת אימייל"),
  institution: z.string().trim().min(1, "יש לבחור מוסד לימודים").max(120),
  degreeProgram: z.string().trim().min(1, "יש לבחור תואר / מסלול").max(120),
  studyYear: z.coerce.number().int().min(1, "יש לבחור שנת לימוד").max(7, "יש לבחור שנת לימוד"),
  academicAverage: z.coerce.number().min(0, "הממוצע חייב להיות בין 0 ל-100").max(100, "הממוצע חייב להיות בין 0 ל-100"),
  canWorkRishon: z
    .string()
    .refine((v) => v === "yes" || v === "no", { message: "יש לבחור תשובה" }),
  linkedinUrl: z.string().trim().optional().default(""),
  githubUrl: z.string().trim().optional().default(""),
  pendingCvId: z.string().trim().optional().default(""),
  privacyConsent: checkboxOn("יש לאשר את מדיניות הפרטיות כדי להמשיך"),
});

export type PersonalDetailsFormInput = z.infer<typeof personalDetailsSchema>;

export const jobConfirmationSchema = z.object({
  confirm1: checkboxOn("יש לאשר את כל הסעיפים"),
  confirm2: checkboxOn("יש לאשר את כל הסעיפים"),
  confirm3: checkboxOn("יש לאשר את כל הסעיפים"),
});

export const briefingConsentSchema = z.object({
  monitoringConsent: checkboxOn("יש לאשר את תנאי הניטור כדי להתחיל"),
  viewportWidth: z.coerce.number().optional(),
  clientTimeIso: z.string().optional(),
});

export const resumeCodeSchema = z.object({
  email: z.string().trim().min(1, "יש להזין כתובת אימייל"),
  code: z.string().trim().min(1, "יש להזין קוד חזרה"),
});

export const otpRequestSchema = z.object({
  email: z.string().trim().min(1, "יש להזין כתובת אימייל"),
});

export const otpVerifySchema = z.object({
  email: z.string().trim().min(1, "יש להזין כתובת אימייל"),
  code: z.string().trim().min(4, "יש להזין את הקוד שנשלח"),
});

export const privacyRequestSchema = z.object({
  email: z.string().trim().min(1, "יש להזין כתובת אימייל"),
  kind: z
    .string()
    .refine((v) => v === "access" || v === "delete" || v === "correct", {
      message: "יש לבחור סוג בקשה",
    }),
  note: z.string().trim().max(2000).optional().default(""),
});
