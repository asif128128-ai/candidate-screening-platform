// ARCHITECTURE.md §6: IP is stored truncated (/24 for v4, /48 for v6) except
// on integrity_events during the assessment (not this engineer's area —
// that's the assessment runner's hot path). Candidate-flow signup/resume
// rate limiting and `candidates.ip_prefix`/`consents.ip_prefix` use the
// truncated form.

/** Best-effort client IP from standard proxy headers (Render terminates TLS in front of the app). */
export function getClientIp(headers: Headers): string | null {
  const forwardedFor = headers.get("x-forwarded-for");
  if (forwardedFor) {
    const first = forwardedFor.split(",")[0]?.trim();
    if (first) return first;
  }
  const real = headers.get("x-real-ip");
  if (real) return real.trim();
  return null;
}

/** Truncates an IPv4 address to /24 (zeroes the last octet) or IPv6 to /48. */
export function truncateIp(ip: string): string | null {
  if (ip.includes(":")) {
    // IPv6: keep the first 3 hextets (/48), rest zeroed. Handles "::"
    // shorthand by expanding just enough to grab the leading groups.
    const groups = ip.split(":");
    if (groups.length < 3) return null;
    const head = groups.slice(0, 3).filter((g) => g.length > 0);
    if (head.length < 3) return null;
    return `${head.join(":")}::/48`;
  }
  const parts = ip.split(".");
  if (parts.length !== 4 || parts.some((p) => !/^\d{1,3}$/.test(p))) return null;
  return `${parts[0]}.${parts[1]}.${parts[2]}.0/24`;
}
