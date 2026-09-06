"use client";

import { useEffect, useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { Term } from "@/components/term";
import { Button, PAGE_CTA_WIDTH_CLASS } from "@/components/ui/button";
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
// FINTECH_REDESIGN_PLAN.md §R2.2 briefing item 1 / §R2.3.3: round 1's
// disclosure card nested a `Callout` inside a `Card` (a box inside a box)
// and left the device-status row floating on the canvas with nothing
// anchoring it. Now: one flat card holding the disclosure as plain styled
// text (eyebrow "שקיפות" + body), the consent checkbox, and the device
// status as a two-row list — nothing else on the page competes with the
// primary CTA below it for "raised" weight.

const MIN_VIEWPORT_WIDTH = 900;

interface DeviceCheck {
  viewportOk: boolean;
  viewportWidth: number;
  fullscreenAvailable: boolean;
  clockSkewMs: number | null;
}

// A 16px status disc — filled, not just an outline tick — so "ok" isn't
// carried by color alone (mint = ok, amber = attention, both get a glyph).
function StatusDisc({ ok }: { ok: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full ${ok ? "bg-mint-600" : "bg-amber-500"}`}
    >
      {ok ? (
        <svg viewBox="0 0 16 16" className="h-2.5 w-2.5" fill="none">
          <path d="M3 8.5l3 3 7-7" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ) : (
        <svg viewBox="0 0 16 16" className="h-2 w-2" fill="none">
          <path d="M8 5v3.5" stroke="white" strokeWidth="1.75" strokeLinecap="round" />
          <circle cx="8" cy="11" r="0.9" fill="white" />
        </svg>
      )}
    </span>
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
    <div className="mt-5 space-y-4">
      <Card variant="flat" data-testid="monitoring-disclosure">
        <p className="eyebrow">שקיפות</p>
        <p className="mt-1 text-[15px] leading-[24px] text-text-2">
          כדי להעריך את אמינות התוצאות, במהלך המבחן נשמרים: זמני תגובה לכל שאלה, אירועי דפדפן כמו
          יציאה מהחלון או מהמסך המלא, ניסיונות העתקה/הדבקה, שינויי גודל חלון, וכתובת ה-IP.{" "}
          <strong className="text-text">אין</strong> שימוש במצלמה או במיקרופון, ואין הקלטה של המסך או
          של ההקלדה. הנתונים האלה משמשים רק כדי לסמן לצוות הגיוס האם התוצאה נראית אמינה — ואף פעם לא
          כדי לקבוע אוטומטית שמישהו &quot;רימה&quot;.
        </p>

        <div className="mt-4 border-t border-line pt-4">
          <Checkbox
            checked={consentChecked}
            onChange={(e) => setConsentChecked(e.target.checked)}
            data-testid="monitoring-consent-checkbox"
            label="קראתי ואני מסכים/ה"
          />
        </div>

        {device ? (
          <div className="mt-4 space-y-2 border-t border-line pt-4">
            <div className="rtl-row items-center gap-2 text-[14px] leading-[22px] text-text">
              <StatusDisc ok={device.viewportOk} />
              מסך רחב
            </div>
            <div className="rtl-row items-center gap-2 text-[14px] leading-[22px] text-text">
              <StatusDisc ok={device.fullscreenAvailable} />
              מסך מלא זמין
            </div>
          </div>
        ) : null}
      </Card>

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
        size="lg"
        fullWidth={false}
        className={PAGE_CTA_WIDTH_CLASS}
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
