"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "@/i18n/navigation";
import type {
  CandidateAnswer,
  InvestigationAnswer,
  MultiChoiceAnswer,
  NumericAnswer,
  OrderingAnswer,
  ShortTextAnswer,
  SingleChoiceAnswer,
} from "@/assessment/scoring";
import type { ClientCurrentItem, AnswerApiResponse, CurrentApiResponse } from "@/lib/assessment-client-types";
import {
  computeRemainingMs,
  isAnswerPresent,
  nextRetryDelayMs,
  type RunnerItemKind,
} from "@/lib/assessment-runner-logic";
import { BLOCK_COPY, blockKeyForPosition } from "@/lib/assessment-block-copy";
import { TimerBar } from "./timer-bar";
import { BlockIntro } from "./block-intro";
import { PracticeScene } from "./practice-scene";
import {
  MultiChoiceView,
  NumericView,
  OrderingView,
  ShortTextView,
  SingleChoiceView,
  InvestigationView,
} from "./item-views";
import { getOrCreateClientInstanceId, useIntegrityTelemetry } from "./use-integrity-telemetry";

type Phase =
  | { kind: "loading" }
  | { kind: "block_intro"; blockKey: string }
  | { kind: "practice_scene" }
  | { kind: "item"; item: ClientCurrentItem }
  | { kind: "error"; message: string };

const BLOCK_INTRO_SEEN_PREFIX = "assessment:introShown:";

function hasSeenBlockIntro(blockKey: string): boolean {
  try {
    return window.sessionStorage.getItem(BLOCK_INTRO_SEEN_PREFIX + blockKey) === "1";
  } catch {
    return false;
  }
}
function markBlockIntroSeen(blockKey: string): void {
  try {
    window.sessionStorage.setItem(BLOCK_INTRO_SEEN_PREFIX + blockKey, "1");
  } catch {
    /* private mode / storage blocked — intro will just show again, harmless */
  }
}

function defaultAnswerFor(kind: RunnerItemKind): CandidateAnswer {
  switch (kind) {
    case "single_choice":
      return { selectedIndex: null } satisfies SingleChoiceAnswer;
    case "multi_choice":
      return { selectedIndexes: [] } satisfies MultiChoiceAnswer;
    case "numeric":
      return { value: null } satisfies NumericAnswer;
    case "short_text":
      return { text: null } satisfies ShortTextAnswer;
    case "ordering":
      return { order: null } satisfies OrderingAnswer;
    case "investigation":
      return { q1: null, q2: null, q3: null } satisfies InvestigationAnswer;
  }
}

