// FINTECH_REDESIGN_PLAN.md §1.4: the client's real brand name replaces this
// via NEXT_PUBLIC_BRAND_NAME once known; "Careers" is a neutral fallback so
// the app ships without waiting on the client's branding decision.
export const BRAND_NAME = process.env.NEXT_PUBLIC_BRAND_NAME ?? "Careers";

// FINTECH_REDESIGN_PLAN.md §R2.2 landing item 8: the 404 page's "למשרה
// הפתוחה" CTA needs a job slug to link to — a named constant here, not a
// string literal baked into the 404 page component.
export const DEFAULT_JOB_SLUG = process.env.NEXT_PUBLIC_DEFAULT_JOB_SLUG ?? "student-tech-2026";

// FINTECH_REDESIGN_PLAN.md §R2.3.2: the candidate-shell footer's
// "© {year} {BRAND_NAME} · מדיניות פרטיות · {PRIVACY_CONTACT_EMAIL}" line.
// `PRIVACY_CONTACT_EMAIL` is already a validated (optional) server env var
// (src/lib/env.ts) used for the privacy notice/error copy; CandidateShell is
// server-rendered, so reading it directly (no NEXT_PUBLIC_ prefix needed)
// is fine here too. Same fallback as .env.example.
export const PRIVACY_CONTACT_EMAIL = process.env.PRIVACY_CONTACT_EMAIL ?? "privacy@example.co.il";
