import { Fragment } from "react";

// The pure template bank (src/assessment/bank/*, e.g. tech/sql_outcome.ts,
// speed/table_lookup.ts, reasoning/pseudocode_trace.ts) embeds fenced code
// blocks (```...```) and markdown-style pipe tables directly inside
// `content.prompt`/`content.ticket` strings — there is no separate
// "artifact" for a query or a lookup table in those templates, and no
// documented client rendering contract for it either (found by actually
// running a session against local Postgres: a table_lookup/sql_outcome
// item rendered as literal `| a | b |` text otherwise). This is a small,
// dependency-free renderer (matching ARCHITECTURE.md §7's "no runtime
// markdown library" rule, same reasoning as `renderJobDescriptionHtml` in
// src/db/queries/jobs.ts) for exactly the two constructs the bank actually
// uses: fenced code blocks and pipe tables. Plain paragraphs pass through
// with line breaks preserved and `**bold**` support (used by a couple of
// templates for the same reasons the worked examples in ASSESSMENT_DESIGN.md
// bold key terms).

function renderInline(text: string, keyPrefix: string) {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={`${keyPrefix}-${i}`}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith("`") && part.endsWith("`") && part.length >= 2) {
      return (
        <code key={`${keyPrefix}-${i}`} dir="ltr" className="inline-code">
          {part.slice(1, -1)}
        </code>
      );
    }
    return <Fragment key={`${keyPrefix}-${i}`}>{part}</Fragment>;
  });
}

/** Shared inline renderer (`**bold**` / `` `code` ``) for anywhere item content shows short runs of text outside a prompt paragraph — e.g. choice-option labels in item-views.tsx. */
export function InlineText({ text, keyPrefix }: { text: string; keyPrefix: string }) {
  return <>{renderInline(text, keyPrefix)}</>;
}

function isPipeTableBlock(lines: string[]): boolean {
  return lines.length >= 2 && lines.every((l) => l.trim().startsWith("|")) && /^\|[\s:|-]+\|$/.test(lines[1]!.trim());
}

function parsePipeRow(line: string): string[] {
  const trimmed = line.trim().replace(/^\|/, "").replace(/\|$/, "");
  return trimmed.split("|").map((c) => c.trim());
}

/** Hebrew block range (U+0590-U+05FF) — same test used by ASSESSMENT_DESIGN.md's other script-detection spots. */
const HEBREW_RE = /[֐-׿]/;

function renderTable(lines: string[], key: string) {
  const header = parsePipeRow(lines[0]!);
  const bodyRows = lines.slice(2).map(parsePipeRow);
  // A6/A8: direction follows the header row's script, not a hardcoded
  // "ltr" — a Hebrew-headed table (עיר/סטטוס, קלט/פלט, ...) must read
  // right-to-left or its columns show up reversed for a Hebrew reader.
  const rtl = HEBREW_RE.test(header.join(""));
  // FINTECH_REDESIGN_PLAN.md §1.6: 14/22, header row bg --canvas 600, cell
  // padding 8 12, borders --line, radius 10 on the wrapper with
  // overflow: hidden, tabular numerals.
  return (
    <div key={key} dir={rtl ? "rtl" : "ltr"} className="tnum my-3 overflow-x-auto rounded-10 border border-line">
      <table className="min-w-full border-collapse text-start text-[14px] leading-[22px]">
        <thead>
          <tr>
            {header.map((h, i) => (
              <th key={i} className="border-b border-line bg-canvas px-3 py-2 font-semibold text-text">
                <span className="cell">
                  <InlineText text={h} keyPrefix={`${key}-h${i}`} />
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {bodyRows.map((row, ri) => (
            <tr key={ri}>
              {row.map((cell, ci) => (
                <td key={ci} className="border-b border-line px-3 py-2 text-text">
                  <span className="cell">
                    <InlineText text={cell} keyPrefix={`${key}-c${ri}-${ci}`} />
                  </span>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function renderTextBlock(block: string, keyPrefix: string) {
  // A text segment (outside fenced code) may still contain a pipe table
  // amid plain paragraphs — split it into paragraph vs. table runs.
  const lines = block.split("\n");
  const nodes: React.ReactNode[] = [];
  let buffer: string[] = [];
  let i = 0;

  function flushParagraph(key: string) {
    const text = buffer.join("\n").trim();
    buffer = [];
    if (text.length > 0) {
      nodes.push(
        <p key={key} className="whitespace-pre-wrap leading-[26px]">
          {renderInline(text, key)}
        </p>,
      );
    }
  }

  while (i < lines.length) {
    const rest = lines.slice(i);
    if (rest[0]?.trim().startsWith("|") && rest[1] && isPipeTableBlock([rest[0], rest[1]])) {
      flushParagraph(`${keyPrefix}-p${i}`);
      const tableLines: string[] = [];
      while (i < lines.length && lines[i]!.trim().startsWith("|")) {
        tableLines.push(lines[i]!);
        i++;
      }
      nodes.push(renderTable(tableLines, `${keyPrefix}-t${i}`));
      continue;
    }
    buffer.push(lines[i]!);
    i++;
  }
  flushParagraph(`${keyPrefix}-pend`);
  return nodes;
}

/** Renders an item's `prompt`/`ticket` text: fenced code blocks as monospace, pipe tables as real tables, everything else as paragraphs. */
export function ItemText({ text }: { text: string }) {
  const segments = text.split(/```(\w*)\n([\s\S]*?)```/g);
  // String.split with capturing groups yields [text, lang, code, text, lang, code, ..., text]
  const nodes: React.ReactNode[] = [];
  for (let i = 0; i < segments.length; i += 3) {
    const textPart = segments[i] ?? "";
    if (textPart.trim().length > 0 || textPart.includes("\n")) {
      nodes.push(...renderTextBlock(textPart, `s${i}`));
    }
    const code = segments[i + 2];
    if (code !== undefined) {
      // FINTECH_REDESIGN_PLAN.md §1.6: bg --ink-950, text #E8ECF6, radius
      // 10, padding 14 16, mono 14/22, dir="ltr" (unchanged), a 1px
      // --ink-800 border.
      nodes.push(
        <pre
          key={`code-${i}`}
          dir="ltr"
          className="my-3 select-none overflow-x-auto whitespace-pre-wrap break-words rounded-10 border border-ink-800 bg-ink-950 px-4 py-3.5 text-start font-mono text-[14px] leading-[22px] text-[#E8ECF6]"
        >
          {code.replace(/\n$/, "")}
        </pre>,
      );
    }
  }
  return <div data-testid="item-text">{nodes}</div>;
}
