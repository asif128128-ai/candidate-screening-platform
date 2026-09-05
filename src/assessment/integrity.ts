// integrity.ts — events -> integrity risk level + reasons (ANTI_CHEATING.md
// §5). Pure function, no I/O, never an input to scoreSession(). Implements
// the weighted signals (§5.1), excusals (§5.2), and hard floors (§5.3),
// including the "a fully scripted run lands at סיכון גבוה regardless of
// plausible timing" guarantee (the TELEMETRY_GAP floor).
//
// Simplification note (documented, see IMPLEMENTATION_NOTES.md): §5.2's
// excusal ("a hidden/blur span that overlaps a network_retry or
// server_outage window is not counted") is implemented per-item rather
// than with precise millisecond-window overlap math — if an item has any
// network_retry event or outage_credit_ms > 0, that item's hidden/blur
// spans are excused entirely from HIDDEN_*/BLUR_*/TOTAL_HIDDEN_RATIO and
// from HIDDEN_THEN_CORRECT_LATE.

import type { Difficulty, ItemKind } from "./types";

export type IntegrityRisk = "low" | "medium" | "high";

export interface IntegrityReason {
  code: string;
  he: string;
  weight: number;
  evidence: unknown;
}

export interface ComputeIntegrityResult {
  score: number; // 0..100, higher = more concerning
  risk: IntegrityRisk;
  reasons: IntegrityReason[];
}

export interface IntegrityItem {
  position: number;
  kind: ItemKind;
  difficulty: Difficulty;
  timeLimitS: number;
  outageCreditMs?: number;
}

export interface IntegrityResponse {
  position: number;
  isCorrect: boolean;
  responseMs: number | null;
  firstInteractionMs: number | null;
  /** Investigation only — from scoring.ts's process computation (decisive artifact opened with >= 3s dwell). */
  decisiveArtifactOpened?: boolean;
}

export type IntegrityEventKind =
  | "visibility_hidden"
  | "visibility_visible"
  | "window_blur"
  | "window_focus"
  | "fullscreen_enter"
  | "fullscreen_exit"
  | "fullscreen_unavailable"
  | "copy_attempt"
  | "paste_attempt"
  | "contextmenu"
  | "resize"
  | "devtools_hint"
  | "keydown_shortcut"
  | "input_burst"
  | "first_interaction"
  | "answer_change"
  | "artifact_open"
  | "late_submit"
  | "expired"
  | "instance_conflict"
  | "instance_new"
  | "server_outage"
  | "telemetry_empty_item"
  | "ip_change"
  | "ua_change"
  | "clock_anomaly"
  | "network_retry";

export interface IntegrityEvent {
  position: number | null; // null for session-level events (ip_change, ua_change, instance_*)
  kind: IntegrityEventKind;
  /** For visibility_visible / window_focus: the completed span's duration, ms (ANTI_CHEATING.md §3). */
  durationMs?: number;
}

const CLIENT_EVENT_KINDS = new Set<IntegrityEventKind>([
  "visibility_hidden",
  "visibility_visible",
  "window_blur",
  "window_focus",
  "fullscreen_enter",
  "fullscreen_exit",
  "fullscreen_unavailable",
  "copy_attempt",
  "paste_attempt",
  "contextmenu",
  "resize",
  "devtools_hint",
  "keydown_shortcut",
  "input_burst",
  "first_interaction",
  "answer_change",
  "artifact_open",
]);

const HIDDEN_SPAN_THRESHOLD_MS = 8000;

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

function groupByPosition<T extends { position: number | null }>(events: T[]): Map<number, T[]> {
  const map = new Map<number, T[]>();
  for (const e of events) {
    if (e.position === null) continue;
    const list = map.get(e.position) ?? [];
    list.push(e);
    map.set(e.position, list);
  }
  return map;
}

