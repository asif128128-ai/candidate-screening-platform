import { NextResponse } from "next/server";
import { z } from "zod";
import { getCandidateApplicationId } from "@/lib/candidate-session";
import { isSameOrigin } from "@/lib/csrf";
import { submitAnswer } from "@/db/queries/assessment";
import { extractRequestFacts, readJsonBody } from "@/lib/assessment-request";

// POST /api/assessment/answer (ARCHITECTURE.md §5.2): verifies item_token
// (HMAC over item_id ‖ serve_nonce), checks now() <= deadline_at + 2s grace,
// finalizes the item (answered/expired/skipped), inserts integrity events,
// and returns the next item in the same response — one round trip per
// transition. Rejects an answer for a non-current item with 409, an
// invalid/missing token with 401 (TEST_STRATEGY.md §7).

export const dynamic = "force-dynamic";

const eventSchema = z.object({
  kind: z.string(),
  position: z.number().int().nullable(),
  atMs: z.number(),
  durationMs: z.number().optional(),
  meta: z.record(z.string(), z.unknown()).optional(),
});

const bodySchema = z.object({
  itemId: z.string().uuid(),
  itemToken: z.string().min(1),
  answer: z.unknown(),
  clientMeta: z
    .object({
      clientNowMs: z.number().optional(),
      firstInteractionMs: z.number().nullable().optional(),
      answerChanges: z.number().int().nonnegative().optional(),
      timezone: z.string().nullable().optional(),
      screenW: z.number().nullable().optional(),
      screenH: z.number().nullable().optional(),
      dpr: z.number().nullable().optional(),
    })
    .default({}),
  events: z.array(eventSchema).max(200).default([]),
});

export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: "invalid_origin" }, { status: 403 });
  }
  const applicationId = await getCandidateApplicationId();
  if (!applicationId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const bodyResult = await readJsonBody<unknown>(request);
  if (!bodyResult.ok) {
    return NextResponse.json({ error: bodyResult.error }, { status: bodyResult.status });
  }
  const parsed = bodySchema.safeParse(bodyResult.body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }
  const { itemId, itemToken, answer, clientMeta, events } = parsed.data;

  const facts = extractRequestFacts(request, clientMeta.clientNowMs ?? null, {
    timezone: clientMeta.timezone,
    screenW: clientMeta.screenW,
    screenH: clientMeta.screenH,
    dpr: clientMeta.dpr,
  });

  const result = await submitAnswer(applicationId, {
    itemId,
    itemToken,
    answer,
    clientMeta: { firstInteractionMs: clientMeta.firstInteractionMs, answerChanges: clientMeta.answerChanges },
    events,
    facts,
  });

  switch (result.kind) {
    case "no_session":
      return NextResponse.json({ error: "no_session" }, { status: 404 });
    case "invalid_token":
      return NextResponse.json({ error: "invalid_token" }, { status: 401 });
    case "not_current_item":
      return NextResponse.json({ error: "not_current_item" }, { status: 409 });
    case "bad_request":
      return NextResponse.json({ error: result.error }, { status: 400 });
    case "completed":
      return NextResponse.json({ status: "completed", redirectTo: result.redirectTo });
    case "block_boundary":
      return NextResponse.json({
        status: "block_boundary",
        nextBlockKey: result.nextBlockKey,
        nextPosition: result.nextPosition,
      });
    case "active":
      return NextResponse.json({
        status: "active",
        item: result.next,
        serverNow: result.serverNow,
        sessionExpiresAt: result.sessionExpiresAt,
      });
  }
}
