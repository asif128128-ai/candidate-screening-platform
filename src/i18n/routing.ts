import { defineRouting } from "next-intl/routing";

// ARCHITECTURE.md §9: `he` is the default and only locale enabled at launch;
// `en` is a file drop-in (messages/en.json exists but is not linked from any
// UI). localePrefix "as-needed" means the default locale (he) is served
// without a URL prefix, matching the bare routes in CANDIDATE_FLOW.md §1
// (e.g. `/jobs/{slug}`, not `/he/jobs/{slug}`).
export const routing = defineRouting({
  locales: ["he"],
  defaultLocale: "he",
  localePrefix: "as-needed",
});

export type AppLocale = (typeof routing.locales)[number];

/**
 * Local stand-in for next-intl's `hasLocale` (a v4 export not present in
 * the installed 3.26.3) so this stays on a stable, well-documented
 * next-intl version rather than chasing a moving major.
 */
export function isSupportedLocale(locale: string | undefined): locale is AppLocale {
  return !!locale && (routing.locales as readonly string[]).includes(locale);
}
