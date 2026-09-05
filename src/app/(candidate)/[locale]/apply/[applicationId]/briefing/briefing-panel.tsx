"use client";

import { useEffect, useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { Term } from "@/components/term";
import { Button } from "@/components/ui/button";
import { Callout } from "@/components/ui/callout";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
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
//
// FINTECH_REDESIGN_PLAN.md §1.7 briefing: the monitoring disclosure as a
// Card with a Callout "info" framing ("שקיפות") and the consent checkbox;
// device check as a compact status row using --mint-800/--amber-800;
// primary CTA "מתחילים".

const MIN_VIEWPORT_WIDTH = 900;

interface DeviceCheck {
  viewportOk: boolean;
  viewportWidth: number;
  fullscreenAvailable: boolean;
  clockSkewMs: number | null;
}

function StatusIcon({ ok }: { ok: boolean }) {
  if (ok) {
    return (
      <svg viewBox="0 0 16 16" className="h-4 w-4 text-mint-800" fill="none" aria-hidden="true">
        <path d="M3 8.5l3 3 7-7" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 16 16" className="h-4 w-4 text-amber-800" fill="none" aria-hidden="true">
      <path d="M8 4.5v4" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
      <circle cx="8" cy="11" r="1" fill="currentColor" />
    </svg>
  );
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
    <div className="mt-6 space-y-4">
      <Card data-testid="monitoring-disclosure">
        <Callout variant="info">
          <p className="text-[13px] font-semibold leading-5 text-brand-700">שקיפות</p>
          <p className="mt-1 text-[14px] leading-[22px] text-text">
            כדי להעריך את אמינות התוצאות, במהלך המבחן נשמרים: זמני תגובה לכל שאלה, אירועי דפדפן כמו
            יציאה מהחלון או מהמסך המלא, ניסיונות העתקה/הדבקה, שינויי גודל חלון, וכתובת ה-IP.{" "}
            <strong>אין</strong> שימוש במצלמה או במיקרופון, ואין הקלטה של המסך או של ההקלדה. הנתונים
            האלה משמשים רק כדי לסמן לצוות הגיוס האם התוצאה נראית אמינה — ואף פעם לא כדי לקבוע
            אוטומטית שמישהו &quot;רימה&quot;.
          </p>
        </Callout>
        <div className="mt-4">
          <Checkbox
            checked={consentChecked}
            onChange={(e) => setConsentChecked(e.target.checked)}
            data-testid="monitoring-consent-checkbox"
            label="קראתי ואני מסכים/ה"
          />
        </div>
      </Card>

      {device ? (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[14px] leading-[22px]">
          <span className={`rtl-row items-center gap-1.5 ${device.viewportOk ? "text-mint-800" : "text-amber-800"}`}>
            <StatusIcon ok={device.viewportOk} />
            מסך רחב
          </span>
          <span className={`rtl-row items-center gap-1.5 ${device.fullscreenAvailable ? "text-mint-800" : "text-amber-800"}`}>
            <StatusIcon ok={device.fullscreenAvailable} />
            מסך מלא זמין
          </span>
        </div>
      ) : null}

      {device && !device.viewportOk ? (
        <Callout variant="warning" data-testid="viewport-warning">
          כדי להתחיל צריך מחשב עם מסך רחב (הרוחב הנוכחי: <Term>{device.viewportWidth}px</Term>).
        </Callout>
      ) : null}
      {device && !device.fullscreenAvailable ? (
        <p className="text-[13px] leading-5 text-text-3">שימו לב: הדפדפן שלכם לא תומך במסך מלא — אפשר להמשיך בכל זאת.</p>
      ) : null}

      {error ? <Callout variant="error">{error}</Callout> : null}

      <Button
        type="button"
        onClick={handleStart}
        pending={starting}
        disabled={!consentChecked || (device !== null && !device.viewportOk)}
        data-testid="start-assessment-button"
      >
        {starting ? "מתחילים…" : "מתחילים"}
      </Button>
    </div>
  );
}
