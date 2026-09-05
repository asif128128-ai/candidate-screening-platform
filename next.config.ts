import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

// ARCHITECTURE.md §5.3, §10: standalone output for small image / fast cold start
// on Render; no server-side data fetching library beyond what's built in.
const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  // DEPLOYMENT.md §10: no version/SHA leakage; strict headers are applied in
  // middleware (see src/middleware.ts) so they cover every route uniformly.
  webpack: (config) => {
    // Known-harmless warnings from @sentry/nextjs's OpenTelemetry
    // dependency (dynamic require patterns it uses for auto-instrumentation
    // libraries we don't otherwise use). Silenced so real warnings don't
    // get lost in the noise; see https://github.com/getsentry/sentry-javascript/issues/12077.
    config.ignoreWarnings = [
      { module: /@opentelemetry\/instrumentation/ },
      { module: /require-in-the-middle/ },
    ];
    return config;
  },
};

export default withNextIntl(nextConfig);
