import { withCurrentAdmin } from "../../../../lib/current-admin";
import { listBankFamilies } from "../../../../db/queries/bank";
import { formatPercent } from "../../../../lib/admin-format";

// ADMIN_UX.md §6: read-only bank analytics. Aggregates come from real
// `assessment_items`/`assessment_responses` rows — with no assessment
// engine/bank templates implemented yet in this codebase (src/assessment/
// generator.ts is still a stub), this table is correct but will show
// whatever a real pilot/seed run has produced so far, which may be little
// or nothing. That's the honest empty state, not a placeholder message.
export default async function AdminBankPage() {
  const families = await withCurrentAdmin((tx) => listBankFamilies(tx));

  return (
    <div dir="rtl">
      <h1 className="mb-1 text-xl font-semibold text-neutral-900">בנק השאלות</h1>
      <p className="mb-4 text-sm text-neutral-500">
        אנליטיקה בלבד — עריכת השאלות היא עבודת פיתוח (תבניות קוד ב-<code className="ltr-inline">src/assessment/bank</code>).
      </p>

      <div className="overflow-x-auto rounded-md border border-neutral-200 bg-white">
        <table className="w-full text-sm">
          <thead className="border-b border-neutral-200 bg-neutral-50 text-xs text-neutral-500">
            <tr>
              <th className="px-3 py-2 text-start">משפחה</th>
              <th className="px-3 py-2 text-start">כישור</th>
              <th className="px-3 py-2 text-start">הוגשו</th>
              <th className="px-3 py-2 text-start">דיוק</th>
              <th className="px-3 py-2 text-start">אחוז דילוג</th>
              <th className="px-3 py-2 text-start">אחוז פקיעת זמן</th>
            </tr>
          </thead>
          <tbody>
            {families.map((f) => (
              <tr key={f.templateId} className={`border-b border-neutral-100 ${f.alertFlag ? "bg-amber-50" : ""}`}>
                <td className="px-3 py-2 ltr-inline font-mono text-xs">{f.templateId}</td>
                <td className="px-3 py-2 text-xs">{f.pillar}</td>
                <td className="px-3 py-2">{f.served}</td>
                <td className="px-3 py-2">{formatPercent(f.accuracy)}</td>
                <td className="px-3 py-2">{formatPercent(f.skipRate)}</td>
                <td className="px-3 py-2">{formatPercent(f.expiryRate)}</td>
              </tr>
            ))}
            {families.length === 0 && (
              <tr>
                <td colSpan={6} className="p-6 text-center text-neutral-400">
                  אין עדיין נתוני שימוש בבנק השאלות.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
