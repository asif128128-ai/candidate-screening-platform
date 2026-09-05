// FINTECH_REDESIGN_PLAN.md §1.4: the client's real brand name replaces this
// via NEXT_PUBLIC_BRAND_NAME once known; "Careers" is a neutral fallback so
// the app ships without waiting on the client's branding decision.
export const BRAND_NAME = process.env.NEXT_PUBLIC_BRAND_NAME ?? "Careers";
