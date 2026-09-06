"use client";

import { useEffect, useState } from "react";
import { BLOCK_INTRO_AUTO_ADVANCE_MS, BLOCK_ORDER, type BlockCopy } from "@/lib/assessment-block-copy";
import { Term } from "@/components/term";
import { Chip } from "@/components/ui/chip";
import { Button, PAGE_CTA_WIDTH_CLASS } from "@/components/ui/button";

// ASSESSMENT_DESIGN.md §2: "block intro screens with the block's rules and
// time-per-item. Untimed for the candidate's benefit but auto-advances
// after 45s so the wall clock can't be gamed." §3.5: each intro has a
// collapsed "איך זה עובד" panel (opening it is not scored, shown to the
// admin as context only per that section — this runner doesn't need to log
// whether it was opened; that's out of scope for the hot-path telemetry
// list in ANTI_CHEATING.md §3, which doesn't include it).
//
// FINTECH_REDESIGN_PLAN.md §1.6: full-viewport --ink-900 background, 560px
// center column, on-ink chips for item count / time-per-item, an on-ink
// ghost disclosure with a chevron, and an onInk full-width CTA.

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      viewBox="0 0 16 16"
      className={`h-3.5 w-3.5 shrink-0 transition-transform duration-150 ${open ? "rotate-180" : ""}`}
      fill="none"
      aria-hidden="true"
    >
      <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function BlockIntro({ block, onProceed }: { block: BlockCopy; onProceed: () => void }) {
  const [howItWorksOpen, setHowItWorksOpen] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(Math.ceil(BLOCK_INTRO_AUTO_ADVANCE_MS / 1000));
  // FINTECH_REDESIGN_PLAN.md §R2.2 block-intro item 1: which of the 4 fixed
  // blocks this is, from the same order the runner's timer band uses.
  const blockPosition = BLOCK_ORDER.findIndex((k) => k === block.key) + 1;

  useEffect(() => {
    const start = Date.now();
    const interval = setInterval(() => {
      const remaining = BLOCK_INTRO_AUTO_ADVANCE_MS - (Date.now() - start);
      if (remaining <= 0) {
        clearInterval(interval);
        onProceed();
      } else {
        setSecondsLeft(Math.ceil(remaining / 1000));
      }
    }, 250);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [block.key]);

  return (
    <main
      className="flex min-h-screen flex-col items-center justify-center bg-ink-900 px-4 py-10"
      data-testid="block-intro"
      data-block-key={block.key}
    >
      <div className="w-full max-w-[560px]">
        {/* FINTECH_REDESIGN_PLAN.md §R2.2 block-intro item 1: a 4-segment
            progress rail above the content column so the candidate can see
            which of the 4 blocks this is at a glance, not just read it. */}
        <div className="grid grid-cols-4 gap-1.5" aria-hidden="true">
          {BLOCK_ORDER.map((key, i) => {
            const segPosition = i + 1;
            const segClass =
              segPosition < blockPosition ? "bg-brand-400" : segPosition === blockPosition ? "bg-white" : "bg-ink-800";
            return <span key={key} className={`h-1 rounded-full ${segClass}`} />;
          })}
        </div>
        <p className="tnum mt-4 text-[14px] leading-5 text-ink-200">
          חלק {blockPosition} מתוך 4
        </p>
        <h1 className="mt-2 text-[36px] font-bold leading-[44px] tracking-[-0.01em] text-white">{block.nameHe}</h1>

        <div className="rtl-row mt-4 flex-wrap items-center gap-2">
          <Chip onInk>{`${block.itemCount} שאלות`}</Chip>
          <Chip onInk>{`${block.timeLimitS} שניות לשאלה`}</Chip>
        </div>

        <p className="mt-5 text-base leading-[26px] text-ink-200">{block.ruleHe}</p>

        <button
          type="button"
          onClick={() => setHowItWorksOpen((v) => !v)}
          className="focus-ring rtl-row-inline mt-5 items-center gap-1.5 rounded-md text-[14px] font-medium text-ink-200 hover:text-white"
          data-testid="how-it-works-toggle"
          aria-expanded={howItWorksOpen}
        >
          <ChevronIcon open={howItWorksOpen} />
          איך זה עובד
        </button>
        {howItWorksOpen ? <p className="mt-2 text-[14px] leading-[22px] text-ink-200">{block.howItWorksHe}</p> : null}

        {/* FINTECH_REDESIGN_PLAN.md §R2.2 block-intro item 1: CTA start-
            aligned auto-width instead of a full-width bar, with the
            auto-advance line beside it (not centered) on the same row at
            >=640px — below that the CTA is still full width (Button width
            rule), so a plain row would squeeze the countdown text; stack
            instead and only go row at sm. Both children start with strong
            Hebrew text, so this doesn't need the .rtl-row bidi-reorder
            workaround (that only bites icon/digit-only flex siblings). */}
        <div className="mt-8 flex flex-col items-start gap-4 sm:flex-row sm:items-center">
          <Button
            type="button"
            variant="onInk"
            size="lg"
            fullWidth={false}
            className={PAGE_CTA_WIDTH_CLASS}
            onClick={onProceed}
            data-testid="block-intro-continue"
          >
            להתחיל
          </Button>
          <p className="tnum text-start text-[13px] leading-5 text-ink-200">
            ממשיכים אוטומטית בעוד <Term>{secondsLeft}</Term> שניות
          </p>
        </div>
      </div>
    </main>
  );
}
