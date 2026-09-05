import type { TransactionSql } from "postgres";

// admin_alerts (DATA_MODEL.md §3.19) — passive banners produced by the
// hourly sweep's invariant checks (ARCHITECTURE.md §10, DECISIONS_LOG.md
// #7/#16). This file only reads/dismisses them; the checks themselves run
// in `run_maintenance_sweep()` (supabase/migrations/0001_init.sql).

export interface AlertRow {
  id: number;
  code: string;
  severity: "info" | "warning" | "critical";
  messageHe: string;
  meta: unknown;
  firstSeenAt: Date;
  lastSeenAt: Date;
}

export async function listActiveAlerts(tx: TransactionSql): Promise<AlertRow[]> {
  const rows = await tx<
    Array<{
      id: number;
      code: string;
      severity: "info" | "warning" | "critical";
      message_he: string;
      meta: unknown;
      first_seen_at: Date;
      last_seen_at: Date;
    }>
  >`
    select id, code, severity, message_he, meta, first_seen_at, last_seen_at
    from admin_alerts
    where dismissed_at is null
    order by
      case severity when 'critical' then 0 when 'warning' then 1 else 2 end,
      last_seen_at desc
  `;
  return rows.map((r) => ({
    id: r.id,
    code: r.code,
    severity: r.severity,
    messageHe: r.message_he,
    meta: r.meta,
    firstSeenAt: r.first_seen_at,
    lastSeenAt: r.last_seen_at,
  }));
}

export async function dismissAlert(tx: TransactionSql, id: number, adminId: string): Promise<void> {
  await tx`update admin_alerts set dismissed_by = ${adminId}, dismissed_at = now() where id = ${id}`;
}
