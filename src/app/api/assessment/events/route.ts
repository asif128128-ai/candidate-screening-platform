import { NextResponse } from "next/server";

// TODO(assessment-engine engineer): POST /api/assessment/events
// (ARCHITECTURE.md §5.2, ANTI_CHEATING.md §3). Receives a
// `navigator.sendBeacon` flush of buffered integrity_events on
// `visibilitychange`→hidden and `pagehide` so nothing is lost on tab close.
// Body is a small JSON array; validate against the closed event-kind list
// in ANTI_CHEATING.md §3 before inserting.
export async function POST() {
  return NextResponse.json(
    { error: "not_implemented" },
    { status: 501 },
  );
}
