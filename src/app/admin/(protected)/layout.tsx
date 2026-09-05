import { redirect } from "next/navigation";
import Link from "next/link";
import { resolveAdminSession } from "../../../lib/current-admin";
import { withAdmin } from "../../../db/postgres";
import { listActiveAlerts } from "../../../db/queries/alerts";
import { getSystemStatus } from "../../../db/queries/settings";
import { AlertBanners, type StaticBanner } from "../../../components/admin/alert-banners";
import { dbSizeFraction, formatBytes, DB_SIZE_WARNING_FRACTION } from "../../../lib/admin-format";
import { signOutAction } from "../login/actions";

// Second auth layer (ARCHITECTURE.md §6, ADMIN_UX.md §8): src/middleware.ts
// already rejected requests without a valid, aal2 session JWT (Edge-safe,
// no DB). This Server Component (always Node.js runtime) does the part
// middleware structurally cannot: check the `admin_users` allowlist and
// `disabled_at IS NULL` against Postgres (getCurrentAdmin, src/lib/
// current-admin.ts). Every page under this route group renders through
// here first, so no data page is reachable without both checks passing.
export default async function AdminProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const resolution = await resolveAdminSession();
  if (resolution.status === "no_session") {
    redirect("/admin/login");
  }
  if (resolution.status === "not_allowlisted") {
    // A valid, aal2 Supabase session that isn't (or is no longer) an
    // enabled admin_users row. ADMIN_UX.md §8: "אין לך הרשאה למערכת זו"
    // and sign-out — done via a Route Handler (/admin/login/deny) because
    // this Server Component cannot itself clear the session cookie.
    redirect("/admin/login/deny");
  }
  const admin = resolution.admin;

  const [alerts, systemStatus] = await withAdmin(admin.id, async (tx) => [
    await listActiveAlerts(tx),
    await getSystemStatus(tx),
  ]);

  // DECISIONS_LOG.md #19: DB-size banner at 70% of plan, always computed
  // live from `maintenance.db_size_bytes` rather than stored as an
  // `admin_alerts` row (the sweep already refreshes that column every hour;
  // no separate alert-table entry is needed for a value that's this cheap
  // to recompute on render).
  const dbFraction = dbSizeFraction(systemStatus.dbSizeBytes);
  const staticBanners: StaticBanner[] = [];
  if (dbFraction >= DB_SIZE_WARNING_FRACTION) {
    staticBanners.push({
      key: "db-size",
      severity: dbFraction >= 0.9 ? "critical" : "warning",
      messageHe: `מסד הנתונים ב-${Math.round(dbFraction * 100)}% מהמכסה (${formatBytes(systemStatus.dbSizeBytes)})`,
      href: "/admin/settings",
      hrefLabel: "להגדרות",
    });
  }

  return (
    <div className="min-h-screen">
      <header className="border-b border-neutral-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3">
          <nav className="flex items-center gap-6 text-sm font-medium text-neutral-700">
            <Link href="/admin/candidates" className="hover:text-neutral-950">
              מועמדים
            </Link>
            <Link href="/admin/jobs" className="hover:text-neutral-950">
              משרות
            </Link>
            <Link href="/admin/bank" className="hover:text-neutral-950">
              בנק השאלות
            </Link>
            <Link href="/admin/settings" className="hover:text-neutral-950">
              הגדרות
            </Link>
          </nav>
          <div className="flex items-center gap-3 text-sm text-neutral-600">
            <span>{admin.displayName}</span>
            <form action={signOutAction}>
              <button type="submit" className="text-neutral-500 underline hover:text-neutral-900">
                התנתקות
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-6 py-6">
        <AlertBanners alerts={alerts} staticBanners={staticBanners} />
        {children}
      </main>
    </div>
  );
}
