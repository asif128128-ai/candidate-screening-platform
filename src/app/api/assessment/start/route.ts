import { NextResponse } from "next/server";
import { getCandidateApplicationId } from "@/lib/candidate-session";
import { isSameOrigin } from "@/lib/csrf";
import { startAssessmentSession } from "@/db/queries/assessment";

// ARCHITECTURE.md §5.1 step 4 / IMPLEMENTATION_STATE.md's assumed contract
// (written by the candidate-flow engineer, matched here exactly): the
// briefing page's "מתחילים" button POSTs an empty JSON body and expects
// { applicationId, redirectTo } back. Everything else is resolved from the
// candidate cookie server-side — the client never gets to say which
// application it means.

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: "invalid_origin" }, { status: 403 });
  }
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().includes("application/json")) {
    return NextResponse.json({ error: "unsupported_media_type" }, { status: 415 });
  }

  const applicationId = await getCandidateApplicationId();
  if (!applicationId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const result = await startAssessmentSession(applicationId, {
    userAgent: request.headers.get("user-agent"),
    ipPrefix: null,
  });

  switch (result.kind) {
    case "ok":
      return NextResponse.json({ applicationId, redirectTo: result.redirectTo });
    case "job_not_confirmed":
      return NextResponse.json({ error: "job_not_confirmed" }, { status: 400 });
    case "consent_missing":
      return NextResponse.json({ error: "consent_missing" }, { status: 400 });
    case "already_completed":
      return NextResponse.json({ error: "already_completed" }, { status: 409 });
  }
}
