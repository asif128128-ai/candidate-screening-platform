"use server";

import { headers } from "next/headers";
import { recordMonitoringConsent } from "@/db/queries/application-flow";
import { checkCandidateCookie } from "@/lib/candidate-session";
import { getClientIp, truncateIp } from "@/lib/ip";

// ANTI_CHEATING.md §2: records the monitoring-disclosure consent. Called
// directly from the briefing panel's client component (not via a <form
// action>, since the "מתחילים" click also needs to call the
// assessment-start endpoint right after — see briefing-panel.tsx and
// IMPLEMENTATION_STATE.md for the assumed POST /api/assessment/start
// contract, owned by the assessment-engine engineer).

export type ConsentActionResult = { ok: true } | { ok: false; error: string };

export async function confirmMonitoringConsentAction(
  applicationId: string,
  consentChecked: boolean,
): Promise<ConsentActionResult> {
  const cookieCheck = await checkCandidateCookie(applicationId);
  if (cookieCheck.kind !== "ok") {
    return { ok: false, error: "פג תוקף החיבור, יש להתחבר מחדש דרך /resume" };
  }
  if (!consentChecked) {
    return { ok: false, error: "יש לאשר את תנאי הניטור כדי להתחיל" };
  }

  const headerList = await headers();
  const rawIp = getClientIp(headerList);
  const ipPrefix = rawIp ? truncateIp(rawIp) : null;

  await recordMonitoringConsent(applicationId, ipPrefix);
  return { ok: true };
}
