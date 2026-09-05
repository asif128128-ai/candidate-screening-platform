import { withSystem } from "@/db/postgres";
import { detectOutageWindow } from "@/assessment/timing";

// ARCHITECTURE.md §5.2 "Server outage credit": compare the single-row
// `liveness` table's last touch against "now". A gap larger than the
// threshold means the process (or the one before it) was down while items
// may have been live; `apply_outage_credit()` (SECURITY DEFINER, the only
// path allowed to touch `deadline_at` after it's set) extends every
// affected item's deadline and the session's wall clock by the overlap.
//
// Runs lazily, once per server process, on the *first* assessment hot-path
// request rather than in `instrumentation.ts`'s `register()` (ARCHITECTURE.md
// §5.2 describes it as running "at boot, before the process starts
// listening") — see IMPLEMENTATION_NOTES.md for why: instrumentation.ts is
// compiled for both the nodejs and edge runtimes, and this module reaches
// `postgres` (real node net/tls/crypto/stream), which fails the edge bundle
// at build time even behind a runtime check (the check is only knowable at
// runtime, not build time, so webpack still needs to resolve the import
// graph for the edge target). Deferring to the first hot-path call is
// functionally equivalent for what this feature protects: the credit only
// needs to be applied before *that* request reads/writes the affected
// items, which this ordering still guarantees (it's awaited synchronously,
// first thing, inside the same async call).
//
// Scoping note: `liveness` itself is only touched by the assessment
// hot-path routes (current/answer/start), not by every request in the app.
// That is sufficient for what this feature is for — crediting candidates
// who were mid-item during downtime — because a gap only matters when
// candidates are actually testing, which is exactly when the hot path is
// being hit. During periods with no active sessions, a "gap" is real but
// has nothing to credit.
let ranOnce: Promise<void> | null = null;

export function ensureOutageBootCheckRan(): Promise<void> {
  if (!ranOnce) {
    ranOnce = runOutageBootCheck(); // never rejects — see its own try/catch
  }
  return ranOnce;
}

async function runOutageBootCheck(bootAt: Date = new Date()): Promise<void> {
  try {
    await withSystem(async (tx) => {
      const [row] = await tx<Array<{ at: Date }>>`select at from liveness where id = true`;
      if (row) {
        const window = detectOutageWindow(new Date(row.at), bootAt);
        if (window) {
          const [result] = await tx<Array<{ apply_outage_credit: number }>>`
            select apply_outage_credit(${window.start}, ${window.end}) as apply_outage_credit
          `;
          console.log(
            JSON.stringify({
              event: "outage_credit_applied",
              windowStart: window.start.toISOString(),
              windowEnd: window.end.toISOString(),
              itemsCredited: result?.apply_outage_credit ?? 0,
            }),
          );
        }
      }
      await tx`update liveness set at = ${bootAt} where id = true`;
    });
  } catch (err) {
    // Boot must not crash on a transient DB hiccup (e.g. the pool isn't up
    // yet in some deploy orderings) — the next hot-path request's own
    // `touchLiveness` call will still keep the table fresh going forward,
    // and the health check's DB probe will surface a persistent failure.
    console.error(JSON.stringify({ event: "outage_boot_check_failed", error: String(err) }));
  }
}
