// Pure formatting/labeling helpers for the admin UI (ADMIN_UX.md). Kept
// dependency-free and side-effect-free so they're cheap to unit test
// (TEST_STRATEGY.md calls for Vitest coverage of "query-building/formatting
// logic"). ARCHITECTURE.md §9: numbers use Intl.NumberFormat('he-IL'),
// dates Intl.DateTimeFormat('he-IL').

import type { ApplicationStage, IntegrityRisk } from "../db/queries/types";

export const STAGE_LABELS_HE: Record<ApplicationStage, string> = {
  applied: "הוגשה מועמדות",
  assessment_started: "המבחן התחיל",
  assessment_completed: "המבחן הושלם",
  under_review: "בבדיקה",
  interview: "ראיון",
  rejected: "נדחה",
  hired: "התקבל/ה",
};

export const STAGE_ORDER: ApplicationStage[] = [
  "applied",
  "assessment_started",
  "assessment_completed",
  "under_review",
  "interview",
  "rejected",
  "hired",
];

export const INTEGRITY_LABELS_HE: Record<IntegrityRisk, string> = {
  low: "סיכון נמוך",
  medium: "סיכון בינוני",
  high: "סיכון גבוה",
};

const numberFormatter = new Intl.NumberFormat("he-IL");
const scoreFormatter = new Intl.NumberFormat("he-IL", { maximumFractionDigits: 1 });
const percentFormatter = new Intl.NumberFormat("he-IL", { maximumFractionDigits: 0 });
const dateFormatter = new Intl.DateTimeFormat("he-IL", { dateStyle: "short" });
const dateTimeFormatter = new Intl.DateTimeFormat("he-IL", { dateStyle: "short", timeStyle: "short" });

export function formatNumber(n: number): string {
  return numberFormatter.format(n);
}

export function formatScore(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  return scoreFormatter.format(n);
}

export function formatPercent(fraction: number | null | undefined): string {
  if (fraction === null || fraction === undefined) return "—";
  return `${percentFormatter.format(fraction * 100)}%`;
}

export function formatDate(d: Date | string | null | undefined): string {
  if (!d) return "—";
  return dateFormatter.format(new Date(d));
}

export function formatDateTime(d: Date | string | null | undefined): string {
  if (!d) return "—";
  return dateTimeFormatter.format(new Date(d));
}

/** "לפני 3 ימים" / "לפני 5 דקות" style relative time, Hebrew, coarse buckets. */
export function formatRelativeTime(d: Date | string, now: Date = new Date()): string {
  const then = new Date(d).getTime();
  const diffMs = now.getTime() - then;
  const diffSec = Math.round(diffMs / 1000);
  if (diffSec < 60) return "עכשיו";
  const diffMin = Math.round(diffSec / 60);
  if (diffMin < 60) return `לפני ${formatNumber(diffMin)} דקות`;
  const diffHour = Math.round(diffMin / 60);
  if (diffHour < 24) return `לפני ${formatNumber(diffHour)} שעות`;
  const diffDay = Math.round(diffHour / 24);
  if (diffDay < 30) return `לפני ${formatNumber(diffDay)} ימים`;
  const diffMonth = Math.round(diffDay / 30);
  return `לפני ${formatNumber(diffMonth)} חודשים`;
}

export type ScoreBand = "low" | "mid" | "high";

/** Score band per ADMIN_UX.md §3.4 ("ציון כולל: number + band color"). */
export function scoreBand(score: number | null | undefined): ScoreBand | "unknown" {
  if (score === null || score === undefined) return "unknown";
  if (score >= 75) return "high";
  if (score >= 50) return "mid";
  return "low";
}

/**
 * Whether a reply is owed: applied more than `responseWindowDays` ago and
 * the application hasn't reached a terminal, decided stage (DECISIONS_LOG.md
 * #3: "moving to נדחה" — or hiring — resolves the promise; anything else
 * still stuck past the window is overdue).
 */
export function isOverdueForReply(
  appliedAt: Date | string,
  stage: ApplicationStage,
  responseWindowDays: number,
  now: Date = new Date(),
): boolean {
  if (stage === "rejected" || stage === "hired") return false;
  const deadline = new Date(appliedAt).getTime() + responseWindowDays * 24 * 60 * 60 * 1000;
  return now.getTime() > deadline;
}

export function responseDueDate(
  appliedAt: Date | string,
  responseWindowDays: number,
): Date {
  return new Date(new Date(appliedAt).getTime() + responseWindowDays * 24 * 60 * 60 * 1000);
}

/** DECISIONS_LOG.md #19: DB-size banner threshold, 70% of the Supabase Pro
 * plan's included 8 GB (DATA_MODEL.md §8's own growth-quantification number). */
export const DB_PLAN_BYTES = 8 * 1024 * 1024 * 1024;
export const DB_SIZE_WARNING_FRACTION = 0.7;

export function dbSizeFraction(bytes: number | null | undefined): number {
  if (!bytes) return 0;
  return bytes / DB_PLAN_BYTES;
}

export function formatBytes(bytes: number | null | undefined): string {
  if (!bytes) return "0 MB";
  const mb = bytes / (1024 * 1024);
  if (mb < 1024) return `${scoreFormatter.format(mb)} MB`;
  return `${scoreFormatter.format(mb / 1024)} GB`;
}

/** Age in whole years from a date of birth, computed the way a birthday works. */
export function ageFromDob(dob: Date | string, now: Date = new Date()): number {
  const birth = new Date(dob);
  let age = now.getFullYear() - birth.getFullYear();
  const monthDiff = now.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < birth.getDate())) {
    age--;
  }
  return age;
}
