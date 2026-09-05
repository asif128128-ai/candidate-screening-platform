import { getClientIp, truncateIp } from "@/lib/ip";
import type { RequestFacts } from "@/db/queries/assessment";

// Shared by the three hot-path routes (current/answer/events): pulls the
// device/network facts syncSessionFacts (assessment.ts) needs out of a
// standard Request, plus the request-size/content-type/origin checks
// ARCHITECTURE.md §6 requires of every JSON route handler.

export const MAX_JSON_BODY_BYTES = 32 * 1024; // ARCHITECTURE.md §6 / TEST_STRATEGY.md §7: "oversized payload (> 32 KB) -> 413"

export function extractRequestFacts(request: Request, clientNowMs: number | null, extra?: { timezone?: string | null; screenW?: number | null; screenH?: number | null; dpr?: number | null }): RequestFacts {
  const headers = request.headers;
  const rawIp = getClientIp(headers);
  return {
    ipPrefix: rawIp ? truncateIp(rawIp) : null,
    userAgent: headers.get("user-agent"),
    clientInstanceId: headers.get("x-client-instance-id"),
    clientNowMs,
    timezone: extra?.timezone ?? null,
    screenW: extra?.screenW ?? null,
    screenH: extra?.screenH ?? null,
    dpr: extra?.dpr ?? null,
  };
}

export type BodyReadResult<T> = { ok: true; body: T } | { ok: false; status: number; error: string };

/** Enforces Content-Type: application/json + the 32KB size cap, then parses. */
export async function readJsonBody<T>(request: Request): Promise<BodyReadResult<T>> {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().includes("application/json")) {
    return { ok: false, status: 415, error: "unsupported_media_type" };
  }
  const text = await request.text();
  if (new TextEncoder().encode(text).length > MAX_JSON_BODY_BYTES) {
    return { ok: false, status: 413, error: "payload_too_large" };
  }
  try {
    return { ok: true, body: text.length > 0 ? (JSON.parse(text) as T) : ({} as T) };
  } catch {
    return { ok: false, status: 400, error: "invalid_json" };
  }
}
