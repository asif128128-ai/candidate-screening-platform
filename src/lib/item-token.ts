import { createHmac, timingSafeEqual } from "node:crypto";

// ARCHITECTURE.md §5.2, §6 / DATA_MODEL.md §3.11: a per-serve item_token
// (HMAC over item_id ‖ serve_nonce) is required on every answer, so a
// captured request cannot be replayed for another item. `serve_nonce` is
// the 16 random bytes the DB sets once alongside `served_at`.
//
// This is a small, fully-specified crypto primitive (not assessment
// business logic), so it is implemented here rather than left as a
// placeholder — the assessment-engine engineer wires it into the
// GET /api/assessment/current / POST /api/assessment/answer handlers.

function hmac(itemId: string, serveNonce: Buffer, secret: string): Buffer {
  return createHmac("sha256", secret).update(itemId).update(serveNonce).digest();
}

export function computeItemToken(
  itemId: string,
  serveNonce: Buffer,
  secret: string,
): string {
  return hmac(itemId, serveNonce, secret).toString("base64url");
}

export function verifyItemToken(
  itemId: string,
  serveNonce: Buffer,
  secret: string,
  token: string,
): boolean {
  const expected = hmac(itemId, serveNonce, secret);
  let provided: Buffer;
  try {
    provided = Buffer.from(token, "base64url");
  } catch {
    return false;
  }
  if (provided.length !== expected.length) return false;
  return timingSafeEqual(expected, provided);
}
