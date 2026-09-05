import { NextResponse } from "next/server";
import { z } from "zod";
import { getCandidateApplicationId } from "@/lib/candidate-session";
import { recordBeaconEvents } from "@/db/queries/assessment";
import { extractRequestFacts, readJsonBody } from "@/lib/assessment-request";

// POST /api/assessment/events (ARCHITECTURE.md §5.2, ANTI_CHEATING.md §3):
// receives a `navigator.sendBeacon` flush of buffered integrity_events on
// `visibilitychange`->hidden and `pagehide`, so nothing is lost on tab
// close. `sendBeacon` bodies are typically `Blob`/text with a
// browser-chosen content-type (often `text/plain;charset=UTF-8`, since a
// beacon can't set custom headers) — this route is deliberately more
// lenient about Content-Type than answer/start (which are always driven by
// `fetch` with an explicit header), and always responds fast and
// best-effort: a dropped beacon must never surface as a candidate-facing
// error, and there is nothing here worth retrying (the same events are
// re-sent on the next `GET /current` per ANTI_CHEATING.md §3's buffering
// rule, so a dropped beacon can duplicate but never lose an event before
// the next successful flush point — see `recordBeaconEvents`, which is a
// plain insert with no idempotency key, so the caller is expected to only
// beacon-flush truly new events since the last successful answer/beacon).
//
// No same-origin check: `sendBeacon` requests from this origin's own page
// do not reliably carry a same-origin-comparable `Origin` header the way a
// `fetch` does, and this route can only ever append low-stakes telemetry
// scoped to the caller's own (cookie-verified) session — never read
// anything back, never affect scoring or the timer. Worst case a
// malicious cross-site beacon call (which would also need a valid,
// httpOnly candidate cookie value it cannot read) adds junk telemetry to a
// candidate's own session, which is far less sensitive than the
// answer/start endpoints this check exists for.

export const dynamic = "force-dynamic";

const eventSchema = z.object({
  kind: z.string(),
  position: z.number().int().nullable(),
  atMs: z.number(),
  durationMs: z.number().optional(),
  meta: z.record(z.string(), z.unknown()).optional(),
});

const bodySchema = z.object({
  events: z.array(eventSchema).max(200).default([]),
  clientNowMs: z.number().optional(),
});

export async function POST(request: Request) {
  const applicationId = await getCandidateApplicationId();
  if (!applicationId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const bodyResult = await readJsonBody<unknown>(request);
  if (!bodyResult.ok) {
    // Best-effort: still answer OK-ish so sendBeacon doesn't retry forever;
    // there is nothing useful to do with a malformed beacon body.
    return NextResponse.json({ ok: false }, { status: 200 });
  }
  const parsed = bodySchema.safeParse(bodyResult.body);
  if (!parsed.success || parsed.data.events.length === 0) {
    return NextResponse.json({ ok: true });
  }

  const facts = extractRequestFacts(request, parsed.data.clientNowMs ?? null);
  const result = await recordBeaconEvents(applicationId, parsed.data.events, facts);
  return NextResponse.json({ ok: result.ok });
}
