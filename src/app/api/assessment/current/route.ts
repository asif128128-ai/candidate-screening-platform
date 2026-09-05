import { NextResponse } from "next/server";

// TODO(assessment-engine engineer): GET /api/assessment/current
// (ARCHITECTURE.md §5.2). Resolves the session from the candidate cookie,
// returns the current item (content, options, deadline_at, server_now,
// item_token) and progress. On first serve, sets served_at/deadline_at/
// serve_nonce (once — the DB trigger enforces this). Later calls return the
// same item + same token so refresh is safe.
export async function GET() {
  return NextResponse.json(
    { error: "not_implemented" },
    { status: 501 },
  );
}
