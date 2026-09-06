"use client";

import { useState } from "react";
import type {
  Artifact,
  ChoiceContent,
  InvestigationContent,
  NumericContent,
  OrderingContent,
  ShortTextContent,
} from "@/assessment/types";
import type {
  InvestigationAnswer,
  MultiChoiceAnswer,
  NumericAnswer,
  OrderingAnswer,
  ShortTextAnswer,
  SingleChoiceAnswer,
} from "@/assessment/scoring";
import { Term } from "@/components/term";
import { InlineText, ItemText } from "./item-text";
import { OptionButton } from "@/components/ui/option-button";
import { Callout } from "@/components/ui/callout";
import { Chip } from "@/components/ui/chip";
import { Input, Select } from "@/components/ui/field";

const OPTION_LETTERS = ["א", "ב", "ג", "ד", "ה", "ו"];

/**
 * The grid_pattern figure (`content.figureSvg`) is composed entirely by our
 * own server-side generator code (src/assessment/bank/reasoning/grid_pattern.ts)
 * from a fixed set of shape/count/fill parameters — it never includes
 * candidate input or any other untrusted string, so injecting it via
 * dangerouslySetInnerHTML is safe here (FINTECH_REDESIGN_PLAN.md §4 A1).
 */
function Figure({ svg }: { svg: string }) {
  return <div dir="ltr" className="figure my-4" dangerouslySetInnerHTML={{ __html: svg }} />;
}

/** Renders one option's label: SVG tiles for `optionsFormat: "svg"` (reasoning.grid_pattern), inline-rendered text otherwise. */
function OptionLabel({ opt, format, keyPrefix }: { opt: string; format: "text" | "svg" | undefined; keyPrefix: string }) {
  if (format === "svg") {
    return <span className="option-tile" dir="ltr" dangerouslySetInnerHTML={{ __html: opt }} />;
  }
  return (
    <span>
      <InlineText text={opt} keyPrefix={keyPrefix} />
    </span>
  );
}

// FINTECH_REDESIGN_PLAN.md §1.6: artifacts as inner blocks — bg --canvas,
// radius 10, 1px --line, label 12/16 600 --text-3, body mono 14/22.
function ArtifactBlock({ artifact }: { artifact: Pick<Artifact, "label" | "body"> }) {
  return (
    <div className="rounded-10 border border-line bg-canvas p-3">
      <p className="text-[12px] font-semibold leading-4 text-text-3">{artifact.label}</p>
      <pre
        dir="ltr"
        className="mt-1 select-none whitespace-pre-wrap break-words text-start font-mono text-[14px] leading-[22px] text-text"
      >
        {artifact.body}
      </pre>
    </div>
  );
}

// ---------------------------------------------------------------------------
// single_choice / multi_choice — ASSESSMENT_DESIGN.md §2.4: options labeled
// א/ב/ג/ד; §5: fully keyboard operable (arrows move, Enter submits — Enter
// handling lives in the parent since it also has to trigger the submit
// button; arrow-key focus movement is native <button> tab order here).
// ---------------------------------------------------------------------------

