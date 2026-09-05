"use client";

import { useCallback, useEffect, useRef } from "react";
import { EventBuffer, type BufferedEvent } from "@/lib/assessment-runner-logic";

// ANTI_CHEATING.md §3 (closed list of client event kinds) / §7 (candidate-
// side controls). This hook owns every DOM listener the runner needs and
// buffers events into one EventBuffer per rendered item; the runner reads
// `bufferRef.current` at submit time and drains it into the answer request.
// ANTI_CHEATING.md §3: "The client buffers events and flushes them (a) with
// every answer, (b) via sendBeacon on visibilitychange->hidden and
// pagehide, (c) on the next GET /current after a reload" — (a) and (b) are
// implemented here; (c) is implicit since a reload clears client state and
// the server-side telemetry-gap accounting doesn't need the lost buffer
// (ANTI_CHEATING.md §5.1's rationale: a single dropped beacon is not
// decisive on its own).

const CLIENT_INSTANCE_KEY = "assessment:clientInstanceId";

export function getOrCreateClientInstanceId(): string {
  if (typeof window === "undefined") return "server";
  try {
    const existing = window.sessionStorage.getItem(CLIENT_INSTANCE_KEY);
    if (existing) return existing;
    const fresh = crypto.randomUUID();
    window.sessionStorage.setItem(CLIENT_INSTANCE_KEY, fresh);
    return fresh;
  } catch {
    return crypto.randomUUID(); // sessionStorage blocked (private mode) — still works, just not stable across reload
  }
}

export interface IntegrityHandle {
  buffer: EventBuffer;
  drain(): BufferedEvent[];
  recordFirstInteraction(): number | null;
  recordAnswerChange(from: unknown, to: unknown): void;
  recordArtifactOpen(artifactKey: string): void;
  msSinceRender(): number;
  firstInteractionMs: React.RefObject<number | null>;
  answerChanges: React.RefObject<number>;
}

/**
 * One instance per rendered item (the runner remounts/resets this via the
 * `itemId` key). `position` and `renderedAt` (client Date.now() at render)
 * anchor every event's `atMs` to "ms since this item was rendered", matching
 * ANTI_CHEATING.md §3's `ms_since_render` convention.
 */
