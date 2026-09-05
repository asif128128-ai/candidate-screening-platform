import { NextResponse } from "next/server";

// TODO(assessment-engine engineer): POST /api/assessment/answer
// (ARCHITECTURE.md §5.2). Body: {item_id, item_token, answer, client_meta,
// events[]}. Verifies item_token (src/lib/item-token.ts), checks
// now() <= deadline_at + 2s grace, finalizes the item (answered/expired),
// inserts integrity_events, and returns the next item in the same response
// (one round-trip per transition). Must reject answers for a non-current
// item with 409, and an invalid/missing token with 401
// (TEST_STRATEGY.md §7).
export async function POST() {
  return NextResponse.json(
    { error: "not_implemented" },
    { status: 501 },
  );
}
