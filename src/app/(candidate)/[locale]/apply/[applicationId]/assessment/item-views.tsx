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
import { ItemText } from "./item-text";

const OPTION_LETTERS = ["א", "ב", "ג", "ד", "ה", "ו"];

function ArtifactBlock({ artifact }: { artifact: Pick<Artifact, "label" | "body"> }) {
  return (
    <div className="rounded-md border border-neutral-200 p-3">
      <p className="text-xs font-medium text-neutral-500">{artifact.label}</p>
      <pre
        dir="ltr"
        className="mt-1 select-none whitespace-pre-wrap break-words text-start font-mono text-sm text-neutral-800"
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
      <div className="text-lg" data-testid="item-prompt">
        <ItemText text={content.prompt} />
      </div>
      {content.artifacts?.length ? (
        <div className="mt-4 space-y-3">
          {content.artifacts.map((a) => (
            <ArtifactBlock key={a.key} artifact={a} />
          ))}
        </div>
      ) : null}
      <div className="mt-6 space-y-2" role="radiogroup" aria-label="אפשרויות תשובה">
        {content.options.map((opt, i) => {
          const selected = answer?.selectedIndex === i;
          return (
            <button
              key={i}
              type="button"
              role="radio"
              aria-checked={selected}
              data-testid={`option-${i}`}
              onClick={() => onChange({ selectedIndex: i })}
              className={`flex w-full items-start gap-3 rounded-md border p-3 text-start transition-colors ${
                selected ? "border-neutral-900 bg-neutral-50" : "border-neutral-200 hover:bg-neutral-50"
              }`}
            >
              <span className="font-semibold">{OPTION_LETTERS[i] ?? i + 1}.</span>
              <span>{opt}</span>
            </button>
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
      <div className="text-lg" data-testid="item-prompt">
        <ItemText text={content.prompt} />
      </div>
      {content.artifacts?.length ? (
        <div className="mt-4 space-y-3">
          {content.artifacts.map((a) => (
            <ArtifactBlock key={a.key} artifact={a} />
          ))}
        </div>
      ) : null}
      <div className="mt-6 space-y-2">
        {content.options.map((opt, i) => {
          const checked = selected.has(i);
          return (
            <button
              key={i}
              type="button"
              role="checkbox"
              aria-checked={checked}
              data-testid={`option-${i}`}
              onClick={() => {
                const next = new Set(selected);
                if (checked) next.delete(i);
                else next.add(i);
                onChange({ selectedIndexes: [...next].sort((a, b) => a - b) });
              }}
              className={`flex w-full items-start gap-3 rounded-md border p-3 text-start transition-colors ${
                checked ? "border-neutral-900 bg-neutral-50" : "border-neutral-200 hover:bg-neutral-50"
              }`}
            >
              <span className="font-semibold">{OPTION_LETTERS[i] ?? i + 1}.</span>
              <span>{opt}</span>
            </button>
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
      <div className="text-lg" data-testid="item-prompt">
        <ItemText text={content.prompt} />
      </div>
      {content.artifacts?.length ? (
        <div className="mt-4 space-y-3">
          {content.artifacts.map((a) => (
            <ArtifactBlock key={a.key} artifact={a} />
          ))}
        </div>
      ) : null}
      <div className="mt-6 flex items-center gap-2">
        <input
          type="text"
          inputMode="decimal"
          dir="ltr"
          value={answer?.value === null || answer?.value === undefined ? "" : String(answer.value)}
          onChange={(e) => onChange({ value: e.target.value })}
          className="w-40 rounded-md border border-neutral-300 p-2 text-start"
          data-testid="numeric-input"
          placeholder="0"
        />
        {content.unit ? <span className="text-neutral-500">{content.unit}</span> : null}
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
      <div className="text-lg" data-testid="item-prompt">
        <ItemText text={content.prompt} />
      </div>
      {content.artifacts?.length ? (
        <div className="mt-4 space-y-3">
          {content.artifacts.map((a) => (
            <ArtifactBlock key={a.key} artifact={a} />
          ))}
        </div>
      ) : null}
      <input
        type="text"
        dir="ltr"
        value={answer?.text ?? ""}
        onChange={(e) => onChange({ text: e.target.value })}
        onPaste={(e) => e.preventDefault()}
        className="mt-6 w-full max-w-sm rounded-md border border-neutral-300 p-2 text-start"
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
      <div className="text-lg" data-testid="item-prompt">
        <ItemText text={content.prompt} />
      </div>
      <div className="mt-6 space-y-2">
        {Array.from({ length: n }, (_, slot) => (
          <div key={slot} className="flex items-center gap-3">
            <span className="w-6 text-end font-semibold">{slot + 1}.</span>
            <select
              value={order[slot] ?? -1}
              onChange={(e) => setSlot(slot, Number(e.target.value))}
              className="flex-1 rounded-md border border-neutral-300 p-2"
              data-testid={`ordering-slot-${slot}`}
            >
              <option value={-1} disabled>
                בחר/י אירוע
              </option>
              {content.items.map((item, i) => (
                <option key={i} value={i}>
                  {item}
                </option>
              ))}
            </select>
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
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <div className="order-2 lg:order-1">
        <div className="rounded-md bg-neutral-50 p-3 text-sm" data-testid="investigation-ticket">
          <ItemText text={content.ticket} />
        </div>

        <div className="mt-4">
          <p className="font-medium" data-testid="investigation-q1-prompt">
            1. {content.q1.prompt}
          </p>
          <div className="mt-2 space-y-2">
            {content.q1.options.map((opt, i) => (
              <button
                key={i}
                type="button"
                role="radio"
                aria-checked={a.q1 === i}
                data-testid={`q1-option-${i}`}
                onClick={() => onChange({ ...a, q1: i })}
                className={`flex w-full items-start gap-2 rounded-md border p-2 text-start text-sm ${
                  a.q1 === i ? "border-neutral-900 bg-neutral-50" : "border-neutral-200 hover:bg-neutral-50"
                }`}
              >
                <span className="font-semibold">{OPTION_LETTERS[i] ?? i + 1}.</span>
                <span>{opt}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="mt-4">
          <p className="font-medium" data-testid="investigation-q2-prompt">
            2. {content.q2.prompt}
          </p>
          <div className="mt-2 space-y-2">
            {content.q2.options.map((opt, i) => (
              <button
                key={i}
                type="button"
                role="radio"
                aria-checked={a.q2 === i}
                data-testid={`q2-option-${i}`}
                onClick={() => onChange({ ...a, q2: i })}
                className={`flex w-full items-start gap-2 rounded-md border p-2 text-start text-sm ${
                  a.q2 === i ? "border-neutral-900 bg-neutral-50" : "border-neutral-200 hover:bg-neutral-50"
                }`}
              >
                <span className="font-semibold">{OPTION_LETTERS[i] ?? i + 1}.</span>
                <span>{opt}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="mt-4">
          <p className="font-medium">3. {content.q3.prompt}</p>
          <input
            type="text"
            dir="ltr"
            value={a.q3 ?? ""}
            onChange={(e) => onChange({ ...a, q3: e.target.value })}
            onPaste={(e) => e.preventDefault()}
            placeholder={content.q3.placeholder}
            className="mt-2 w-full max-w-xs rounded-md border border-neutral-300 p-2 text-start text-sm"
            data-testid="q3-input"
          />
        </div>
        {!scored ? <p className="mt-3 text-xs text-neutral-400">תרגול בלבד — לא נשמר ולא נספר.</p> : null}
      </div>

      <div className="order-1 lg:order-2">
        <div className="flex flex-wrap gap-1 border-b border-neutral-200" role="tablist">
          {content.tabs.map((tab, i) => (
            <button
              key={tab.key}
              type="button"
              role="tab"
              aria-selected={activeTab === i}
              onClick={() => selectTab(i)}
              data-testid={`artifact-tab-${tab.key}`}
              className={`rounded-t-md px-3 py-2 text-sm ${
                activeTab === i ? "border border-b-0 border-neutral-300 bg-white font-medium" : "text-neutral-500 hover:bg-neutral-50"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        {active ? (
          <div className="rounded-b-md border border-t-0 border-neutral-300 p-3" data-testid="artifact-body">
            <pre dir="ltr" className="select-none whitespace-pre-wrap break-words text-start font-mono text-sm text-neutral-800">
              {active.body}
            </pre>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export { Term };