export function useIntegrityTelemetry(params: {
  itemId: string | null;
  position: number | null;
  renderedAtMs: number;
  itemPaneRef: React.RefObject<HTMLElement | null>;
  onFlush?: (events: BufferedEvent[]) => void;
}): IntegrityHandle {
  const { itemId, position, renderedAtMs, itemPaneRef, onFlush } = params;
  const bufferRef = useRef(new EventBuffer());
  const firstInteractionMs = useRef<number | null>(null);
  const answerChanges = useRef(0);
  const hiddenAtRef = useRef<number | null>(null);
  const blurAtRef = useRef<number | null>(null);
  const noticeShownRef = useRef(false);

  const msSinceRender = useCallback(() => Date.now() - renderedAtMs, [renderedAtMs]);

  // Reset per-item state whenever a new item is rendered.
  useEffect(() => {
    bufferRef.current = new EventBuffer();
    firstInteractionMs.current = null;
    answerChanges.current = 0;
    hiddenAtRef.current = null;
    blurAtRef.current = null;
  }, [itemId]);

  const push = useCallback(
    (kind: string, meta?: Record<string, unknown>, durationMs?: number) => {
      bufferRef.current.push({ kind, position, atMs: msSinceRender(), meta, durationMs });
    },
    [position, msSinceRender],
  );

  const recordFirstInteraction = useCallback((): number | null => {
    if (firstInteractionMs.current !== null) return firstInteractionMs.current;
    const ms = msSinceRender();
    firstInteractionMs.current = ms;
    push("first_interaction", { item_position: position, ms_since_render: ms });
    return ms;
  }, [msSinceRender, position, push]);

  const recordAnswerChange = useCallback(
    (from: unknown, to: unknown) => {
      answerChanges.current += 1;
      push("answer_change", { item_position: position, from: safeSummarize(from), to: safeSummarize(to) });
    },
    [position, push],
  );

  const recordArtifactOpen = useCallback(
    (artifactKey: string) => {
      push("artifact_open", { item_position: position, artifact_key: artifactKey, ms_since_render: msSinceRender() }, undefined);
    },
    [position, push, msSinceRender],
  );

  // visibility + window focus/blur (ANTI_CHEATING.md §3)
  useEffect(() => {
    function onVisibilityChange() {
      if (document.visibilityState === "hidden") {
        hiddenAtRef.current = Date.now();
        push("visibility_hidden", { item_position: position });
      } else if (hiddenAtRef.current !== null) {
        const hiddenMs = Date.now() - hiddenAtRef.current;
        push("visibility_visible", { item_position: position, hidden_ms: hiddenMs }, hiddenMs);
        hiddenAtRef.current = null;
        if (!noticeShownRef.current) {
          noticeShownRef.current = true;
          showReturnNotice();
        }
      }
    }
    function onBlur() {
      blurAtRef.current = Date.now();
      push("window_blur", { item_position: position });
    }
    function onFocus() {
      if (blurAtRef.current !== null) {
        const blurMs = Date.now() - blurAtRef.current;
        push("window_focus", { item_position: position, blur_ms: blurMs }, blurMs);
        blurAtRef.current = null;
      }
    }
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("blur", onBlur);
    window.addEventListener("focus", onFocus);
    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("focus", onFocus);
    };
  }, [push, position]);

  // copy / contextmenu inside the item pane; paste in answer inputs (ASSESSMENT_DESIGN.md §2.4)
  useEffect(() => {
    const pane = itemPaneRef.current;
    if (!pane) return;
    function onCopy(e: ClipboardEvent) {
      const selectionLen = window.getSelection()?.toString().length ?? 0;
      push("copy_attempt", { item_position: position, selection_len: selectionLen });
      e.preventDefault();
    }
    function onContextMenu(e: MouseEvent) {
      push("contextmenu", { item_position: position });
      e.preventDefault();
    }
    function onPaste(e: ClipboardEvent) {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) {
        const len = e.clipboardData?.getData("text").length ?? 0;
        push("paste_attempt", { item_position: position, len });
        e.preventDefault();
      }
    }
    pane.addEventListener("copy", onCopy);
    pane.addEventListener("contextmenu", onContextMenu);
    pane.addEventListener("paste", onPaste, true);
    return () => {
      pane.removeEventListener("copy", onCopy);
      pane.removeEventListener("contextmenu", onContextMenu);
      pane.removeEventListener("paste", onPaste, true);
    };
  }, [itemPaneRef, position, push]);

  // resize (>15% delta) and devtools_hint (ANTI_CHEATING.md §3, both informational/low-weight)
  useEffect(() => {
    let prevW = window.innerWidth;
    let prevH = window.innerHeight;
    function onResize() {
      const w = window.innerWidth;
      const h = window.innerHeight;
      const deltaW = Math.abs(w - prevW) / prevW;
      const deltaH = Math.abs(h - prevH) / prevH;
      if (deltaW > 0.15 || deltaH > 0.15) {
        push("resize", { w, h, prev_w: prevW, prev_h: prevH });
      }
      prevW = w;
      prevH = h;
      const delta = window.outerWidth - window.innerWidth;
      if (delta > 160) {
        push("devtools_hint", { outer_inner_delta: delta });
      }
    }
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [push]);

  // keyboard shortcuts (ctrl/cmd+C/V/Tab where observable)
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const mod = e.ctrlKey || e.metaKey;
      if (mod && ["c", "v", "Tab"].includes(e.key)) {
        push("keydown_shortcut", { combo: `${e.metaKey ? "Cmd" : "Ctrl"}+${e.key}` });
      }
      if (e.altKey && e.key === "Tab") {
        push("keydown_shortcut", { combo: "Alt+Tab" });
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [push]);

  // Flush on tab hide / pagehide via sendBeacon (ANTI_CHEATING.md §3).
  useEffect(() => {
    function flush() {
      const events = bufferRef.current.drain();
      if (events.length === 0) return;
      onFlush?.(events);
      try {
        const body = JSON.stringify({ events, clientNowMs: Date.now() });
        navigator.sendBeacon?.("/api/assessment/events", new Blob([body], { type: "application/json" }));
      } catch {
        // best-effort only
      }
    }
    function onVisibility() {
      if (document.visibilityState === "hidden") flush();
    }
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [onFlush]);

  return {
    buffer: bufferRef.current,
    drain: () => bufferRef.current.drain(),
    recordFirstInteraction,
    recordAnswerChange,
    recordArtifactOpen,
    msSinceRender,
    firstInteractionMs,
    answerChanges,
  };
}

function safeSummarize(v: unknown): unknown {
  if (v === null || v === undefined) return v;
  if (typeof v === "string") return v.length > 40 ? v.slice(0, 40) : v;
  if (typeof v === "number" || typeof v === "boolean") return v;
  try {
    const s = JSON.stringify(v);
    return s.length > 80 ? `${s.slice(0, 80)}…` : s;
  } catch {
    return String(v);
  }
}

let noticeContainer: HTMLDivElement | null = null;

/** ANTI_CHEATING.md §7: "Leaving the tab shows, on return, a one-line notice ... (first time only)." */
function showReturnNotice(): void {
  if (typeof document === "undefined") return;
  if (noticeContainer) return;
  const el = document.createElement("div");
  el.textContent = "שימו לב: יציאה מהחלון נרשמת";
  el.style.cssText =
    "position:fixed;top:12px;insetInlineStart:50%;transform:translateX(-50%);background:#111827;color:#fff;padding:8px 16px;border-radius:8px;font-size:13px;z-index:9999;direction:rtl;";
  document.body.appendChild(el);
  noticeContainer = el;
  setTimeout(() => {
    el.remove();
    noticeContainer = null;
  }, 4000);
}
