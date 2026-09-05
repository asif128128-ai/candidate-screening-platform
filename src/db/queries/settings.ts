import type { TransactionSql } from "postgres";

// הגדרות (ADMIN_UX.md §7): admin users table, privacy request queue, email
// outbox status, system status (DB size, purge backlog, sweep/outage).

export interface AdminUserRow {
  id: string;
  email: string;
  displayName: string;
  disabledAt: Date | null;
  createdAt: Date;
}

export async function listAdminUsers(tx: TransactionSql): Promise<AdminUserRow[]> {
  const rows = await tx<
    Array<{ id: string; email: string; display_name: string; disabled_at: Date | null; created_at: Date }>
  >`
    select id, email, display_name, disabled_at, created_at from admin_users order by created_at
  `;
  return rows.map((r) => ({
    id: r.id,
    email: r.email,
    displayName: r.display_name,
    disabledAt: r.disabled_at,
    createdAt: r.created_at,
  }));
}

/** Inserts the allowlist row. The Supabase Auth invite email is sent by the
 * caller (needs the service-role client, which lives outside src/db) —
 * mirrors scripts/admin-add.ts's split of "DB row" vs. "Auth invite" so
 * both this UI path and the bootstrap script agree on how an admin is
 * provisioned. */
export async function addAdminUser(
  tx: TransactionSql,
  email: string,
  displayName: string,
  createdBy: string,
): Promise<string> {
  const [row] = await tx<{ id: string }[]>`
    insert into admin_users (email, display_name, created_by)
    values (${email}, ${displayName}, ${createdBy})
    on conflict (email) do update set display_name = excluded.display_name, disabled_at = null
    returning id
  `;
  if (!row) throw new Error("הוספת האדמין נכשלה");
  await tx`
    insert into admin_audit_log (admin_id, action, target_type, target_id, meta)
    values (${createdBy}, 'admin.add', 'admin_user', ${row.id}, ${tx.json({ email })})
  `;
  return row.id;
}

/** ADMIN_UX.md §8: "An admin cannot disable themselves." Enforced here, not
 * just in the UI, since Server Actions are the actual trust boundary. */
export async function setAdminDisabled(
  tx: TransactionSql,
  targetId: string,
  disabled: boolean,
  actingAdminId: string,
): Promise<void> {
  if (disabled && targetId === actingAdminId) {
    throw new Error("לא ניתן להשבית את עצמך.");
  }
  if (disabled) {
    await tx`update admin_users set disabled_at = now() where id = ${targetId}`;
  } else {
    await tx`update admin_users set disabled_at = null where id = ${targetId}`;
  }
  await tx`
    insert into admin_audit_log (admin_id, action, target_type, target_id)
    values (${actingAdminId}, ${disabled ? "admin.disable" : "admin.enable"}, 'admin_user', ${targetId})
  `;
}

export interface PrivacyRequestRow {
  id: string;
  email: string;
  kind: "access" | "delete" | "correct";
  status: "open" | "done" | "rejected";
  dueAt: Date;
  handledByName: string | null;
  createdAt: Date;
  overdue: boolean;
}

export async function listPrivacyRequests(tx: TransactionSql): Promise<PrivacyRequestRow[]> {
  const rows = await tx<
    Array<{
      id: string;
      email: string;
      kind: "access" | "delete" | "correct";
      status: "open" | "done" | "rejected";
      due_at: Date;
      handled_by_name: string | null;
      created_at: Date;
    }>
  >`
    select p.id, p.email, p.kind, p.status, p.due_at, au.display_name as handled_by_name, p.created_at
    from privacy_requests p
    left join admin_users au on au.id = p.handled_by
    order by (p.status = 'open') desc, p.due_at
  `;
  const now = new Date();
  return rows.map((r) => ({
    id: r.id,
    email: r.email,
    kind: r.kind,
    status: r.status,
    dueAt: r.due_at,
    handledByName: r.handled_by_name,
    createdAt: r.created_at,
    overdue: r.status === "open" && r.due_at.getTime() < now.getTime(),
  }));
}

export async function resolvePrivacyRequest(
  tx: TransactionSql,
  id: string,
  status: "done" | "rejected",
  adminId: string,
  note: string | null,
): Promise<void> {
  await tx`
    update privacy_requests
    set status = ${status}, handled_by = ${adminId}, handled_at = now(), note = coalesce(${note}, note)
    where id = ${id}
  `;
}

export interface EmailOutboxStats {
  pending: number;
  sent: number;
  failedOver3: number;
}

export async function getEmailOutboxStats(tx: TransactionSql): Promise<EmailOutboxStats> {
  const rows = await tx<{ metric: string; count: string }[]>`
    select 'pending' as metric, count(*) as count from email_outbox where sent_at is null and attempts <= 3
    union all
    select 'sent', count(*) from email_outbox where sent_at is not null
    union all
    select 'failed', count(*) from email_outbox where sent_at is null and attempts > 3
  `;
  const byMetric = Object.fromEntries(rows.map((r) => [r.metric, Number(r.count)]));
  return { pending: byMetric.pending ?? 0, sent: byMetric.sent ?? 0, failedOver3: byMetric.failed ?? 0 };
}

export interface SystemStatus {
  dbSizeBytes: number | null;
  dbSizeAt: Date | null;
  lastSweep: Date;
  lastOutageStart: Date | null;
  lastOutageEnd: Date | null;
  cvPurgeBacklog: number;
  cvPurgeStuckOver24h: number;
  migrationVersion: string | null;
}

export async function getSystemStatus(tx: TransactionSql): Promise<SystemStatus> {
  const [m] = await tx<
    Array<{ db_size_bytes: string | null; db_size_at: Date | null; last_sweep: Date; last_outage_start: Date | null; last_outage_end: Date | null }>
  >`select db_size_bytes, db_size_at, last_sweep, last_outage_start, last_outage_end from maintenance`;
  const [purgeRow] = await tx<{ count: string }[]>`select count(*) from cv_purge_queue`;
  const [stuckRow] = await tx<{ count: string }[]>`
    select count(*) from cv_purge_queue where enqueued_at < now() - interval '24 hours'
  `;
  const purgeCount = purgeRow?.count ?? "0";
  const stuckCount = stuckRow?.count ?? "0";
  let migrationVersion: string | null = null;
  try {
    // A SAVEPOINT, not a bare try/catch: `supabase_migrations` only exists
    // on a real Supabase-CLI-managed database (not this local Postgres
    // stand-in, DEPLOYMENT.md §5 / IMPLEMENTATION_NOTES.md). Without a
    // savepoint, a failed statement here would poison the rest of this
    // `withAdmin` transaction (Postgres aborts the whole transaction on any
    // error until rollback), silently breaking every other query sharing
    // it — caught wiring up the settings/banner queries against a local DB.
    const rows = await tx.savepoint((sp) =>
      sp<{ version: string }[]>`
        select version from supabase_migrations.schema_migrations order by version desc limit 1
      `,
    );
    migrationVersion = rows[0]?.version ?? null;
  } catch {
    migrationVersion = null; // schema doesn't exist outside a real Supabase-CLI-managed DB
  }
  return {
    dbSizeBytes: m?.db_size_bytes ? Number(m.db_size_bytes) : null,
    dbSizeAt: m?.db_size_at ?? null,
    lastSweep: m?.last_sweep ?? new Date(0),
    lastOutageStart: m?.last_outage_start ?? null,
    lastOutageEnd: m?.last_outage_end ?? null,
    cvPurgeBacklog: Number(purgeCount),
    cvPurgeStuckOver24h: Number(stuckCount),
    migrationVersion,
  };
}
