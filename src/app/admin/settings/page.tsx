// TODO(admin-ui engineer): settings (ADMIN_UX.md §7) — admin users table +
// invite, privacy contact + privacy_requests queue + "בדיקת קבצים"
// reconciliation, email outbox status, system status (version, migration
// version, health, DB size vs. plan, purge backlog, last sweep/outage,
// links to Sentry/UptimeRobot) and the runbook table (DEPLOYMENT.md §14).
export default function AdminSettingsPage() {
  return (
    <main className="p-8">
      <h1 className="text-xl font-semibold">הגדרות</h1>
      <p className="mt-2 text-neutral-500">
        מסך ההגדרות ייבנה כאן — ראו ADMIN_UX.md §7.
      </p>
    </main>
  );
}
