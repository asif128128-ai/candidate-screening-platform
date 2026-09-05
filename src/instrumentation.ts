// ARCHITECTURE.md §1, §10 / DEPLOYMENT.md §3, §10: Sentry is required in
// production ("boot refuses to start without SENTRY_DSN"); every unhandled
// error, 5xx, and boot-time check failure is captured. This is the minimal
// wiring — Next.js calls `register()` once per server runtime at boot.
// TODO(next engineer touching alerting): add `onRequestError` hook exports
// once there are real routes to instrument, and consider `withSentryConfig`
// in next.config.ts for source-map upload if/when a Sentry auth token is
// provisioned (not required for basic error capture).
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const dsn = process.env.SENTRY_DSN;
  if (!dsn) {
    if (process.env.NODE_ENV === "production") {
      // ARCHITECTURE.md §3: "production boot refuses to start without
      // SENTRY_DSN so that 'alerting quietly off' cannot happen."
      throw new Error(
        "SENTRY_DSN is required in production (ARCHITECTURE.md §3) — alerting must not be silently off.",
      );
    }
    return;
  }

  const Sentry = await import("@sentry/nextjs");
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV,
    tracesSampleRate: 0.1,
  });
}
