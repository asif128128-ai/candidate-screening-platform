"use client";

import { useEffect, useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { confirmMonitoringConsentAction } from "./actions";

// CANDIDATE_FLOW.md §4 step 5: device check (viewport >= 900px, JS on —
// implied by this component running at all, cookie present — already
// required to reach this page, clock skew, Fullscreen API availability).
// Step 6: "מתחילים" -> startAssessment.
//
// `POST /api/assessment/start` is now implemented (src/app/api/assessment/
// start/route.ts, src/db/queries/assessment.ts `startAssessmentSession`),
// matching the contract assumed here exactly:
//   200 { applicationId, redirectTo } -> this component navigates to
//     redirectTo (falls back to `/apply/{applicationId}/assessment`).
//   400 { error: "job_not_confirmed" | "consent_missing" }
//   409 { error: "already_completed" } — an `in_progress` session is
//     idempotent-ok (200, no error) rather than a 409, since a page reload
//     on the briefing step before navigating away is a normal resume path,
//     not a conflict (one deviation from the originally assumed contract's
//     "already_started" 409 branch — see IMPLEMENTATION_NOTES.md).
//   401 { error: "unauthorized" }
// The 404/501 branch below is now unreachable in production but stays as
// defense-in-depth against a route that somehow isn't deployed.

const MIN_VIEWPORT_WIDTH = 900;

interface DeviceCheck {
  viewportOk: boolean;
  viewportWidth: number;
  fullscreenAvailable: boolean;
  clockSkewMs: number | null;
}

export function BriefingPanel({ applicationId }: { applicationId: string }) {
  const router = useRouter();
  const [device, setDevice] = useState<DeviceCheck | null>(null);
  const [consentChecked, setConsentChecked] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    function measure() {
      setDevice({
        viewportOk: window.innerWidth >= MIN_VIEWPORT_WIDTH,
        viewportWidth: window.innerWidth,
        fullscreenAvailable: typeof document.documentElement.requestFullscreen === "function",
        clockSkewMs: null, // populated once /api/assessment/current exists and returns server_now (ARCHITECTURE.md §5.2)
      });
    }
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  async function handleStart() {
    setError(null);
    if (!consentChecked) {
      setError("יש לאשר את תנאי הניטור כדי להתחיל");
      return;
    }
    if (device && !device.viewportOk) {
      setError("כדי להתחיל צריך מחשב עם מסך רחב");
      return;
    }
    setStarting(true);
    try {
      const consentResult = await confirmMonitoringConsentAction(applicationId, consentChecked);
      if (!consentResult.ok) {
        setError(consentResult.error);
        setStarting(false);
        return;
      }

      const res = await fetch("/api/assessment/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      if (res.status === 404 || res.status === 501) {
        setError(
          "שירות התחלת המבחן עדיין לא זמין בסביבה זו (בהמתנה לעבודת מהנדס/ת מנוע ההערכה).",
        );
        setStarting(false);
        return;
      }
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        setError(body?.error ?? "לא ניתן להתחיל את המבחן כרגע, נסו שוב");
        setStarting(false);
        return;
      }

      const body = (await res.json()) as { redirectTo?: string };
      router.push(body.redirectTo ?? `/apply/${applicationId}/assessment`);
    } catch {
      setError("שגיאת רשת, נסו שוב");
      setStarting(false);
    }
  }

  return (
    <div className="mt-6">
      <section className="rounded-md bg-neutral-50 p-4 text-sm leading-relaxed" data-testid="monitoring-disclosure">
        <h2 className="font-semibold">גילוי נאות על ניטור</h2>
        <p className="mt-2">
          כדי להעריך את אמינות התוצאות, במהלך המבחן נשמרים: זמני תגובה לכל שאלה, אירועי דפדפן כמו
          יציאה מהחלון או מהמסך המלא, ניסיונות העתקה/הדבקה, שינויי גודל חלון, וכתובת ה-IP.{" "}
          <strong>אין</strong> שימוש במצלמה או במיקרופון, ואין הקלטה של המסך או של ההקלדה. הנתונים
          האלה משמשים רק כדי לסמן לצוות הגיוס האם התוצאה נראית אמינה — ואף פעם לא כדי לקבוע
          אוטומטית שמישהו &quot;רימה&quot;.
        </p>
        <label className="mt-3 flex items-start gap-2">
          <input
            type="checkbox"
            checked={consentChecked}
            onChange={(e) => setConsentChecked(e.target.checked)}
            data-testid="monitoring-consent-checkbox"
            className="mt-1"
          />
          <span>קראתי ואני מסכים/ה</span>
        </label>
      </section>

      {device && !device.viewportOk ? (
        <p className="mt-4 rounded-md bg-amber-50 p-3 text-sm text-amber-800" data-testid="viewport-warning">
          כדי להתחיל צריך מחשב עם מסך רחב (הרוחב הנוכחי: {device.viewportWidth}px).
        </p>
      ) : null}
      {device && !device.fullscreenAvailable ? (
        <p className="mt-2 text-sm text-neutral-500">שימו לב: הדפדפן שלכם לא תומך במסך מלא — אפשר להמשיך בכל זאת.</p>
      ) : null}

      {error ? <p className="mt-4 rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}

      <button
        type="button"
        onClick={handleStart}
        disabled={starting || !consentChecked || (device !== null && !device.viewportOk)}
        className="mt-6 w-full rounded-md bg-neutral-900 py-3 font-medium text-white disabled:opacity-50"
        data-testid="start-assessment-button"
      >
        {starting ? "מתחילים…" : "מתחילים"}
      </button>
    </div>
  );
}
