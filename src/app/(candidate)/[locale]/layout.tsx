import type { Metadata } from "next";
import { Heebo, JetBrains_Mono } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
import { notFound } from "next/navigation";
import { isSupportedLocale } from "@/i18n/routing";
import "../../globals.css";

// ARCHITECTURE.md §7: Heebo (Hebrew + Latin) self-hosted at build time via
// next/font, no runtime Google Fonts dependency. JetBrains Mono for
// code/log-style content (CANDIDATE_FLOW.md §9).
const heebo = Heebo({
  subsets: ["hebrew", "latin"],
  variable: "--font-heebo",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "גיוס סטודנטים",
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
      <body className="min-h-screen bg-white font-sans text-neutral-900 antialiased">
        <NextIntlClientProvider messages={messages}>
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
