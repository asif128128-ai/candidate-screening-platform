import type { AlertRow } from "../../db/queries/alerts";
import { dismissAlertAction } from "../../app/admin/(protected)/actions";

// ADMIN_UX.md §3.0 / DECISIONS_LOG.md #7, #16: sweep-driven invariant
// banners at the top of every admin page, each with a "הבנתי" dismiss and,
// where relevant, a link. Server-rendered (a <form> per banner posts to a
// Server Action) — no client JS needed for this.

const SEVERITY_STYLE: Record<AlertRow["severity"], string> = {
  critical: "border-red-300 bg-red-50 text-red-900",
  warning: "border-amber-300 bg-amber-50 text-amber-900",
  info: "border-sky-300 bg-sky-50 text-sky-900",
};

export interface StaticBanner {
  key: string;
  severity: AlertRow["severity"];
  messageHe: string;
  href?: string;
  hrefLabel?: string;
}

export function AlertBanners({
  alerts,
  staticBanners = [],
}: {
  alerts: AlertRow[];
  staticBanners?: StaticBanner[];
}) {
  if (alerts.length === 0 && staticBanners.length === 0) return null;
  return (
    <div className="mb-6 flex flex-col gap-2">
      {staticBanners.map((b) => (
        <div
          key={b.key}
          className={`flex items-center justify-between gap-4 rounded-md border px-4 py-2 text-sm ${SEVERITY_STYLE[b.severity]}`}
        >
          <span>{b.messageHe}</span>
          {b.href && (
            <a href={b.href} className="shrink-0 whitespace-nowrap underline">
              {b.hrefLabel ?? "פרטים"}
            </a>
          )}
        </div>
      ))}
      {alerts.map((a) => (
        <div
          key={a.id}
          className={`flex items-center justify-between gap-4 rounded-md border px-4 py-2 text-sm ${SEVERITY_STYLE[a.severity]}`}
        >
          <span>{a.messageHe}</span>
          <form action={dismissAlertAction}>
            <input type="hidden" name="alertId" value={a.id} />
            <button type="submit" className="shrink-0 whitespace-nowrap underline">
              הבנתי
            </button>
          </form>
        </div>
      ))}
    </div>
  );
}
