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
  } else {
    const Sentry = await import("@sentry/nextjs");
    Sentry.init({
      dsn,
      environment: process.env.NODE_ENV,
      tracesSampleRate: 0.1,
    });
  }

  // ARCHITECTURE.md §5.2 "Server outage credit" is deliberately NOT wired
  // in here: Next.js compiles instrumentation.ts for both the nodejs and
  // edge runtimes, and a dynamic `import()` of anything reaching
  // src/db/postgres.ts (the `postgres` package needs real node net/tls/
  // crypto/stream) fails the edge bundle at build time even guarded behind
  // a NEXT_RUNTIME check, since that check is only knowable at runtime, not
  // build time. See src/lib/outage-boot-check.ts's own comment for where
  // this runs instead (lazily, on the first assessment hot-path request of
  // the process) and why that's an equally correct place for it.
}
