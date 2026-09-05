import { withCurrentAdmin } from "../../../../lib/current-admin";
import { listAdminUsers, listPrivacyRequests, getEmailOutboxStats, getSystemStatus } from "../../../../db/queries/settings";
import { formatDateTime, formatBytes, dbSizeFraction, DB_PLAN_BYTES, formatNumber } from "../../../../lib/admin-format";
import { addAdminUserAction, setAdminDisabledAction, resolvePrivacyRequestAction } from "./actions";
import { ReconcileButtonClient } from "./reconcile-button-client";

// ADMIN_UX.md §7. Four sections: admin users (multi-admin management),
// privacy (contact/retention/requests/reconciliation), email (outbox
// status), system (version/health/DB size/purge backlog/sweep/outage).
export default async function AdminSettingsPage() {
  const { admins, currentAdminId, privacyRequests, emailStats, systemStatus } = await withCurrentAdmin(async (tx, admin) => ({
    admins: await listAdminUsers(tx),
    currentAdminId: admin.id,
    privacyRequests: await listPrivacyRequests(tx),
    emailStats: await getEmailOutboxStats(tx),
    systemStatus: await getSystemStatus(tx),
  }));

  const dbFraction = dbSizeFraction(systemStatus.dbSizeBytes);

  return (
    <div dir="rtl" className="flex flex-col gap-8">
      <h1 className="text-xl font-semibold text-neutral-900">הגדרות</h1>

      <section>
        <h2 className="mb-2 text-lg font-medium text-neutral-800">משתמשי אדמין</h2>
        <table className="w-full max-w-2xl text-sm">
          <thead className="border-b border-neutral-200 text-xs text-neutral-500">
            <tr>
              <th className="px-2 py-1 text-start">שם</th>
              <th className="px-2 py-1 text-start">אימייל</th>
              <th className="px-2 py-1 text-start">סטטוס</th>
              <th className="px-2 py-1"></th>
            </tr>
          </thead>
          <tbody>
            {admins.map((a) => (
              <tr key={a.id} className="border-b border-neutral-100">
                <td className="px-2 py-1.5">{a.displayName}</td>
                <td className="px-2 py-1.5 ltr-inline">{a.email}</td>
                <td className="px-2 py-1.5">
                  {a.disabledAt ? <span className="text-neutral-400">מושבת</span> : <span className="text-emerald-700">פעיל</span>}
                </td>
                <td className="px-2 py-1.5">
                  {a.id !== currentAdminId && (
                    <form action={setAdminDisabledAction}>
                      <input type="hidden" name="targetId" value={a.id} />
                      <input type="hidden" name="disabled" value={a.disabledAt ? "0" : "1"} />
                      <button type="submit" className="text-xs text-sky-700 underline">
                        {a.disabledAt ? "הפעל" : "השבת"}
                      </button>
                    </form>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <form action={addAdminUserAction} className="mt-3 flex max-w-md items-end gap-2 text-sm">
          <label className="flex flex-col gap-1">
            <span className="text-xs text-neutral-500">אימייל</span>
            <input type="email" name="email" required dir="ltr" className="ltr-inline rounded-md border border-neutral-300 px-2 py-1" />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-neutral-500">שם מלא</span>
            <input type="text" name="displayName" required className="rounded-md border border-neutral-300 px-2 py-1" />
          </label>
          <button type="submit" className="rounded-md bg-neutral-900 px-3 py-1.5 text-white">
            הוסף אדמין
          </button>
        </form>
      </section>

      <section>
        <h2 className="mb-2 text-lg font-medium text-neutral-800">פרטיות</h2>
        <p className="text-sm text-neutral-500">
          תקופות שמירה (DATA_MODEL.md §8): IP מלא — 90 יום; טלמטריה גולמית ותוכן פריטים — 12 חודשים לאחר סיום; מועמד/ת
          במלואם — 24 חודשים ממועד ההגשה האחרון (למעט התקבלו/שמורים לתמיד).
        </p>
        <h3 className="mb-1 mt-4 text-sm font-medium text-neutral-700">בקשות פרטיות</h3>
        <table className="w-full max-w-3xl text-sm">
          <thead className="border-b border-neutral-200 text-xs text-neutral-500">
            <tr>
              <th className="px-2 py-1 text-start">אימייל</th>
              <th className="px-2 py-1 text-start">סוג</th>
              <th className="px-2 py-1 text-start">סטטוס</th>
              <th className="px-2 py-1 text-start">יעד</th>
              <th className="px-2 py-1"></th>
            </tr>
          </thead>
          <tbody>
            {privacyRequests.map((r) => (
              <tr key={r.id} className={`border-b border-neutral-100 ${r.overdue ? "bg-red-50" : ""}`}>
                <td className="px-2 py-1.5 ltr-inline">{r.email}</td>
                <td className="px-2 py-1.5">{r.kind}</td>
                <td className="px-2 py-1.5">{r.status}</td>
                <td className={`px-2 py-1.5 ${r.overdue ? "text-red-700" : "text-neutral-500"}`}>{formatDateTime(r.dueAt)}</td>
                <td className="px-2 py-1.5">
                  {r.status === "open" && (
                    <form action={resolvePrivacyRequestAction} className="flex gap-1">
                      <input type="hidden" name="id" value={r.id} />
                      <input type="hidden" name="status" value="done" />
                      <button type="submit" className="text-xs text-sky-700 underline">
                        סמן כטופל
                      </button>
                    </form>
                  )}
                </td>
              </tr>
            ))}
            {privacyRequests.length === 0 && (
              <tr>
                <td colSpan={5} className="p-4 text-center text-neutral-400">
                  אין בקשות פרטיות.
                </td>
              </tr>
            )}
          </tbody>
        </table>
        <div className="mt-3">
          <ReconcileButtonClient />
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-lg font-medium text-neutral-800">אימייל</h2>
        <p className="text-sm text-neutral-600">
          ממתינים: {formatNumber(emailStats.pending)} · נשלחו: {formatNumber(emailStats.sent)} · נכשלו (מעל 3 ניסיונות):{" "}
          <span className={emailStats.failedOver3 > 0 ? "font-medium text-red-700" : ""}>{formatNumber(emailStats.failedOver3)}</span>
        </p>
      </section>

      <section>
        <h2 className="mb-2 text-lg font-medium text-neutral-800">מערכת</h2>
        <dl className="grid max-w-xl grid-cols-2 gap-2 text-sm text-neutral-600">
          <dt>גרסת סכימה</dt>
          <dd>{systemStatus.migrationVersion ?? "לא ידוע (לא סביבת Supabase CLI)"}</dd>
          <dt>גודל מסד נתונים</dt>
          <dd className={dbFraction >= 0.7 ? "font-medium text-amber-700" : ""}>
            {formatBytes(systemStatus.dbSizeBytes)} מתוך {formatBytes(DB_PLAN_BYTES)} ({Math.round(dbFraction * 100)}%)
          </dd>
          <dt>תור מחיקת קבצים</dt>
          <dd className={systemStatus.cvPurgeStuckOver24h > 0 ? "font-medium text-red-700" : ""}>
            {formatNumber(systemStatus.cvPurgeBacklog)} ({formatNumber(systemStatus.cvPurgeStuckOver24h)} מעל 24 שעות)
          </dd>
          <dt>ניקוי אחרון</dt>
          <dd>{formatDateTime(systemStatus.lastSweep)}</dd>
          <dt>תקלת שרת אחרונה</dt>
          <dd>
            {systemStatus.lastOutageStart ? `${formatDateTime(systemStatus.lastOutageStart)} – ${formatDateTime(systemStatus.lastOutageEnd)}` : "לא היו תקלות"}
          </dd>
        </dl>
      </section>
    </div>
  );
}
