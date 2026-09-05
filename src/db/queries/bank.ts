import type { TransactionSql } from "postgres";

// בנק השאלות analytics (ADMIN_UX.md §6), read-only. Aggregates straight
// from `assessment_items`/`assessment_responses` — no separate rollup
// table, since at the stated volumes (hundreds–low thousands of sessions)
// a live aggregate is cheap and always correct. Highlights rows an
// `admin_alerts` invariant already flagged (`template_accuracy` /
// `scenario_drift`) rather than recomputing the drift window itself here.

export interface BankFamilyRow {
  templateId: string;
  pillar: string;
  served: number;
  accuracy: number | null;
  medianTimeUsedPct: number | null;
  skipRate: number;
  expiryRate: number;
  alertFlag: boolean;
}

export async function listBankFamilies(tx: TransactionSql): Promise<BankFamilyRow[]> {
  const rows = await tx<
    Array<{
      template_id: string;
      pillar: string;
      served: string;
      correct: string;
      answered: string;
      skipped: string;
      expired: string;
      median_time_used_pct: string | null;
    }>
  >`
    select
      i.template_id,
      i.pillar::text as pillar,
      count(*) as served,
      count(*) filter (where resp.is_correct) as correct,
      count(*) filter (where resp.is_correct is not null) as answered,
      count(*) filter (where i.status = 'skipped') as skipped,
      count(*) filter (where i.status = 'expired') as expired,
      percentile_cont(0.5) within group (order by (resp.response_ms::numeric / nullif(i.time_limit_s, 0) / 10.0))
        as median_time_used_pct
    from assessment_items i
    left join assessment_responses resp on resp.item_id = i.id
    where i.status in ('answered', 'expired', 'skipped')
    group by i.template_id, i.pillar
    order by i.template_id
  `;
  const alerts = await tx<{ meta: { key?: string } }[]>`
    select meta from admin_alerts where code in ('template_accuracy', 'scenario_drift') and dismissed_at is null
  `;
  const flaggedKeys = new Set(alerts.map((a) => a.meta?.key).filter(Boolean));

  return rows.map((r) => {
    const served = Number(r.served);
    const answered = Number(r.answered);
    return {
      templateId: r.template_id,
      pillar: r.pillar,
      served,
      accuracy: answered > 0 ? Number(r.correct) / answered : null,
      medianTimeUsedPct: r.median_time_used_pct === null ? null : Number(r.median_time_used_pct),
      skipRate: served > 0 ? Number(r.skipped) / served : 0,
      expiryRate: served > 0 ? Number(r.expired) / served : 0,
      alertFlag: flaggedKeys.has(r.template_id),
    };
  });
}