export function computeIntegrity(
  items: IntegrityItem[],
  responses: IntegrityResponse[],
  events: IntegrityEvent[],
): ComputeIntegrityResult {
  const responseByPos = new Map(responses.map((r) => [r.position, r]));
  const eventsByPos = groupByPosition(events);

  const excusedPositions = new Set<number>();
  for (const item of items) {
    const hasOutageCredit = (item.outageCreditMs ?? 0) > 0;
    const hasRetry = (eventsByPos.get(item.position) ?? []).some((e) => e.kind === "network_retry");
    if (hasOutageCredit || hasRetry) excusedPositions.add(item.position);
  }

  // ---- Per-item hidden/blur span analysis ----
  let hiddenDuringItemsCount = 0;
  let blurDuringItemsCount = 0;
  let hiddenThenCorrectLateCount = 0;
  let totalHiddenMs = 0;
  let totalLiveMs = 0;
  let artifactBlindCorrectCount = 0;
  let telemetryEmptyCount = 0;

  for (const item of items) {
    const response = responseByPos.get(item.position);
    const itemEvents = eventsByPos.get(item.position) ?? [];
    const excused = excusedPositions.has(item.position);

    const hiddenSpans = itemEvents.filter((e) => e.kind === "visibility_visible").map((e) => e.durationMs ?? 0);
    const blurSpans = itemEvents.filter((e) => e.kind === "window_focus").map((e) => e.durationMs ?? 0);

    const maxHidden = hiddenSpans.length > 0 ? Math.max(...hiddenSpans) : 0;
    const maxBlur = blurSpans.length > 0 ? Math.max(...blurSpans) : 0;

    const hasHiddenSpan = !excused && maxHidden >= HIDDEN_SPAN_THRESHOLD_MS;
    const hasBlurSpan = !excused && maxBlur >= HIDDEN_SPAN_THRESHOLD_MS;

    if (hasHiddenSpan) hiddenDuringItemsCount++;
    // "blur-only": don't double-count an item that already has a qualifying hidden span.
    else if (hasBlurSpan) blurDuringItemsCount++;

    if (!excused) {
      totalHiddenMs += hiddenSpans.reduce((a, b) => a + b, 0);
    }
    const limitMs = item.timeLimitS * 1000;
    const liveMs = Math.min(response?.responseMs ?? limitMs, limitMs);
    totalLiveMs += liveMs;

    if ((hasHiddenSpan || hasBlurSpan) && !excused && response) {
      const lateSubmit = (response.responseMs ?? 0) >= 0.75 * limitMs;
      if (response.isCorrect && lateSubmit) hiddenThenCorrectLateCount++;
    }

    if (item.kind === "investigation" && response && !excused) {
      if (response.isCorrect && response.decisiveArtifactOpened === false) artifactBlindCorrectCount++;
    }

    const hasAnyClientEvent = itemEvents.some((e) => CLIENT_EVENT_KINDS.has(e.kind));
    const hasFirstInteraction = response?.firstInteractionMs !== null && response?.firstInteractionMs !== undefined;
    if (!hasAnyClientEvent && !hasFirstInteraction) telemetryEmptyCount++;
  }

  // ---- Session-level counters ----
  const countKind = (kind: IntegrityEventKind) => events.filter((e) => e.kind === kind).length;
  const copyPasteCount = countKind("copy_attempt") + countKind("paste_attempt") + countKind("input_burst");
  const instanceNewCount = countKind("instance_new");
  const instanceConflictCount = countKind("instance_conflict");
  const ipChangeCount = countKind("ip_change");
  const uaChangeCount = countKind("ua_change");

  let impossibleTimingCount = 0;
  let fastFirstInteractionCount = 0;
  for (const item of items) {
    const response = responseByPos.get(item.position);
    if (!response || excusedPositions.has(item.position)) continue;
    const limitMs = item.timeLimitS * 1000;
    if (item.difficulty === 3 && response.isCorrect && response.responseMs !== null && response.responseMs < 0.2 * limitMs) {
      impossibleTimingCount++;
    }
    if (response.firstInteractionMs !== null && response.firstInteractionMs < 300) {
      fastFirstInteractionCount++;
    }
  }
  if (fastFirstInteractionCount >= 3) impossibleTimingCount += fastFirstInteractionCount;

  const totalHiddenRatio = totalLiveMs > 0 ? totalHiddenMs / totalLiveMs : 0;
  const telemetryGapRatio = items.length > 0 ? telemetryEmptyCount / items.length : 0;

  // ---- Normalize each signal to 0..1 (ANTI_CHEATING.md §5.1) ----
  const nHiddenDuringItems = clamp01(hiddenDuringItemsCount / 5);
  const hasOtherSignal =
    nHiddenDuringItems > 0 ||
    hiddenThenCorrectLateCount > 0 ||
    totalHiddenRatio > 0.03 ||
    copyPasteCount > 0 ||
    instanceNewCount >= 2 ||
    instanceConflictCount > 0 ||
    ipChangeCount > 0 ||
    uaChangeCount > 0 ||
    impossibleTimingCount > 0 ||
    artifactBlindCorrectCount > 0 ||
    telemetryGapRatio > 0.05;
  const nBlurRaw = clamp01(blurDuringItemsCount / 6);
  const nBlur = hasOtherSignal ? nBlurRaw : nBlurRaw * 0.4;
  const nHiddenThenCorrectLate = clamp01(hiddenThenCorrectLateCount / 3);
  const nTotalHiddenRatio = clamp01((totalHiddenRatio - 0.03) / (0.25 - 0.03));
  const nCopyPaste = clamp01(copyPasteCount / 6);

  const instanceKinds = new Set<string>();
  if (instanceNewCount >= 2) instanceKinds.add("instance_new");
  if (ipChangeCount > 0) instanceKinds.add("ip_change");
  if (uaChangeCount > 0) instanceKinds.add("ua_change");
  const nInstanceOrDevice = instanceConflictCount > 0 ? 1 : instanceKinds.size >= 2 ? 1 : instanceKinds.size === 1 ? 0.5 : 0;

  const nImpossibleTiming = clamp01(impossibleTimingCount / 3);
  const nArtifactBlindCorrect = clamp01(artifactBlindCorrectCount / 2);
  const nTelemetryGap = clamp01((telemetryGapRatio - 0.05) / (0.4 - 0.05));

  const signals: Array<{ code: string; normalized: number; weight: number; he: string; evidence: unknown }> = [
    {
      code: "HIDDEN_DURING_ITEMS",
      normalized: nHiddenDuringItems,
      weight: 24,
      he: `ב-${hiddenDuringItemsCount} שאלות החלון היה מוסתר למשך 8 שניות ומעלה בזמן שהשאלה הייתה פעילה.`,
      evidence: { count: hiddenDuringItemsCount },
    },
    {
      code: "BLUR_DURING_ITEMS",
      normalized: nBlur,
      weight: 8,
      he: `ב-${blurDuringItemsCount} שאלות החלון איבד פוקוס (בלי להיות מוסתר) למשך 8 שניות ומעלה.`,
      evidence: { count: blurDuringItemsCount },
    },
    {
      code: "HIDDEN_THEN_CORRECT_LATE",
      normalized: nHiddenThenCorrectLate,
      weight: 22,
      he: `ב-${hiddenThenCorrectLateCount} שאלות: החלון הוסתר/איבד פוקוס, ואז נשלחה תשובה נכונה ברבע האחרון של הזמן.`,
      evidence: { count: hiddenThenCorrectLateCount },
    },
    {
      code: "TOTAL_HIDDEN_RATIO",
      normalized: nTotalHiddenRatio,
      weight: 8,
      he: `החלון היה מוסתר במצטבר ${Math.round(totalHiddenRatio * 100)}% מזמן המבחן.`,
      evidence: { ratio: Number(totalHiddenRatio.toFixed(3)) },
    },
    {
      code: "COPY_PASTE",
      normalized: nCopyPaste,
      weight: 6,
      he: `נרשמו ${copyPasteCount} ניסיונות העתקה/הדבקה/הזנה מהירה חריגה.`,
      evidence: { count: copyPasteCount },
    },
    {
      code: "INSTANCE_OR_DEVICE",
      normalized: nInstanceOrDevice,
      weight: 10,
      he:
        instanceConflictCount > 0
          ? "זוהתה גישה בו-זמנית משני מכשירים/כרטיסיות."
          : "זוהה שינוי מכשיר/דפדפן/IP במהלך המבחן.",
      evidence: { instanceNewCount, instanceConflictCount, ipChangeCount, uaChangeCount },
    },
    {
      code: "IMPOSSIBLE_TIMING",
      normalized: nImpossibleTiming,
      weight: 6,
      he: "נרשמו זמני תגובה בלתי סבירים (תשובות נכונות מהירות מדי בפריטים קשים, או תגובה ראשונה תוך פחות מ-300 מ״ש).",
      evidence: { impossibleTimingCount, fastFirstInteractionCount },
    },
    {
      code: "ARTIFACT_BLIND_CORRECT",
      normalized: nArtifactBlindCorrect,
      weight: 4,
      he: `ב-${artifactBlindCorrectCount} שאלות חקירה נבחרה התשובה הנכונה מבלי שהראיה המכרעה נפתחה כלל.`,
      evidence: { count: artifactBlindCorrectCount },
    },
    {
      code: "TELEMETRY_GAP",
      normalized: nTelemetryGap,
      weight: 12,
      he: `ב-${telemetryEmptyCount} מתוך ${items.length} שאלות לא התקבלו אירועי דפדפן כלל — התשובות כנראה לא נשלחו דרך ממשק המבחן.`,
      evidence: { telemetryEmptyCount, total: items.length, ratio: Number(telemetryGapRatio.toFixed(3)) },
    },
  ];

  const rawScore = signals.reduce((sum, s) => sum + s.weight * s.normalized, 0);
  const score = Math.round(Math.min(100, rawScore) * 100) / 100;

  let level: IntegrityRisk = score >= 50 ? "high" : score >= 20 ? "medium" : "low";

  // ---- Hard floors (ANTI_CHEATING.md §5.3) ----
  if (telemetryGapRatio >= 0.4) level = "high";
  else if (telemetryGapRatio >= 0.2 && level === "low") level = "medium";
  if (instanceConflictCount > 0 && level === "low") level = "medium";

  // A blur-only pattern with no other signal can never exceed low.
  const onlyBlurSignal = signals.filter((s) => s.normalized > 0).every((s) => s.code === "BLUR_DURING_ITEMS");
  if (onlyBlurSignal) level = "low";

  const reasons: IntegrityReason[] = signals
    .filter((s) => s.normalized > 0)
    .sort((a, b) => b.weight * b.normalized - a.weight * a.normalized)
    .map((s) => ({ code: s.code, he: s.he, weight: Math.round(s.weight * s.normalized * 100) / 100, evidence: s.evidence }));

  return { score, risk: level, reasons };
}
