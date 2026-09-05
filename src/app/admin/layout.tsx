import type { Metadata } from "next";
import { Heebo } from "next/font/google";
import "../globals.css";

// ADMIN_UX.md: Hebrew-only at launch, built through the same `messages`
// mechanism as the candidate side (ARCHITECTURE.md §9) so it can flip to
// English later without a rewrite — but admin routes are NOT under
// /[locale] (see ARCHITECTURE.md §4 code layout: `/admin/...` is separate
// from `/(candidate)/[locale]/...`).
// This is a Next.js root layout (renders <html>/<body>) for the /admin
// route group — see the (candidate) layout for why there are two.
const heebo = Heebo({
  subsets: ["hebrew", "latin"],
  variable: "--font-heebo",
  display: "swap",
});

export const metadata: Metadata = {
  title: "ניהול — גיוס סטודנטים",
};

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="he" dir="rtl" className={heebo.variable}>
      <body className="min-h-screen bg-neutral-50 font-sans text-neutral-900 antialiased">
        {children}
      </body>
    </html>
  );
}
