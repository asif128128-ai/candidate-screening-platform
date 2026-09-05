"use client";

import { Fragment, useState, useTransition } from "react";
import type { AssessmentSummary, ItemRow, IntegrityEventRow, NoteRow, StageHistoryRow, ConsentRow, EmailRow } from "../../../../../db/queries/candidate-detail";
import { ScoreBandPill, IntegrityPill, StagePill } from "../../../../../components/admin/pill";
import { formatScore, formatPercent, formatDateTime, scoreBand, STAGE_LABELS_HE, INTEGRITY_LABELS_HE } from "../../../../../lib/admin-format";
import {
  addNoteAction,
  markIntegrityReviewedAction,
  ignoreFocusSignalsAction,
  undoIgnoreFocusSignalsAction,
} from "./actions";

type TabKey = "summary" | "results" | "integrity" | "notes" | "history";

const TABS: Array<{ key: TabKey; label: string }> = [
  { key: "summary", label: "סיכום" },
  { key: "results", label: "תוצאות המבחן" },
  { key: "integrity", label: "אמינות המבחן" },
  { key: "notes", label: "הערות" },
  { key: "history", label: "היסטוריה" },
];

export interface TabsData {
  applicationId: string;
  summary: AssessmentSummary | null;
  items: ItemRow[];
  events: IntegrityEventRow[];
  notes: NoteRow[];
  stageHistory: StageHistoryRow[];
  consents: ConsentRow[];
  emails: EmailRow[];
}

export function CandidateTabsClient({ data }: { data: TabsData }) {
  const [tab, setTab] = useState<TabKey>("summary");
  return (
    <div dir="rtl">
      <div className="mb-4 flex gap-1 border-b border-neutral-200">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-3 py-2 text-sm font-medium ${
              tab === t.key ? "border-b-2 border-neutral-900 text-neutral-900" : "text-neutral-500 hover:text-neutral-800"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tab === "summary" && <SummaryTab data={data} />}
      {tab === "results" && <ResultsTab data={data} />}
      {tab === "integrity" && <IntegrityTab data={data} />}
      {tab === "notes" && <NotesTab data={data} />}
      {tab === "history" && <HistoryTab data={data} />}
    </div>
  );
}

function SummaryTab({ data }: { data: TabsData }) {
  const { summary, notes, stageHistory } = data;
  if (!summary) {
    return <p className="text-sm text-neutral-500">המבחן טרם הושלם עבור מועמד/ת זה.</p>;
  }
  const effectiveRisk = summary.integrityRiskAdjusted ?? summary.integrityRisk;
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <ScoreBandPill band={summary.confidence < 0.6 ? "unknown" : scoreBand(summary.scoreOverall)}>
          ציון כולל: {formatScore(summary.scoreOverall)}
        </ScoreBandPill>
        {summary.pctRank !== null && <span className="text-sm text-neutral-500">אחוזון {Math.round(summary.pctRank * 100)}</span>}
        {summary.confidence < 1 && <span className="text-xs text-neutral-400">מהימנות {formatPercent(summary.confidence)}</span>}
        <IntegrityPill risk={effectiveRisk}>{INTEGRITY_LABELS_HE[effectiveRisk]}</IntegrityPill>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <PillarCard label="חשיבה" value={summary.scoreReasoning} />
        <PillarCard label="עצמאות" value={summary.scoreIndependence} />
        <PillarCard label="טכנולוגי" value={summary.scoreTech} />
        <PillarCard label="מהירות" value={summary.scoreSpeed} />
      </div>
      {summary.integrityReasons.slice(0, 2).length > 0 && (
        <div className="rounded-md border border-neutral-200 p-3 text-sm">
          <h3 className="mb-1 font-medium text-neutral-700">סיבות מובילות לרמת האמינות</h3>
          <ul className="list-inside list-disc space-y-1 text-neutral-600">
            {summary.integrityReasons.slice(0, 2).map((r) => (
              <li key={r.code}>{r.he}</li>
            ))}
          </ul>
        </div>
      )}
      {notes.slice(0, 3).length > 0 && (
        <div className="rounded-md border border-neutral-200 p-3 text-sm">
          <h3 className="mb-1 font-medium text-neutral-700">הערות אחרונות</h3>
          <ul className="space-y-2">
            {notes.slice(0, 3).map((n) => (
              <li key={n.id} className="text-neutral-600">
                <span className="text-xs text-neutral-400">
                  {n.authorName} · {formatDateTime(n.createdAt)}
                </span>
                <p>{n.body}</p>
              </li>
            ))}
          </ul>
        </div>
      )}
      {stageHistory[0] && (
        <div className="text-sm text-neutral-500">
          שלב אחרון: {STAGE_LABELS_HE[stageHistory[0].toStage]} — {stageHistory[0].changedByName ?? "מערכת"} ·{" "}
          {formatDateTime(stageHistory[0].createdAt)}
        </div>
      )}
    </div>
  );
}

function PillarCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-neutral-200 p-3">
      <div className="text-xs text-neutral-500">{label}</div>
      <div className="text-xl font-semibold text-neutral-900">{formatScore(value)}</div>
    </div>
  );
}

function ResultsTab({ data }: { data: TabsData }) {
  const { summary, items } = data;
  const [openItemId, setOpenItemId] = useState<string | null>(null);
  if (!summary) return <p className="text-sm text-neutral-500">אין תוצאות עדיין.</p>;

  const breakdown = summary.breakdown as { blocks?: Record<string, { correct: number; total: number }> } | null;

  return (
    <div className="flex flex-col gap-4">
      {breakdown?.blocks && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {Object.entries(breakdown.blocks).map(([block, v]) => (
            <div key={block} className="rounded-md border border-neutral-200 p-3 text-sm">
              <div className="text-neutral-500">{block}</div>
              <div className="font-semibold">
                {v.correct}/{v.total}
              </div>
            </div>
          ))}
        </div>
      )}
      <table className="w-full text-sm">
        <thead className="border-b border-neutral-200 text-xs text-neutral-500">
          <tr>
            <th className="px-2 py-1 text-start">#</th>
            <th className="px-2 py-1 text-start">בלוק</th>
            <th className="px-2 py-1 text-start">קושי</th>
            <th className="px-2 py-1 text-start">סטטוס</th>
            <th className="px-2 py-1 text-start">זמן תגובה</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <Fragment key={item.id}>
              <tr
                className="cursor-pointer border-b border-neutral-100 hover:bg-neutral-50"
                onClick={() => setOpenItemId(openItemId === item.id ? null : item.id)}
              >
                <td className="px-2 py-1">{item.position}</td>
                <td className="px-2 py-1">{item.blockKey}</td>
                <td className="px-2 py-1">{item.difficulty}</td>
                <td className="px-2 py-1">
                  {item.status === "answered" ? (item.isCorrect ? "נכון" : "שגוי") : item.status === "expired" ? "פג זמן" : item.status}
                  {item.outageCreditMs > 0 && <span className="ms-1 text-xs text-sky-600">(זוכה בזמן תקלה)</span>}
                </td>
                <td className="px-2 py-1 ltr-inline">{item.responseMs ? `${Math.round(item.responseMs / 100) / 10}s` : "—"}</td>
              </tr>
              {openItemId === item.id && (
                <tr className="border-b border-neutral-100 bg-neutral-50">
                  <td colSpan={5} className="px-3 py-2 text-xs text-neutral-600">
                    <div className="mb-1 font-medium">{item.templateId}</div>
                    {item.content !== null ? (
                      <>
                        <pre className="ltr-inline whitespace-pre-wrap text-[11px]">{JSON.stringify(item.content, null, 2)}</pre>
                        <div className="mt-1">
                          תשובת המועמד/ת: <span className="font-mono">{JSON.stringify(item.answer)}</span>
                        </div>
                        <div>
                          תשובה נכונה: <span className="font-mono">{JSON.stringify(item.answerKey)}</span>
                        </div>
                      </>
                    ) : (
                      <p>תוכן הפריט נמחק לפי מדיניות שמירת המידע (12 חודשים לאחר סיום); הציון והפירוט נשמרו.</p>
                    )}
                  </td>
                </tr>
              )}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function IntegrityTab({ data }: { data: TabsData }) {
  const { applicationId, summary, events } = data;
  const [isPending, startTransition] = useTransition();
  const [reason, setReason] = useState("");
  if (!summary) return <p className="text-sm text-neutral-500">אין נתוני אמינות עדיין.</p>;

  const effectiveRisk = summary.integrityRiskAdjusted ?? summary.integrityRisk;
  const totalDurationMs = Math.max(1, ...events.filter((e) => e.durationMs).map((e) => e.durationMs ?? 0), 60000);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <IntegrityPill risk={effectiveRisk}>{INTEGRITY_LABELS_HE[effectiveRisk]}</IntegrityPill>
        {summary.integrityIgnoreFocus && (
          <span className="text-xs text-neutral-500">
            אותות פוקוס הוחרגו על ידי {summary.integrityAdjustedByName} — {summary.integrityAdjustReason}
          </span>
        )}
      </div>

      <ul className="list-inside list-disc space-y-1 text-sm text-neutral-700">
        {summary.integrityReasons.map((r) => (
          <li key={r.code}>
            {r.he}
            <span className="ms-1 text-xs text-neutral-400">(משקל {r.weight})</span>
          </li>
        ))}
        {summary.integrityReasons.length === 0 && <li className="text-neutral-400">לא זוהו סימנים חריגים.</li>}
      </ul>

      <div>
        <h3 className="mb-1 text-sm font-medium text-neutral-700">ציר זמן</h3>
        <div className="flex h-4 w-full overflow-hidden rounded-full bg-neutral-100">
          {events
            .filter((e) => e.durationMs)
            .map((e) => (
              <div
                key={e.id}
                title={`${e.kind} · ${formatDateTime(e.at)}`}
                className={`h-full ${e.kind.includes("outage") ? "bg-sky-400" : e.kind.includes("hidden") || e.kind.includes("blur") ? "bg-amber-400" : "bg-neutral-300"}`}
                style={{ width: `${Math.min(100, ((e.durationMs ?? 0) / totalDurationMs) * 100)}%` }}
              />
            ))}
        </div>
      </div>

      <table className="w-full text-sm">
        <thead className="border-b border-neutral-200 text-xs text-neutral-500">
          <tr>
            <th className="px-2 py-1 text-start">אירוע</th>
            <th className="px-2 py-1 text-start">זמן</th>
            <th className="px-2 py-1 text-start">משך</th>
          </tr>
        </thead>
        <tbody>
          {events.map((e) => (
            <tr key={e.id} className="border-b border-neutral-100">
              <td className="px-2 py-1 ltr-inline">{e.kind}</td>
              <td className="px-2 py-1">{formatDateTime(e.at)}</td>
              <td className="px-2 py-1">{e.durationMs ? `${(e.durationMs / 1000).toFixed(1)}s` : "—"}</td>
            </tr>
          ))}
          {events.length === 0 && (
            <tr>
              <td colSpan={3} className="px-2 py-3 text-center text-neutral-400">
                אין אירועי אמינות רשומים (ייתכן שהוסרו לפי מדיניות שמירת המידע).
              </td>
            </tr>
          )}
        </tbody>
      </table>

      <div className="flex flex-wrap gap-2">
        <form
          action={(fd) => {
            fd.set("applicationId", applicationId);
            startTransition(() => markIntegrityReviewedAction(fd));
          }}
        >
          <button type="submit" disabled={isPending} className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm hover:bg-neutral-50">
            סמן כנבדק
          </button>
        </form>
        {!summary.integrityIgnoreFocus ? (
          <form
            action={(fd) => {
              fd.set("applicationId", applicationId);
              fd.set("reason", reason);
              startTransition(() => ignoreFocusSignalsAction(fd));
            }}
            className="flex items-center gap-2"
          >
            <input
              type="text"
              placeholder="סיבת ההתעלמות"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="rounded-md border border-neutral-300 px-2 py-1 text-sm"
            />
            <button type="submit" disabled={isPending || !reason.trim()} className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm hover:bg-neutral-50">
              התעלם מאותות פוקוס
            </button>
          </form>
        ) : (
          <form
            action={(fd) => {
              fd.set("applicationId", applicationId);
              startTransition(() => undoIgnoreFocusSignalsAction(fd));
            }}
          >
            <button type="submit" disabled={isPending} className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm hover:bg-neutral-50">
              בטל התעלמות
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

function NotesTab({ data }: { data: TabsData }) {
  const { applicationId, notes } = data;
  const [isPending, startTransition] = useTransition();
  const [body, setBody] = useState("");
  return (
    <div className="flex flex-col gap-4">
      <form
        action={(fd) => {
          fd.set("applicationId", applicationId);
          fd.set("body", body);
          startTransition(async () => {
            await addNoteAction(fd);
            setBody("");
          });
        }}
        className="flex flex-col gap-2"
      >
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={3}
          placeholder="הוסף/י הערה…"
          className="rounded-md border border-neutral-300 px-2 py-1.5 text-sm"
        />
        <button type="submit" disabled={isPending || !body.trim()} className="self-start rounded-md bg-neutral-900 px-3 py-1.5 text-sm text-white disabled:opacity-40">
          שמור הערה
        </button>
      </form>
      <ul className="flex flex-col gap-3">
        {notes.map((n) => (
          <li key={n.id} className="rounded-md border border-neutral-200 p-3 text-sm">
            <div className="mb-1 flex justify-between text-xs text-neutral-400">
              <span>{n.authorName}</span>
              <span>{formatDateTime(n.createdAt)}</span>
            </div>
            <p className="whitespace-pre-wrap text-neutral-700">{n.body}</p>
          </li>
        ))}
        {notes.length === 0 && <p className="text-sm text-neutral-400">אין הערות עדיין.</p>}
      </ul>
    </div>
  );
}

function HistoryTab({ data }: { data: TabsData }) {
  const { stageHistory, consents, emails } = data;
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h3 className="mb-2 text-sm font-medium text-neutral-700">היסטוריית שלבים</h3>
        <ul className="space-y-1.5 text-sm">
          {stageHistory.map((h) => (
            <li key={h.id} className="flex items-center gap-2 text-neutral-600">
              <StagePill>{STAGE_LABELS_HE[h.toStage]}</StagePill>
              <span className="text-xs text-neutral-400">
                {h.changedByName ?? "מערכת"} · {formatDateTime(h.createdAt)}
                {h.note ? ` · ${h.note}` : ""}
              </span>
            </li>
          ))}
        </ul>
      </div>
      <div>
        <h3 className="mb-2 text-sm font-medium text-neutral-700">הסכמות</h3>
        <ul className="space-y-1 text-sm text-neutral-600">
          {consents.map((c) => (
            <li key={c.id}>
              {c.kind} — {formatDateTime(c.acceptedAt)}
            </li>
          ))}
          {consents.length === 0 && <p className="text-neutral-400">אין רשומות הסכמה.</p>}
        </ul>
      </div>
      <div>
        <h3 className="mb-2 text-sm font-medium text-neutral-700">מיילים שנשלחו</h3>
        <ul className="space-y-1 text-sm text-neutral-600">
          {emails.map((e) => (
            <li key={e.id}>
              {e.template} — {e.sentAt ? `נשלח ${formatDateTime(e.sentAt)}` : `ממתין (${e.attempts} ניסיונות)`}
            </li>
          ))}
          {emails.length === 0 && <p className="text-neutral-400">לא נשלחו מיילים.</p>}
        </ul>
      </div>
    </div>
  );
}
