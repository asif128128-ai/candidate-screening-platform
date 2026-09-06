import { notFound } from "next/navigation";

// FINTECH_REDESIGN_PLAN.md §R2.2 landing item 8: a genuinely unmatched path
// (no page.tsx anywhere under this segment) does NOT automatically reach a
// nested `not-found.tsx` in Next's App Router — only an explicit
// `notFound()` call from a page that actually matched does. This catch-all
// route is exactly that: it matches every otherwise-unhandled path under
// `[locale]` and calls `notFound()`, so the real bug (a bare English/LTR
// Next.js 404 with no shell) is fixed for every route, not just the ones
// that already called `notFound()` themselves (application-guard.ts).
export default function CandidateCatchAll() {
  notFound();
}
