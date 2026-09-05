import { getRequestConfig } from "next-intl/server";
import { routing, isSupportedLocale } from "./routing";

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = isSupportedLocale(requested) ? requested : routing.defaultLocale;

  return {
    locale,
    // ARCHITECTURE.md §9: all UI text lives in messages/he.json; question
    // template text is separate (carried on the template, not here).
    messages: (await import(`./messages/${locale}.json`)).default,
  };
});
