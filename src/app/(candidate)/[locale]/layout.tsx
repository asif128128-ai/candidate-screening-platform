import type { Metadata } from "next";
import { Heebo, JetBrains_Mono } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
import { notFound } from "next/navigation";
import { isSupportedLocale } from "@/i18n/routing";
import { BRAND_NAME } from "@/lib/brand";
import "../../globals.css";

// ARCHITECTURE.md §7: Heebo (Hebrew + Latin) self-hosted at build time via
// next/font, no runtime Google Fonts dependency. JetBrains Mono for
// code/log-style content (CANDIDATE_FLOW.md §9).
// FINTECH_REDESIGN_PLAN.md §1.3: load weights 400/500/600/700 explicitly —
// the default subset shipped less predictably.
const heebo = Heebo({
  subsets: ["hebrew", "latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-heebo",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: `${BRAND_NAME} · הגשת מועמדות`,
};

// This is a Next.js "root layout" (renders <html>/<body>) scoped to the
// (candidate) route group; the /admin route group has its own root layout.
// See https://nextjs.org/docs/app/building-your-application/routing/pages-and-layouts#multiple-root-layouts
export default async function CandidateLocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isSupportedLocale(locale)) {
    notFound();
  }

  const messages = await getMessages();
  const dir = locale === "he" ? "rtl" : "ltr";

  return (
    <html lang={locale} dir={dir} className={`${heebo.variable} ${jetbrainsMono.variable}`}>
      <body className="min-h-screen bg-canvas font-sans text-text antialiased">
        <NextIntlClientProvider messages={messages}>
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