export function SingleChoiceView({
  content,
  answer,
  onChange,
}: {
  content: ChoiceContent;
  answer: SingleChoiceAnswer | null;
  onChange: (a: SingleChoiceAnswer) => void;
}) {
  return (
    <div>
      <div className="text-[18px] font-medium leading-[30px] text-text" data-testid="item-prompt">
        <ItemText text={content.prompt} />
      </div>
      {content.figureSvg ? <Figure svg={content.figureSvg} /> : null}
      {content.artifacts?.length ? (
        <div className="mt-4 space-y-3">
          {content.artifacts.map((a) => (
            <ArtifactBlock key={a.key} artifact={a} />
          ))}
        </div>
      ) : null}
      <div
        className={content.optionsFormat === "svg" ? "mt-6 grid gap-2" : "mt-6 flex flex-col gap-2"}
        style={content.optionsFormat === "svg" ? { gridTemplateColumns: "repeat(auto-fill, 112px)" } : undefined}
        role="radiogroup"
        aria-label="אפשרויות תשובה"
      >
        {content.options.map((opt, i) => {
          const selected = answer?.selectedIndex === i;
          if (content.optionsFormat === "svg") {
            return (
              <button
                key={i}
                type="button"
                role="radio"
                aria-checked={selected}
                data-testid={`option-${i}`}
                onClick={() => onChange({ selectedIndex: i })}
                className={`focus-ring flex flex-col items-center gap-1.5 rounded-12 border p-2 transition-colors ${
                  selected ? "border-line bg-brand-50 shadow-[inset_0_0_0_2px_var(--brand-600)]" : "border-line bg-surface hover:bg-canvas"
                }`}
              >
                <OptionLabel opt={opt} format={content.optionsFormat} keyPrefix={`opt-${i}`} />
                <span
                  className={`tnum flex h-7 w-7 items-center justify-center rounded-full text-[14px] font-semibold ${
                    selected ? "bg-brand-600 text-white" : "bg-ink-100 text-ink-900"
                  }`}
                >
                  {OPTION_LETTERS[i] ?? i + 1}
                </span>
              </button>
            );
          }
          return (
            <OptionButton
              key={i}
              role="radio"
              aria-checked={selected}
              data-testid={`option-${i}`}
              badge={OPTION_LETTERS[i] ?? i + 1}
              selected={selected}
              onClick={() => onChange({ selectedIndex: i })}
            >
              <OptionLabel opt={opt} format={content.optionsFormat} keyPrefix={`opt-${i}`} />
            </OptionButton>
          );
        })}
      </div>
    </div>
  );
}

export function MultiChoiceView({
  content,
  answer,
  onChange,
}: {
  content: ChoiceContent;
  answer: MultiChoiceAnswer | null;
  onChange: (a: MultiChoiceAnswer) => void;
}) {
  const selected = new Set(answer?.selectedIndexes ?? []);
  return (
    <div>
      <div className="text-[18px] font-medium leading-[30px] text-text" data-testid="item-prompt">
        <ItemText text={content.prompt} />
      </div>
      {content.artifacts?.length ? (
        <div className="mt-4 space-y-3">
          {content.artifacts.map((a) => (
            <ArtifactBlock key={a.key} artifact={a} />
          ))}
        </div>
      ) : null}
      <div className="mt-6 flex flex-col gap-2">
        {content.options.map((opt, i) => {
          const checked = selected.has(i);
          return (
            <OptionButton
              key={i}
              role="checkbox"
              aria-checked={checked}
              data-testid={`option-${i}`}
              badge={OPTION_LETTERS[i] ?? i + 1}
              selected={checked}
              multi
              onClick={() => {
                const next = new Set(selected);
                if (checked) next.delete(i);
                else next.add(i);
                onChange({ selectedIndexes: [...next].sort((a, b) => a - b) });
              }}
            >
              <OptionLabel opt={opt} format={undefined} keyPrefix={`opt-${i}`} />
            </OptionButton>
          );
        })}
      </div>
    </div>
  );
}

export function NumericView({
  content,
  answer,
  onChange,
}: {
  content: NumericContent;
  answer: NumericAnswer | null;
  onChange: (a: NumericAnswer) => void;
}) {
  return (
    <div>
      <div className="text-[18px] font-medium leading-[30px] text-text" data-testid="item-prompt">
        <ItemText text={content.prompt} />
      </div>
      {content.artifacts?.length ? (
        <div className="mt-4 space-y-3">
          {content.artifacts.map((a) => (
            <ArtifactBlock key={a.key} artifact={a} />
          ))}
        </div>
      ) : null}
      <div className="mt-6 flex items-center gap-3">
        {/* FINTECH_REDESIGN_PLAN.md §R2.2 runner item 3: `w-40` lost to
            FIELD_BASE's `w-full` (both are plain utility classes with equal
            specificity — which one wins depends on generated-CSS order, not
            className string order), so the numeric input rendered full
            width. Fixed by sizing a wrapper instead of fighting Input's own
            width class. */}
        <div className="w-40">
          <Input
            type="text"
            inputMode="decimal"
            dir="ltr"
            value={answer?.value === null || answer?.value === undefined ? "" : String(answer.value)}
            onChange={(e) => onChange({ value: e.target.value })}
            data-testid="numeric-input"
            placeholder="0"
          />
        </div>
        {content.unit ? <span className="text-text-3">{content.unit}</span> : null}
      </div>
    </div>
  );
}

