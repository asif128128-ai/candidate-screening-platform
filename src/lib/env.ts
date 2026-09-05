import { z } from "zod";

// DEPLOYMENT.md §3: the authoritative list of required env vars. Parsed
// once per process; `scripts/check-env.ts` calls this at boot (prestart) so
// a missing/malformed var fails fast with a readable message instead of a
// runtime crash deep in a request handler.
const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  APP_BASE_URL: z.string().url(),
  DATABASE_URL: z.string().min(1),
  // Migration-only credential; must never be read by the running server
  // (ARCHITECTURE.md §6) — validated as optional here because it is not
  // supposed to exist on Render at runtime.
  MIGRATION_DATABASE_URL: z.string().optional(),
  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  SUPABASE_ANON_KEY: z.string().min(1),
  // Admin JWT verification is now JWKS-based (src/lib/admin-jwt.ts) —
  // Supabase projects created after mid-2026 default to asymmetric (ES256)
  // signing, which has no shared secret at all. This remains only as a
  // fallback for a fully legacy (HS256-only) project.
  SUPABASE_JWT_SECRET: z.string().min(1).optional(),
  CANDIDATE_COOKIE_SECRET: z.string().min(16),
  // ARCHITECTURE.md §5.2/§6, DATA_MODEL.md §3.11: HMAC key for the per-serve
  // `item_token` (assessment hot path). Deliberately a separate secret from
  // CANDIDATE_COOKIE_SECRET even though both are HMAC keys over an
  // application-scoped id — they protect different things (long-lived
  // session identity vs. a single item's answer window) and rotating one
  // should never invalidate the other.
  ITEM_TOKEN_SECRET: z.string().min(16),
  EMAIL_ENABLED: z.enum(["true", "false"]).default("false"),
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().optional(),
  PRIVACY_CONTACT_EMAIL: z.string().email().optional(),
  SENTRY_DSN: z.string().optional(),
  ALERT_EMAIL: z.string().email().optional(),
  LOG_LEVEL: z.enum(["info", "warn", "error"]).default("info"),
  TEST_CLOCK_OFFSET_MS: z.coerce.number().optional(),
});

export type Env = z.infer<typeof envSchema>;

let cached: Env | null = null;

/**
 * Parses and validates process.env. Throws a readable (Hebrew + English)
 * error on the first problem found — see scripts/check-env.ts for the
 * boot-time caller that turns this into a clean process exit.
 */
export function loadEnv(): Env {
  if (cached) return cached;
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(
      `שגיאת הגדרות סביבה / invalid environment configuration:\n${issues}`,
    );
  }
  cached = parsed.data;
  return cached;
}

/** Extra checks that only make sense in production (DEPLOYMENT.md §3). */
export function assertProductionInvariants(env: Env): void {
  if (env.NODE_ENV !== "production") return;
  const problems: string[] = [];
  if (env.EMAIL_ENABLED !== "true") {
    problems.push(
      "EMAIL_ENABLED must be true in production (closure emails and OTP re-entry depend on it).",
    );
  }
  if (!env.SENTRY_DSN) {
    problems.push(
      "SENTRY_DSN is required in production (alerting must not be silently off).",
    );
  }
  if (env.MIGRATION_DATABASE_URL) {
    problems.push(
      "MIGRATION_DATABASE_URL must not be set on the running server (it is a developer/CI-only credential).",
    );
  }
  if (env.TEST_CLOCK_OFFSET_MS !== undefined) {
    problems.push(
      "TEST_CLOCK_OFFSET_MS must not be set in production (it would let the timed-assessment clock be shifted).",
    );
  }
  if (problems.length > 0) {
    throw new Error(
      `שגיאת תצורת ייצור / production configuration error:\n${problems
        .map((p) => `  - ${p}`)
        .join("\n")}`,
    );
  }
}
