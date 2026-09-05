import Link from "next/link";
import { withCurrentAdmin } from "../../../../lib/current-admin";
import { listJobs } from "../../../../db/queries/jobs";
import { setJobActiveAction } from "./actions";
import { formatDate, formatNumber } from "../../../../lib/admin-format";

export default async function AdminJobsPage() {
  const jobs = await withCurrentAdmin((tx) => listJobs(tx));

  return (
    <div dir="rtl">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-neutral-900">משרות</h1>
        <Link href="/admin/jobs/new" className="rounded-md bg-neutral-900 px-4 py-1.5 text-sm text-white hover:bg-neutral-700">
          משרה חדשה
        </Link>
      </div>

      <div className="overflow-x-auto rounded-md border border-neutral-200 bg-white">
        <table className="w-full text-sm">
          <thead className="border-b border-neutral-200 bg-neutral-50 text-xs text-neutral-500">
            <tr>
              <th className="px-3 py-2 text-start">כותרת</th>
              <th className="px-3 py-2 text-start">כתובת</th>
              <th className="px-3 py-2 text-start">פעיל</th>
              <th className="px-3 py-2 text-start">מועמדים</th>
              <th className="px-3 py-2 text-start">תצורת מבחן</th>
              <th className="px-3 py-2 text-start">נוצר</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {jobs.map((j) => (
              <tr key={j.id} className="border-b border-neutral-100">
                <td className="px-3 py-2">
                  <Link href={`/admin/jobs/${j.id}`} className="font-medium text-neutral-900 hover:underline">
                    {j.titleHe}
                  </Link>
                </td>
                <td className="px-3 py-2 ltr-inline font-mono text-xs text-neutral-500">{j.slug}</td>
                <td className="px-3 py-2">
                  <form action={setJobActiveAction}>
                    <input type="hidden" name="id" value={j.id} />
                    <input type="hidden" name="isActive" value={j.isActive ? "0" : "1"} />
                    <button
                      type="submit"
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${j.isActive ? "bg-emerald-100 text-emerald-900" : "bg-neutral-100 text-neutral-500"}`}
                    >
                      {j.isActive ? "פעיל" : "לא פעיל"}
                    </button>
                  </form>
                </td>
                <td className="px-3 py-2 text-xs text-neutral-600">
                  {formatNumber(j.counts.total)} (הוגשו {formatNumber(j.counts.applied)} · השלימו {formatNumber(j.counts.completed)} · ראיון{" "}
                  {formatNumber(j.counts.interview)} · התקבלו {formatNumber(j.counts.hired)})
                </td>
                <td className="px-3 py-2 text-xs text-neutral-500">{j.configName}</td>
                <td className="px-3 py-2 text-xs text-neutral-500">{formatDate(j.createdAt)}</td>
                <td className="px-3 py-2">
                  <Link href={`/admin/jobs/${j.id}`} className="text-xs text-sky-700 hover:underline">
                    ערוך
                  </Link>
                </td>
              </tr>
            ))}
            {jobs.length === 0 && (
              <tr>
                <td colSpan={7} className="p-6 text-center text-neutral-400">
                  אין משרות עדיין.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
