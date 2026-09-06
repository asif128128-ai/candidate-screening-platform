"use client";

import { useState, type ReactNode } from "react";
import { Term } from "@/components/term";
import { Button } from "./button";

// FINTECH_REDESIGN_PLAN.md §1.5 Resume code row spec: a quiet utility row,
// not a hero — bg --canvas, radius 10, padding 12 14, 1px --line. Start:
// label above the code (JetBrains Mono). End: a secondary/sm button that
// swaps to "הועתק ✓" for 2s. Keeps data-testid="resume-code" on the code
// element and data-testid="resume-code-card" on the surrounding panel (the
// e2e suite depends on both — candidate-flow.spec.ts).
//
// `helper` is a ReactNode (not just a string) so §R2.2 step-1 item 7(e)'s
// helper line can carry a real inline <Link href="/resume"> instead of the
// raw "/resume" path appearing as literal text in prose.
export function ResumeCodeRow({ code, helper }: { code: string; helper: ReactNode }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard?.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API unavailable (permissions, insecure context) — the
      // code is still visible and selectable manually.
    }
  }

  return (
    <div className="mt-6" data-testid="resume-code-card">
      <div className="rtl-row items-center justify-between gap-3 rounded-10 border border-line bg-canvas px-[14px] py-3">
        <div className="min-w-0">
          <p className="text-[13px] leading-5 text-text-3">קוד חזרה</p>
          <p className="mt-0.5 truncate font-mono text-[18px] font-semibold leading-6 text-ink-900">
            <Term>
              <span data-testid="resume-code">{code}</span>
            </Term>
          </p>
        </div>
        <Button type="button" variant="secondary" size="sm" fullWidth={false} onClick={handleCopy}>
          {copied ? "הועתק ✓" : "העתקה"}
        </Button>
      </div>
      <p className="mt-2 text-[13px] leading-5 text-text-3">{helper}</p>
    </div>
  );
}