export function AssessmentRunner({ applicationId }: { applicationId: string }) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>({ kind: "loading" });
  const [answer, setAnswer] = useState<CandidateAnswer | null>(null);
  const [nowTick, setNowTick] = useState(() => Date.now());
  const [submitting, setSubmitting] = useState(false);
  const [retryNotice, setRetryNotice] = useState<string | null>(null);
  const [skipConfirm, setSkipConfirm] = useState(false);
  const [outageNotice, setOutageNotice] = useState(false);

  const skewMsRef = useRef(0);
  const clientInstanceId = useMemo(() => getOrCreateClientInstanceId(), []);
  const autoSubmittedRef = useRef(false);
  const fullscreenRequestedRef = useRef(false);
  const itemPaneRef = useRef<HTMLDivElement>(null);
  const renderedAtRef = useRef(Date.now());

  const currentItem = phase.kind === "item" ? phase.item : null;

  const telemetry = useIntegrityTelemetry({
    itemId: currentItem?.itemId ?? null,
    position: currentItem?.position ?? null,
    renderedAtMs: renderedAtRef.current,
    itemPaneRef,
  });

  // ---- fullscreen (ANTI_CHEATING.md §7, ASSESSMENT_DESIGN.md — requested, not enforced) ----
  const requestFullscreenOnce = useCallback(() => {
    if (fullscreenRequestedRef.current) return;
    fullscreenRequestedRef.current = true;
    if (typeof document.documentElement.requestFullscreen === "function") {
      document.documentElement.requestFullscreen().catch(() => {
        /* user gesture requirement or browser refusal — proceed without it */
      });
    } else {
      telemetry.buffer.push({ kind: "fullscreen_unavailable", position: null, atMs: 0, meta: { ua: navigator.userAgent } });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    function onFsChange() {
      const inFullscreen = document.fullscreenElement != null;
      telemetry.buffer.push({
        kind: inFullscreen ? "fullscreen_enter" : "fullscreen_exit",
        position: currentItem?.position ?? null,
        atMs: telemetry.msSinceRender(),
      });
    }
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentItem?.position]);

  // ---- loading an item -> reset local answer state + render clock ----
  useEffect(() => {
    if (phase.kind === "item") {
      setAnswer(defaultAnswerFor(phase.item.kind as RunnerItemKind));
      renderedAtRef.current = Date.now();
      setOutageNotice(phase.item.outageCreditMs > 0);
    }
  }, [phase.kind === "item" ? phase.item.itemId : null]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---- fetch current item, applying the block-intro gate ----
  const loadCurrent = useCallback(async () => {
    try {
      const params = new URLSearchParams({
        clientNow: String(Date.now()),
        tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
        w: String(window.innerWidth),
        h: String(window.innerHeight),
        dpr: String(window.devicePixelRatio || 1),
      });
      const res = await fetch(`/api/assessment/current?${params.toString()}`, {
        headers: { "X-Client-Instance-Id": clientInstanceId },
      });
      if (res.status === 401 || res.status === 404) {
        setPhase({ kind: "error", message: "פג תוקף החיבור. רענן/י את הדף כדי להתחבר מחדש." });
        return;
      }
      const body = (await res.json()) as CurrentApiResponse;
      if ("error" in body) {
        setPhase({ kind: "error", message: "משהו השתבש, רענן/י את הדף — ההתקדמות נשמרה." });
        return;
      }
      if (body.status === "completed") {
        router.push(body.redirectTo);
        return;
      }
      skewMsRef.current = new Date(body.serverNow).getTime() - Date.now();
      setPhase({ kind: "item", item: body.item });
    } catch {
      setPhase({ kind: "error", message: "שגיאת רשת. רענן/י את הדף כדי לנסות שוב — ההתקדמות נשמרה." });
    }
  }, [clientInstanceId, router]);

  // ---- initial mount: gate on block 1's intro if not already seen this tab ----
  useEffect(() => {
    const firstBlock = "speed";
    if (!hasSeenBlockIntro(firstBlock)) {
      setPhase({ kind: "block_intro", blockKey: firstBlock });
    } else {
      void loadCurrent();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function proceedPastBlockIntro(blockKey: string) {
    markBlockIntroSeen(blockKey);
    requestFullscreenOnce();
    if (blockKey === "investigate" && !hasSeenPractice()) {
      markPracticeSeen();
      setPhase({ kind: "practice_scene" });
      return;
    }
    setPhase({ kind: "loading" });
    void loadCurrent();
  }

  function hasSeenPractice(): boolean {
    try {
      return window.sessionStorage.getItem("assessment:practiceSeen") === "1";
    } catch {
      return false;
    }
  }
  function markPracticeSeen(): void {
    try {
      window.sessionStorage.setItem("assessment:practiceSeen", "1");
    } catch {
      /* ignore */
    }
  }

  // ---- countdown tick ----
  useEffect(() => {
    if (phase.kind !== "item") return;
    const id = setInterval(() => setNowTick(Date.now()), 200);
    return () => clearInterval(id);
  }, [phase.kind]);

  const remainingMs = currentItem ? computeRemainingMs(new Date(currentItem.deadlineAt).getTime(), nowTick, skewMsRef.current) : 0;
  const totalMs = currentItem ? currentItem.timeLimitS * 1000 : 0;

  // ---- submit (answer, skip, or timer-expiry auto-submit) ----
  const submit = useCallback(
    async (submittedAnswer: CandidateAnswer | null, opts: { auto?: boolean } = {}) => {
      if (!currentItem || submitting) return;
      setSubmitting(true);
      setRetryNotice(null);

      const events = telemetry.drain();
      const body = {
        itemId: currentItem.itemId,
        itemToken: currentItem.itemToken,
        answer: submittedAnswer,
        clientMeta: {
          clientNowMs: Date.now(),
          firstInteractionMs: telemetry.firstInteractionMs.current,
          answerChanges: telemetry.answerChanges.current,
        },
        events,
      };

      let attempt = 0;
      for (;;) {
        try {
          const res = await fetch("/api/assessment/answer", {
            method: "POST",
            headers: { "Content-Type": "application/json", "X-Client-Instance-Id": clientInstanceId },
            body: JSON.stringify(body),
          });
          if (res.status === 409 || res.status === 401) {
            // Item already finalized elsewhere (e.g. a duplicate auto-submit
            // race) or a stale token — resync from the server rather than
            // erroring the candidate out.
            setSubmitting(false);
            setPhase({ kind: "loading" });
            void loadCurrent();
            return;
          }
          const data = (await res.json()) as AnswerApiResponse;
          setSubmitting(false);
          setRetryNotice(null);
          if ("error" in data) {
            setPhase({ kind: "error", message: "משהו השתבש, רענן/י את הדף — ההתקדמות נשמרה." });
            return;
          }
          if (data.status === "completed") {
            router.push(data.redirectTo);
            return;
          }
          if (data.status === "block_boundary") {
            setPhase({ kind: "block_intro", blockKey: data.nextBlockKey });
            return;
          }
          skewMsRef.current = new Date(data.serverNow).getTime() - Date.now();
          setPhase({ kind: "item", item: data.item });
          return;
        } catch {
          // CANDIDATE_FLOW.md §5: "retry with backoff up to 15s (idempotent
          // by item_id)". The item_token/answer body is unchanged across
          // retries, so a retry after a request that actually succeeded
          // server-side just re-finalizes harmlessly (server treats it as
          // "not the current item anymore" -> handled by the 409 branch
          // above on the NEXT attempt).
          const delay = nextRetryDelayMs(attempt);
          if (delay === null) {
            setSubmitting(false);
            setPhase({ kind: "error", message: "משהו השתבש, רענן/י את הדף — ההתקדמות נשמרה." });
            return;
          }
          setRetryNotice("החיבור נקטע — מנסים שוב…");
          telemetry.buffer.push({ kind: "network_retry", position: currentItem.position, atMs: telemetry.msSinceRender(), meta: { attempts: attempt + 1 } });
          await new Promise((r) => setTimeout(r, delay));
          attempt++;
        }
      }
      void opts;
    },
    [currentItem, submitting, telemetry, clientInstanceId, router, loadCurrent],
  );

  // ---- auto-submit at timer expiry (ASSESSMENT_DESIGN.md §2.3) ----
  useEffect(() => {
    if (phase.kind !== "item") return;
    if (remainingMs > 0) {
      autoSubmittedRef.current = false;
      return;
    }
    if (autoSubmittedRef.current) return;
    autoSubmittedRef.current = true;
    const kind = phase.item.kind as RunnerItemKind;
    const toSubmit = isAnswerPresent(kind, answer) ? answer : null;
    void submit(toSubmit, { auto: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remainingMs <= 0, phase.kind]);

  function handleAnswerChange(next: CandidateAnswer) {
    telemetry.recordFirstInteraction();
    if (answer !== null) telemetry.recordAnswerChange(answer, next);
    setAnswer(next);
  }

  function handleArtifactOpen(artifactKey: string) {
    telemetry.recordArtifactOpen(artifactKey);
  }

  function handleSkipClick() {
    if (!skipConfirm) {
      setSkipConfirm(true);
      return;
    }
    setSkipConfirm(false);
    void submit(null);
  }

  function handleSubmitClick() {
    if (!currentItem) return;
    const kind = currentItem.kind as RunnerItemKind;
    if (!isAnswerPresent(kind, answer)) return;
    void submit(answer);
  }

  // ---- render ----
  if (phase.kind === "loading") {
    return (
      <main className="mx-auto max-w-2xl p-8 text-center text-neutral-500" data-testid="assessment-loading">
        טוען…
      </main>
    );
  }
  if (phase.kind === "error") {
    return (
      <main className="mx-auto max-w-2xl p-8 text-center" data-testid="assessment-error">
        <p className="rounded-md bg-red-50 p-4 text-red-700">{phase.message}</p>
      </main>
    );
  }
  if (phase.kind === "block_intro") {
    const block = BLOCK_COPY[phase.blockKey];
    if (!block) return null;
    return <BlockIntro block={block} onProceed={() => proceedPastBlockIntro(phase.blockKey)} />;
  }
  if (phase.kind === "practice_scene") {
    return <PracticeScene onProceed={() => { setPhase({ kind: "loading" }); void loadCurrent(); }} />;
  }

  const item = phase.item;
  const kind = item.kind as RunnerItemKind;
  const blockName = BLOCK_COPY[blockKeyForPosition(item.position)]?.nameHe ?? item.blockKey;

  return (
    <main
      className="mx-auto max-w-4xl p-6"
      data-testid="assessment-runner"
      data-application-id={applicationId}
      onKeyDown={(e) => {
        if (e.key === "Enter" && isAnswerPresent(kind, answer) && !submitting) handleSubmitClick();
      }}
    >
      <header className="flex items-center justify-between text-sm text-neutral-500">
        <span data-testid="progress-label">
          {blockName} · שאלה {item.position} מתוך {item.totalItems}
        </span>
      </header>

      <div className="mt-2">
        <TimerBar remainingMs={remainingMs} totalMs={totalMs} />
      </div>

      {outageNotice ? (
        <p className="mt-3 rounded-md bg-blue-50 p-2 text-sm text-blue-800" data-testid="outage-notice">
          הייתה תקלה זמנית בצד שלנו — הזמן לשאלה הוארך בהתאם.
        </p>
      ) : null}
      {retryNotice ? (
        <p className="mt-3 rounded-md bg-amber-50 p-2 text-sm text-amber-800" data-testid="retry-notice">
          {retryNotice}
        </p>
      ) : null}

      <div ref={itemPaneRef} className="mt-6" data-testid="item-pane" style={{ userSelect: "none" }}>
        {kind === "single_choice" ? (
          <SingleChoiceView content={item.content as never} answer={answer as SingleChoiceAnswer | null} onChange={handleAnswerChange} />
        ) : kind === "multi_choice" ? (
          <MultiChoiceView content={item.content as never} answer={answer as MultiChoiceAnswer | null} onChange={handleAnswerChange} />
        ) : kind === "numeric" ? (
          <NumericView content={item.content as never} answer={answer as NumericAnswer | null} onChange={handleAnswerChange} />
        ) : kind === "short_text" ? (
          <ShortTextView content={item.content as never} answer={answer as ShortTextAnswer | null} onChange={handleAnswerChange} />
        ) : kind === "ordering" ? (
          <OrderingView content={item.content as never} answer={answer as OrderingAnswer | null} onChange={handleAnswerChange} />
        ) : (
          <InvestigationView
            content={item.content as never}
            answer={answer as InvestigationAnswer | null}
            onChange={handleAnswerChange}
            onArtifactOpen={handleArtifactOpen}
          />
        )}
      </div>

      <div className="mt-8 flex items-center justify-between">
        <button
          type="button"
          onClick={handleSkipClick}
          disabled={submitting}
          className="rounded-md border border-neutral-300 px-4 py-2 text-sm disabled:opacity-50"
          data-testid="skip-button"
        >
          {skipConfirm ? "לדלג בלי לענות?" : "דילוג על השאלה"}
        </button>
        <button
          type="button"
          onClick={handleSubmitClick}
          disabled={submitting || !isAnswerPresent(kind, answer)}
          className="rounded-md bg-neutral-900 px-6 py-2 font-medium text-white disabled:opacity-50"
          data-testid="submit-button"
        >
          {submitting ? "שולח…" : "שליחת תשובה"}
        </button>
      </div>
    </main>
  );
}