export function ShortTextView({
  content,
  answer,
  onChange,
}: {
  content: ShortTextContent;
  answer: ShortTextAnswer | null;
  onChange: (a: ShortTextAnswer) => void;
}) {
  return (
    <div>
      <div className="text-[18px] font-medium leading-[30px] text-text" data-testid="item-prompt">
        <ItemText text={content.prompt} />
      </div>
      {content.artifacts?.length ? (
        <div className="mt-4 space-y-3">
          {content.artifacts.map((a) => (
            <ArtifactBlock key={a.key} artifact={a} />
          ))}
        </div>
      ) : null}
      <Input
        type="text"
        dir="auto"
        value={answer?.text ?? ""}
        onChange={(e) => onChange({ text: e.target.value })}
        onPaste={(e) => e.preventDefault()}
        className="mt-6 max-w-sm"
        data-testid="short-text-input"
        placeholder={content.placeholder}
      />
    </div>
  );
}

export function OrderingView({
  content,
  answer,
  onChange,
}: {
  content: OrderingContent;
  answer: OrderingAnswer | null;
  onChange: (a: OrderingAnswer) => void;
}) {
  const n = content.items.length;
  const order = answer?.order ?? Array.from({ length: n }, () => -1);

  function setSlot(slot: number, itemIndex: number) {
    const next = order.slice();
    // Swap with wherever itemIndex currently sits, so it's always a valid permutation.
    const existingSlot = next.indexOf(itemIndex);
    if (existingSlot !== -1) next[existingSlot] = next[slot] ?? -1;
    next[slot] = itemIndex;
    onChange({ order: next });
  }

  return (
    <div>
      <div className="text-[18px] font-medium leading-[30px] text-text" data-testid="item-prompt">
        <ItemText text={content.prompt} />
      </div>
      <div className="mt-6 flex flex-col gap-2">
        {Array.from({ length: n }, (_, slot) => (
          <div key={slot} className="rtl-row items-center gap-3">
            <span className="tnum w-6 text-end font-semibold text-text">{slot + 1}.</span>
            <Select
              value={order[slot] ?? -1}
              onChange={(e) => setSlot(slot, Number(e.target.value))}
              className="flex-1"
              data-testid={`ordering-slot-${slot}`}
            >
              <option value={-1} disabled>
                בחרו אירוע
              </option>
              {content.items.map((item, i) => (
                <option key={i} value={i}>
                  {item}
                </option>
              ))}
            </Select>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Investigation — ASSESSMENT_DESIGN.md §3.3 / CANDIDATE_FLOW.md §5: tabs
// across the top of the artifact pane (RTL order), answers panel on the
// start side, artifact pane on the end side; each tab click is logged.
// FINTECH_REDESIGN_PLAN.md §1.6: 5/7 grid on >=1024px, underline tabs, the
// ticket as a Callout info, numbered sub-question chips.
// ---------------------------------------------------------------------------

export function InvestigationView({
  content,
  answer,
  onChange,
  onArtifactOpen,
  scored = true,
}: {
  content: InvestigationContent;
  answer: InvestigationAnswer | null;
  onChange: (a: InvestigationAnswer) => void;
  onArtifactOpen?: (artifactKey: string) => void;
  /** false for the untimed, unscored practice scene (ASSESSMENT_DESIGN.md §2). */
  scored?: boolean;
}) {
  const [activeTab, setActiveTab] = useState(0);
  const active = content.tabs[activeTab];

  // Red-team finding B (IMPLEMENTATION_STATE.md): the default (first) tab
  // used to fire an artifact_open event on mount, purely because it renders
  // visible without a click. Since the decisive artifact is tabs[0] in a
  // large share of scenes, that gave every candidate free "opened the
  // decisive artifact" credit — including one who clicks nothing and just
  // waits out the dwell threshold — for close to half the scenario pool,
  // and made `deliberation` trivially true by construction (the fabricated
  // open always preceded any real answer interaction). Deliberately NOT
  // firing onArtifactOpen here: only a genuine click via selectTab() below
  // counts as "opening" an artifact for scoring purposes, regardless of
  // which tab is shown by default. See IMPLEMENTATION_NOTES.md for the
  // full reasoning and the accepted tradeoff (a candidate who reads the
  // default tab's content without ever clicking a tab gets no process
  // credit for it, even if it happens to be the decisive one).
  function selectTab(i: number) {
    setActiveTab(i);
    const tab = content.tabs[i];
    if (tab) onArtifactOpen?.(tab.key);
  }

  const a = answer ?? { q1: null, q2: null, q3: null };

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
      <div className="order-2 lg:order-1 lg:col-span-5">
        <Callout variant="info" data-testid="investigation-ticket">
          <p className="text-[12px] font-semibold leading-4 text-brand-700">כרטיס תמיכה</p>
          <div className="mt-1">
            <ItemText text={content.ticket} />
          </div>
        </Callout>

        <div className="mt-5">
          <div className="rtl-row items-center gap-2">
            <Chip>1</Chip>
            <p className="font-medium text-text" data-testid="investigation-q1-prompt">
              {content.q1.prompt}
            </p>
          </div>
          <div className="mt-3 flex flex-col gap-2">
            {content.q1.options.map((opt, i) => (
              <OptionButton
                key={i}
                role="radio"
                aria-checked={a.q1 === i}
                data-testid={`q1-option-${i}`}
                badge={OPTION_LETTERS[i] ?? i + 1}
                selected={a.q1 === i}
                size="sm"
                onClick={() => onChange({ ...a, q1: i })}
              >
                <OptionLabel opt={opt} format={undefined} keyPrefix={`q1-opt-${i}`} />
              </OptionButton>
            ))}
          </div>
        </div>

        {/* A5/B15 (FINTECH_REDESIGN_PLAN.md §4): the untimed practice scene
            (scored === false) only ever has a real q1 — its q2/q3 are
            "not relevant in practice" placeholders (PRACTICE_CONTENT.q2/q3
            stays as data for type-shape reasons, just not rendered here). */}
        {scored ? (
          <>
            <div className="mt-5">
              <div className="rtl-row items-center gap-2">
                <Chip>2</Chip>
                <p className="font-medium text-text" data-testid="investigation-q2-prompt">
                  {content.q2.prompt}
                </p>
              </div>
              <div className="mt-3 flex flex-col gap-2">
                {content.q2.options.map((opt, i) => (
                  <OptionButton
                    key={i}
                    role="radio"
                    aria-checked={a.q2 === i}
                    data-testid={`q2-option-${i}`}
                    badge={OPTION_LETTERS[i] ?? i + 1}
                    selected={a.q2 === i}
                    size="sm"
                    onClick={() => onChange({ ...a, q2: i })}
                  >
                    <OptionLabel opt={opt} format={undefined} keyPrefix={`q2-opt-${i}`} />
                  </OptionButton>
                ))}
              </div>
            </div>

            <div className="mt-5">
              <div className="rtl-row items-center gap-2">
                <Chip>3</Chip>
                <p className="font-medium text-text">{content.q3.prompt}</p>
              </div>
              <Input
                type="text"
                dir="auto"
                value={a.q3 ?? ""}
                onChange={(e) => onChange({ ...a, q3: e.target.value })}
                onPaste={(e) => e.preventDefault()}
                placeholder={content.q3.placeholder}
                className="mt-3 max-w-xs text-[15px]"
                data-testid="q3-input"
              />
            </div>
          </>
        ) : (
          <p className="mt-4 text-[13px] leading-5 text-text-3">תרגול בלבד — לא נשמר ולא נספר.</p>
        )}
      </div>

      <div className="order-1 lg:order-2 lg:col-span-7">
        <div className="rtl-row flex-wrap gap-1 border-b border-line" role="tablist">
          {content.tabs.map((tab, i) => {
            const isActive = activeTab === i;
            return (
              <button
                key={tab.key}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => selectTab(i)}
                data-testid={`artifact-tab-${tab.key}`}
                className={`focus-ring border-b-2 px-3 py-2 text-[15px] font-semibold leading-6 transition-colors ${
                  isActive ? "border-brand-600 text-ink-900" : "border-transparent text-text-2 hover:text-ink-900"
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
        {active ? (
          <div className="mt-3 min-h-[220px] rounded-10 border border-line bg-canvas p-3" data-testid="artifact-body">
            <pre dir="ltr" className="select-none whitespace-pre-wrap break-words text-start font-mono text-[14px] leading-[22px] text-text">
              {active.body}
            </pre>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export { Term };
