import { NextResponse } from "next/server";
import { getCandidateApplicationId } from "@/lib/candidate-session";
import { getCurrentItem } from "@/db/queries/assessment";
import { extractRequestFacts } from "@/lib/assessment-request";

// GET /api/assessment/current (ARCHITECTURE.md §5.2): resolves the session
// from the candidate cookie, returns the current item (content, deadline_at,
// server_now, item_token) and progress. On first serve, sets served_at/
// deadline_at/serve_nonce (once — the DB trigger enforces this). Later
// calls return the same item + same token, which is what makes a refresh
// or reconnect safe: the client never gets to move its own deadline.

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const applicationId = await getCandidateApplicationId();
  if (!applicationId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const clientNowRaw = url.searchParams.get("clientNow");
  const clientNowMs = clientNowRaw ? Number(clientNowRaw) : null;
  const facts = extractRequestFacts(request, Number.isFinite(clientNowMs) ? clientNowMs : null, {
    timezone: url.searchParams.get("tz"),
    screenW: url.searchParams.get("w") ? Number(url.searchParams.get("w")) : null,
    screenH: url.searchParams.get("h") ? Number(url.searchParams.get("h")) : null,
    dpr: url.searchParams.get("dpr") ? Number(url.searchParams.get("dpr")) : null,
  });

  const result = await getCurrentItem(applicationId, facts);

  switch (result.kind) {
    case "no_session":
      return NextResponse.json({ error: "no_session" }, { status: 404 });
    case "completed":
      return NextResponse.json({ status: "completed", redirectTo: result.redirectTo });
    case "active":
      return NextResponse.json({
        status: "active",
        item: result.payload,
        serverNow: result.serverNow,
        sessionExpiresAt: result.sessionExpiresAt,
      });
  }
}
