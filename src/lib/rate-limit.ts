import type postgres from "postgres";

// ARCHITECTURE.md §6 / CANDIDATE_FLOW.md §2.2: a Postgres-backed token
// bucket per key against the `rate_limits` table (DATA_MODEL.md §3.16):
// `key text primary key, tokens smallint, refilled_at timestamptz`. One
// atomic UPSERT does the read-modify-write so concurrent requests for the
// same key can't race past the limit (no separate SELECT ... FOR UPDATE
// needed). Cleaned up by the hourly sweep (rows older than the window).

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
}

/**
 * Consumes one token from `key`'s bucket (capacity `limit`, refilling fully
 * every `windowSeconds`). Must run inside a `withCandidate`/`withAdmin`/
 * `withSystem` transaction (`rate_limits` RLS policy allows any context).
 */
export async function consumeRateLimit(
  tx: postgres.TransactionSql,
  key: string,
  limit: number,
  windowSeconds: number,
): Promise<RateLimitResult> {
  const rows = await tx<{ tokens: number }[]>`
    insert into rate_limits (key, tokens, refilled_at)
    values (${key}, ${limit - 1}, now())
    on conflict (key) do update set
      tokens = case
        when rate_limits.refilled_at < now() - make_interval(secs => ${windowSeconds})
          then ${limit - 1}
        else rate_limits.tokens - 1
      end,
      refilled_at = case
        when rate_limits.refilled_at < now() - make_interval(secs => ${windowSeconds})
          then now()
        else rate_limits.refilled_at
      end
    where rate_limits.refilled_at < now() - make_interval(secs => ${windowSeconds})
       or rate_limits.tokens > 0
    returning tokens
  `;

  const row = rows[0];
  if (!row) {
    return { allowed: false, remaining: 0 };
  }
  return { allowed: true, remaining: row.tokens };
}

// CANDIDATE_FLOW.md §2.2 limits.
export const RATE_LIMITS = {
  signup: { limit: 5, windowSeconds: 3600 },
  resume: { limit: 5, windowSeconds: 3600 },
  otp: { limit: 3, windowSeconds: 3600 },
} as const;

export function signupRateLimitKey(ipPrefix: string): string {
  return `signup:${ipPrefix}`;
}
export function resumeRateLimitKey(emailNormalized: string): string {
  return `resume:${emailNormalized}`;
}
export function otpRateLimitKey(emailNormalized: string): string {
  return `otp:${emailNormalized}`;
}
