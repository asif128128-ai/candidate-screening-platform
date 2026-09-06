# FINTECH REDESIGN PLAN — client feedback round 1

Status: **Decided.** Author: Fable (product/system architect). Audience: the lead engineer implementing this. Every choice below is final; where the client's wording was ambiguous the decision is recorded here with its reason. Read `docs/DESIGN_SUMMARY.md` and `docs/CANDIDATE_FLOW.md` first if you have not.

Scope: candidate-facing product first (`src/app/(candidate)/**`), email templates, and the assessment content bank. Admin gets the design tokens only (§1.9) — it is internal and not the hiring brand.

Three hard constraints that do **not** change:

1. **Scoring is untouched.** `src/assessment/scoring.ts`, `docs/SCORING.md` §3.6 and the 10,000-trial skip-dominates-guess property test stay exactly as they are. Request #3 is a disclosure change only.
2. **The resume code stays a real feature** (`DECISIONS_LOG.md` #2). It is re-framed and demoted, not removed.
3. **Server-authoritative timing, telemetry, and the item-token flow are untouched.** The runner redesign is presentational.

---

## 1. Visual design direction

### 1.1 The decision in one paragraph

One light theme, built on an ink-navy + electric-blue palette, with dark "ink" surfaces used deliberately for the three moments that should feel weighty (the terms card, the assessment top band, the block-intro screens). No OS dark mode at launch: the runner already carries meaning in color states (amber timer), the e2e suite screenshots RTL, and a second theme doubles the QA surface for zero hiring value. "High-tech" comes from contrast, typography discipline, generous whitespace, tabular numerals and precise component geometry — not from a dark background everywhere. The candidate flow should read like a premium Israeli fintech's onboarding: calm, confident, fast.

### 1.2 Color tokens (exact values; define once in `src/app/globals.css` under `:root`, expose through `tailwind.config.ts` `theme.extend.colors`)

```css
:root {
  /* Ink — dark surfaces and primary text */
  --ink-950: #070D1F;
  --ink-900: #0B1530;   /* terms card, runner top band, block intros */
  --ink-800: #131F45;   /* timer track on ink, hover on ink */
  --ink-200: #AAB4D1;   /* muted text ON ink */
  --ink-100: #E8ECF6;   /* option letter badge bg, chips */

  /* Brand — the one variable the client's real brand color replaces */
  --brand-700: #1F3AD6; /* primary hover, link text */
  --brand-600: #2B4DFF; /* primary buttons, focus border, selected state, timer fill on ink */
  --brand-400: #6B87FF; /* timer fill on ink band (healthy), decorative */
  --brand-100: #E6EBFF; /* focus ring, selected option bg */
  --brand-50:  #F2F5FF; /* subtle tinted surfaces */

  /* Semantic */
  --mint-600: #19C39A;  /* success icon/bar only — never body text */
  --mint-800: #0E7A61;  /* success text */
  --mint-300: #5EE2C1;  /* the rate figure on the ink terms card */
  --amber-500: #F5A524; /* timer last 10 s */
  --amber-800: #8A5A00; /* amber text */
  --amber-50:  #FFF7E6;
  --red-600:   #E5484D; /* errors */
  --red-50:    #FEF0F0;

  /* Neutrals */
  --canvas: #F6F7FB;    /* page background (body) */
  --surface: #FFFFFF;   /* cards */
  --line: #E3E7F0;      /* default borders */
  --line-strong: #C9D0DE; /* input borders, secondary button border */
  --text: #0F172A;      /* primary text */
  --text-2: #4B5675;    /* secondary text (7.3:1 on white) */
  --text-3: #6B7690;    /* meta/helper text (4.6:1 on white — AA; never below 13 px) */
}
```

Contrast is verified: `--brand-600` on white and white on `--brand-600` are 5.8:1; `--ink-900` on white 18:1; `--text-2` 7.3:1; `--text-3` 4.6:1. `--mint-600` and `--amber-500` are **not** text colors — use `--mint-800` / `--amber-800` for text.

Color is never the only carrier of meaning (existing rule, `ASSESSMENT_DESIGN.md` §5): the amber timer also bolds the digits; errors also have an icon and text; selected options also change border weight and the letter badge.

### 1.3 Typography

- **Heebo** stays as the single UI face (already self-hosted via `next/font` in `src/app/(candidate)/[locale]/layout.tsx`). Load weights `400, 500, 600, 700` explicitly (`weight: ["400","500","600","700"]`) — today the default subset ships less predictably.
- **JetBrains Mono** for code/logs. Fix the mono stack in `tailwind.config.ts` to `["var(--font-jetbrains-mono)", "JetBrains Mono", "var(--font-heebo)", "Heebo", "monospace"]` so Hebrew inside `<pre>` (artifact bodies contain Hebrew) falls back to Heebo, per `CANDIDATE_FLOW.md` §9.
- Type scale (size/line-height, px). Hebrew needs line-height ≥ 1.6 on body text.
  - Display (block-intro block name, done headline): 36/44, weight 700, letter-spacing −0.01em.
  - H1: 28/36 (mobile 24/32), 700.
  - H2: 20/28, 600.
  - Body: 16/26, 400. Body-strong 600.
  - Small: 14/22. Meta: 13/20 (`--text-3`).
  - Item prompt in the runner: 18/30, 500.
- Numerals: `font-variant-numeric: tabular-nums` on the timer, the progress label, the terms card figures, and any table. Add a utility class `.tnum`.
- Eyebrow labels (e.g. "שלב 1 מתוך 3", "החלק הבא"): 13/20, 600, `--text-3`, no uppercase (Hebrew has none — do not fake it with letter-spacing).

### 1.4 Layout and spacing

- Base unit 4 px. Vertical rhythm between sections 32 px; between form fields 20 px; inside cards 24 px (20 px under 480 px).
- Page shell (new `src/components/candidate-shell.tsx`, used by every candidate page):
  - Sticky header 56 px, `--surface`, 1 px `--line` bottom. Start side: `<BrandMark/>`. End side: on flow pages, the **Stepper** (§1.6). Under 640 px the stepper collapses to "שלב 2 מתוך 4".
  - Content column: `max-width` 560 px for forms (step 1, resume, privacy request), 720 px for reading pages (landing, step 2, briefing, done), 1040 px for the runner. Horizontal padding 24 px (16 px mobile).
  - Footer: single line, `--text-3`, "מדיניות פרטיות · {BRAND_NAME}".
- Brand: add `src/lib/brand.ts` exporting `BRAND_NAME = process.env.NEXT_PUBLIC_BRAND_NAME ?? "Careers"` and `src/components/brand-mark.tsx` that renders `public/brand/logo.svg` if present (inline `<img>` height 24) else a wordmark (Heebo 700, 18 px, `--ink-900`). **Ask the client for their logo as SVG and their brand hex; the hex replaces `--brand-600`/`--brand-700` only.** Metadata title becomes `${BRAND_NAME} · הגשת מועמדות`.
- `body`: `background: var(--canvas); color: var(--text)`.

### 1.5 Component specifications (build these as shared primitives in `src/components/ui/`, then replace ad-hoc Tailwind classes page by page)

**Button** (`button.tsx`) — height 48 px (40 px `size="sm"`), radius 12 px, padding 0 20 px, 16/24 weight 600, full width on mobile forms.
- `primary`: bg `--brand-600`, text white; hover `--brand-700`; active translateY(1px); disabled opacity .45 (not grayed text — keep the color so the "next step" is still legible).
- `secondary`: bg `--surface`, 1 px `--line-strong`, text `--ink-900`; hover bg `--canvas`.
- `ghost`: transparent, text `--text-2`, underline on hover — used for skip and "אין לכם את הקוד?".
- `onInk`: bg white, text `--ink-900` — used on block-intro screens.
- Focus (keyboard): `box-shadow: 0 0 0 3px var(--brand-100), 0 0 0 1px var(--brand-600)`. Every interactive element gets this ring; no `outline: none` without it.
- Pending state: label swaps to the existing "…" copy and a 16 px spinner at the start side.

**Input / Select** (`field.tsx`) — height 48 px, radius 10 px, 1 px `--line-strong`, bg white, 16 px text, padding 0 14 px. Label above: 14/22, 500, `--text-2`. Helper below: 13/20, `--text-3`. Focus: border `--brand-600` + ring `--brand-100` 3 px. Error: border `--red-600`, helper turns `--red-600` with a leading "!" icon. LTR fields (`phone`, `email`, URLs, dates) keep `dir="ltr"` and `text-align: start` exactly as today. Native `<select>` gets a custom chevron (SVG data URI, start-side aware via logical `padding-inline-end`).

**Checkbox** (`checkbox.tsx`) — custom 20 px box, radius 6, 1.5 px `--line-strong`; checked bg `--brand-600` with white check; label 15/24. Used for the three job confirmations, the privacy consent, and the monitoring consent.

**Card** (`card.tsx`) — bg `--surface`, radius 16 px, 1 px `--line`, shadow `0 1px 2px rgba(11,21,48,.04), 0 8px 24px rgba(11,21,48,.06)`, padding 24 px.

**InkCard / Terms card** (`terms-card.tsx`, replaces the two duplicated `<section data-testid="terms-card">` blocks in `jobs/[slug]/page.tsx` and `apply/[applicationId]/job/page.tsx`) — bg `--ink-900`, radius 16, padding 24, white text. Layout: a two-column key/value grid (`grid-template-columns: 1fr 1fr`, single column under 480 px). Keys 13/20 `--ink-200`; values 16/24 600 white. The **rate** is the hero: value rendered 32/40 700 in `--mint-300` as `<Term>85 ₪</Term>` followed by "לשעה" in 14 px `--ink-200`. Card title "תנאי ההתקשרות" (replaces "כרטיס תנאים", which is internal jargon) 13/20 `--ink-200`. Keep `data-testid="terms-card"` and `aria-label`.

**Callout** (`callout.tsx`) — radius 12, padding 14 16, 14/22, icon at start. Variants: `info` (bg `--brand-50`, border 1 px `--brand-100`, icon `--brand-600`), `warning` (`--amber-50` / `--amber-800`), `error` (`--red-50` / `--red-600`), `success` (bg `#EAFBF5`, text `--mint-800`). Replaces every `bg-red-50`/`bg-amber-50`/`bg-blue-50` paragraph in the candidate pages.

**Stepper** (`stepper.tsx`) — four steps: `פרטים · התפקיד · לפני המבחן · המבחן`. Each: 8 px dot + label 13/20. Done steps: dot `--mint-600`, label `--text-2`; current: dot `--brand-600` with 4 px `--brand-100` halo, label `--ink-900` 600; upcoming: dot `--line-strong`, label `--text-3`. Connectors 1 px `--line` between dots. RTL order falls out of flex with logical properties. Rendered in the shell header on: step 1 (current=1), step-1 success panel (current=1, "done" badge on it), step 2 (2), briefing (3), runner + block intros (4, and the runner replaces the stepper with its own progress label — see TimerBand), done (all four done).

**Chip** (`chip.tsx`) — height 28, radius 999, 13/20 600, bg `--ink-100`, text `--ink-900`. On ink: bg `--ink-800`, text white. Used for "10 שאלות · 20 שניות לשאלה", "לא מתוזמן · לא נספר", "PDF או DOCX · עד 5MB".

**OptionButton** (`option-button.tsx`, used by `item-views.tsx` for single/multi choice and investigation q1/q2) — full width, radius 12, 1 px `--line`, bg `--surface`, padding 14 16, gap 12, text 16/26 `--text`. Letter badge at start: 28 px circle, bg `--ink-100`, 14 px 600 `--ink-900`, `tnum`. Hover: bg `--canvas`. Selected: `box-shadow: inset 0 0 0 2px var(--brand-600)` (no layout shift), bg `--brand-50`, badge bg `--brand-600` white. Multi-choice uses a square badge (radius 6) so the affordance differs from single-choice. Investigation options use the same component with `size="sm"` (padding 10 12, 15/24).

**Resume code row** (`resume-code-row.tsx`) — a quiet utility row, not a hero: bg `--canvas`, radius 10, padding 12 14, 1 px `--line`. Start: label "קוד חזרה" 13/20 `--text-3` above the code in JetBrains Mono 18/24 600 `--ink-900` inside `<Term>`. End: `secondary` `size="sm"` button "העתקה" that swaps to "הועתק ✓" for 2 s. Helper line under the row 13/20 `--text-3`. Keep `data-testid="resume-code"` on the code element and `data-testid="resume-code-card"` on the surrounding panel (the e2e suite depends on both).

### 1.6 Assessment runner (the screen a strong student judges us by)

Replace `runner.tsx`'s header + `timer-bar.tsx` with a single **TimerBand** component:
- Sticky top band, bg `--ink-900`, height 64 px, full width of the viewport (the runner content column sits under it). Start: block name 14/20 600 `--ink-200` + "שאלה 4 מתוך 27" 16/24 600 white `tnum` (keep `data-testid="progress-label"`). End: `mm:ss` 24/32 700 white `tnum` inside `<Term>` (keep `data-testid="timer-text"`). Under the band, flush: a 6 px track bg `--ink-800` with the remaining-time fill in `--brand-400`, `transition: width 200ms linear` (keep `data-testid="timer-bar"` and `data-timer-state`).
- Amber state (last 10 s, unchanged logic in `assessment-runner-logic.ts`): fill and digits turn `--amber-500`, digits stay 700; the band itself does not flash. No pulsing animation — it is a distraction during a timed item.
- Item pane: a `Card` (radius 16, padding 32; 24 under 1024 px) with the prompt at 18/30 500, artifacts as inner blocks (bg `--canvas`, radius 10, 1 px `--line`, label 12/16 600 `--text-3`, body mono 14/22), options below with 8 px gaps.
- Code blocks (`item-text.tsx` `<pre>`): bg `--ink-950`, text `#E8ECF6`, radius 10, padding 14 16, mono 14/22, `dir="ltr"` (unchanged), a 1 px `--ink-800` border.
- Tables (`item-text.tsx` `renderTable`): 14/22, header row bg `--canvas` 600, cell padding 8 12, borders `--line`, radius 10 on the wrapper with `overflow: hidden`, `tnum`. Direction rule in §4 A8.
- Bottom action bar: sticky at the viewport bottom on ≥ 900 px is unnecessary — items fit; keep it in flow, `margin-top: 32px`, `justify-content: space-between`. **Primary** at the end side: "שליחת תשובה" (`primary`, min-width 160). **Skip** at the start side as `ghost`: "דילוג על השאלה" → on first click the same button reads "לדלג בלי לענות?" with a `secondary` look for 4 s, then reverts (keep the two-click behavior; keep `data-testid="skip-button"` and `submit-button`). The visual weight difference is deliberate — see §3.
- Notices (`outage-notice`, `retry-notice`) become `Callout info` / `Callout warning` directly under the band.
- Investigation layout (`InvestigationView`): two `Card`s in a 5/7 grid (answers 5, artifacts 7) on ≥ 1024 px; stacked under. Tabs: underline style (2 px `--brand-600` under the active tab, 15/24 600; inactive `--text-2`), tab list has a 1 px `--line` bottom; artifact body block as above with a min-height 220 px so switching tabs does not jump. The ticket sits above the answers as a `Callout info` with the "כרטיס תמיכה" label as its eyebrow. Sub-questions get eyebrow numerals "1", "2", "3" in 12 px chips instead of "1." text.
- Loading/error: centered `Card` with a 20 px spinner and the existing copy (with the wording fixes in §4 B12).

**Block intro** (`block-intro.tsx`): full-viewport `--ink-900` background. Center column 560 px. Eyebrow "החלק הבא" 14/20 `--ink-200`; block name Display 36/44 white; a row of two chips (on-ink) e.g. "10 שאלות" · "20 שניות לשאלה"; rule text 16/26 `--ink-200`; "איך זה עובד" as a `ghost` on-ink disclosure (chevron) revealing `howItWorksHe`; CTA `onInk` full width "מתחילים"; auto-advance line 13/20 `--ink-200` "ממשיכים אוטומטית בעוד 45 שניות" `tnum`. Keep all `data-testid`s.

**Practice scene**: same runner chrome but the band is `--ink-800` with a chip "תרגול · לא מתוזמן · לא נספר" instead of a timer, so the candidate visibly knows the clock is not running.

### 1.7 Key screens, described

- **Landing `/jobs/{slug}`**: shell header (no stepper). H1 title 28/36; summary 18/28 `--text-2`. **Terms InkCard** immediately under it (unchanged rule: terms before any form). Then a `Card` "מה התפקיד באמת" with the 50/50 line. Then a `Card` "איך התהליך עובד" as a 3-row numbered list (טופס קצר → התפקיד → מבחן מקוון, with durations as chips) and the copy from §2.4. Primary CTA full width "להגשת מועמדות" (keep `data-testid="cta-apply"`). Privacy link in the footer.
- **Step 1 `/jobs/{slug}/apply`**: stepper current=1. H1 "פרטים אישיים"; eyebrow under it "כ-3 דקות · נשמר אוטומטית בדפדפן". Fields in one column inside one `Card`, grouped with 13 px group labels: "מי את/ה" (names, DOB, phone, email), "לימודים" (institution, program, year, average), "זמינות" (Rishon radio as two `secondary`-style segmented buttons), "אופציונלי" (LinkedIn, GitHub, CV dropzone: dashed 1.5 px `--line-strong`, radius 12, 24 px padding, icon, "גררו קובץ או לחצו לבחירה" + chip "PDF או DOCX · עד 5MB"; states: uploading (progress bar `--brand-600`), done (`Callout success` "הקובץ הועלה"), error (`Callout error` with the existing copy)). Consent checkbox; primary CTA per §2.3.
- **Step-1 success panel**: see §2.3 — a `Card` with a stepper showing step 1 done, a headline about the *next* step, primary CTA, and the demoted resume-code row.
- **Step 2 `/apply/{id}/job`**: stepper current=2. Title; description in a `Card` with `prose` styling mapped to the tokens (`--text`, headings 600, lists with 8 px gaps); Terms InkCard; confirmations in a `Card` with three custom checkboxes; primary CTA "הבנתי, ממשיכים".
- **Step 3 briefing**: stepper current=3. Three short `Card`s ("מה זה", "הכללים", "מה לצפות") — the rules as a checklist with 16 px icons; the monitoring disclosure as a `Card` with a `Callout info` framing "שקיפות" and the consent checkbox; device check as a compact status row (✓ מסך רחב · ✓ מסך מלא זמין) using `--mint-800` / `--amber-800`; primary CTA "מתחילים".
- **Done**: stepper all done. Centered `Card`: 56 px `--mint-600` check-circle icon; H1 per §2.6; the response-date promise in 18/28 with the date in `<Term>` and 600; privacy link.
- **Resume `/resume`**: shell, `Card` 560, H1 "חזרה לתהליך", the two inputs, primary "כניסה", `ghost` "אין לכם את הקוד? קבלו קוד למייל".

### 1.8 Motion and responsiveness

- Hover/focus transitions 150 ms ease-out; timer width 200 ms linear (existing). Page transitions: none. Respect `@media (prefers-reduced-motion: reduce)` by disabling all transitions except the timer width.
- Breakpoints: 480 (single-column terms grid), 640 (stepper collapses), 900 (runner minimum — enforced by the briefing device check as today), 1024 (investigation two-pane).

### 1.9 Admin (phase 3, tokens only)

`src/app/admin/layout.tsx` adopts `--canvas`/`--text`, the Button/Input primitives, and the header style. No layout changes. Do this last; it is not part of the client's ask.

---

## 2. Request #2 — "מועמדותך התקבלה" only after the test

### 2.1 What the client is actually asking for

Not "delete the resume code" — "stop telling candidates they are done before the test". The flow must feel like one continuous process whose only finish line is the assessment. Every "received / accepted / we'll get back to you" signal moves to the done page, and everything before it talks about the *next* step.

### 2.2 Inventory — every place the early "done" framing exists today

| # | File : line | Current | Problem |
|---|---|---|---|
| 1 | `src/app/(candidate)/[locale]/jobs/[slug]/apply/personal-details-form.tsx:183` | `<h2>המועמדות התקבלה!</h2>` | The literal string the client saw |
| 2 | same file `:198` | "נחזור אליך עד {date}, בכל מקרה." | A closure promise before the test — reads as "you can leave now" |
| 3 | same file `:84` | submit button "שליחת מועמדות" | "Submit application" implies the form *is* the application |
| 4 | same file `:207` | CTA "המשך לשלב הבא" | Generic; does not name the destination |
| 5 | `src/lib/email/templates.ts:56-71` `renderApplicationReceived` | subject "קיבלנו את המועמדות שלך — {job}", body "נחזור אליך עד {date}, בכל מקרה." | Sent right after step 1 (`src/db/queries/application-flow.ts:209`). An email titled "we received your application" with a reply-by date is the strongest "you're done" signal in the whole funnel |
| 6 | `src/app/(candidate)/[locale]/jobs/[slug]/page.tsx:63-64` | "אפשר לעצור אחרי הטופס ולחזור למבחן מאוחר יותר עם קוד החזרה שתקבלו." | Actively invites pausing after the form |
| 7 | `src/app/(candidate)/[locale]/apply/[applicationId]/done/page.tsx:40-41` | "תודה, {name}! המבחן נשמר." | The one place that *should* say "received" — and doesn't |
| 8 | `docs/CANDIDATE_FLOW.md` §1.1, §2.3, §2.4, §6; `docs/DESIGN_SUMMARY.md` §3 step 1 | "Success screen shows a resume code", "קיבלנו את המועמדות שלך" email | Docs must follow |

Checked and fine as-is: step 2 (`job/page.tsx`, `confirmations-form.tsx`), briefing, block intros, the `already_completed` / `redirect_to_resume` branches, `/resume`, the privacy form ("הבקשה התקבלה" refers to a privacy request, not the application).

### 2.3 Fix — step-1 success panel (`personal-details-form.tsx`, `created` branch)

Keep the in-place render (the plaintext code exists only in this one response; a redirect would lose it). Keep `data-testid="resume-code-card"`, `resume-code`, `continue-to-step2`. Replace the content and hierarchy entirely:

```
[Stepper: step 1 done, step 2 current]

eyebrow:   שלב 1 מתוך 3 הושלם
H2:        הפרטים נשמרו. השלב הבא: התפקיד והמבחן.
body:      המועמדות נבחנת רק אחרי השלמת המבחן המקוון (כ-30 דקות, במחשב).
           מומלץ להמשיך עכשיו ברצף — זה החלק שבאמת חשוב לנו.
[primary CTA, full width]  ממשיכים לתיאור התפקיד        (href /apply/{id}/job, data-testid continue-to-step2)

[ResumeCodeRow — quiet, below the CTA]
label:     קוד חזרה                 code: K7M4-Q2XP   [העתקה]
helper:    אם תצטרכו לעצור באמצע, האימייל והקוד הזה מחזירים אתכם לאותה נקודה ב-/resume. שלחנו אותו גם למייל.

[only if CV failed — Callout warning, unchanged text]
           קובץ קורות החיים לא צורף בהצלחה. אפשר להמשיך בלעדיו.
```

Remove the response-date line from this panel entirely (`o.responseByDateHe` stays in the action state type; simply unused here — do not touch `actions.ts`).

Submit button (`:84`): `שליחת מועמדות` → **`שמירה והמשך`** (pending: `שומר…`).

### 2.4 Fix — landing process outline (`jobs/[slug]/page.tsx:59-66`)

Replace the paragraph with a three-row list (see §1.7) and this copy:

```
H2: איך התהליך עובד
1. טופס קצר — כ-3 דקות
2. תיאור התפקיד ואישור התנאים — כ-2 דקות
3. מבחן מקוון — כ-30 דקות, במחשב (לא בטלפון)
line under the list:
   כדאי לעבור את כל התהליך ברצף אחד מהמחשב — כ-35 דקות. אם בכל זאת תצטרכו לעצור, תקבלו קוד חזרה שמאפשר להמשיך מאותה נקודה.
```

Keep `data-testid="process-outline"` on the wrapper and keep the bold "את המבחן עושים במחשב" concept (row 3 carries it).

### 2.5 Fix — the step-1 email (`src/lib/email/templates.ts` `renderApplicationReceived`)

Keep the template key `application_received` (`email_outbox.template` is plain `text`, no constraint; renaming buys nothing and touches `application-flow.ts`). Change the content only; stop rendering `responseByDateHe`:

```
subject: השלב הבא במועמדות שלך — המבחן המקוון ({jobTitle})

שלום {firstName},
הפרטים שלך נשמרו למשרה "{jobTitle}".
כדי שהמועמדות תיבחן, נשאר להשלים את המבחן המקוון — כ-30 דקות, במחשב. מומלץ לעשות את זה בהקדם, ברצף אחד.

[button] להמשך המבחן   → {resumeUrl}

קוד החזרה שלך: {resumeCodeDisplay}
שמרו את הקוד — יחד עם האימייל שלכם הוא מאפשר לחזור לתהליך מכל מחשב.

text version:
שלום {firstName},
הפרטים שלך נשמרו למשרה "{jobTitle}". כדי שהמועמדות תיבחן, נשאר להשלים את המבחן המקוון (כ-30 דקות, במחשב).
להמשך: {resumeUrl}
קוד החזרה: {resumeCodeDisplay}
```

Restyle `wrap()` with the tokens: container 520 px, `--surface` on `--canvas`, a 4 px `--brand-600` top border, Heebo/Arial, the button as a table-cell link with bg `#2B4DFF`, white text, radius 10, padding 12 20. Apply the same wrapper to `renderResumeOtp` and `renderNotMovingForward` (their copy is unchanged).

### 2.6 Fix — done page becomes the only "received" moment (`done/page.tsx`)

```
completed:
  H1:   המועמדות שלך התקבלה
  sub:  תודה, {firstName}. המבחן הושלם ונשמר — זה כל מה שנדרש מצידך.
abandoned:
  H1:   המבחן נסגר
  sub:  חלף זמן המקסימום למבחן. מה שנענה נשמר, והמועמדות שלך התקבלה.
both:
  p:    נחזור אליך עד {date} במייל או בטלפון, בכל מקרה — גם אם לא נמשיך יחד הפעם.
  meta: אם עבר התאריך ולא שמעת מאיתנו, אפשר לכתוב אלינו (פרטי הקשר בעמוד מדיניות הפרטיות).
  link: מדיניות הפרטיות
```

**Test update:** `tests/e2e/assessment-runner.spec.ts:246` asserts `"המבחן נשמר"` → change to `"המועמדות שלך התקבלה"`.

### 2.7 Optional (P3, not requested): completion email

A fifth template `assessment_completed` ("המבחן הושלם — נחזור אליך עד {date}") enqueued when the session completes, would move the reply-by promise into the candidate's inbox where it belongs. No migration needed (free-text template column); needs an enqueue in the answer route's completion branch plus a renderer. Ship only after §2.3–2.6 are live; it is a nice-to-have.

### 2.8 Docs to update in the same PR

`CANDIDATE_FLOW.md` §1.1 (process copy), §2.3 (email subject/body), §2.4 (the resume-code card is now a demoted row on a "next step" panel; quote §2.3 copy), §6 item 1 (done copy); `DESIGN_SUMMARY.md` §3 step 1 ("Success screen shows a resume code" → "The success panel points at the next step; the resume code is shown quietly; 'application received' appears only on the done page"); add **DECISIONS_LOG.md #20** "Early 'application received' framing removed (client feedback)" listing the eight touchpoints above.

---

## 3. Request #3 — stop disclosing "skipping is never worse than guessing"

### 3.1 Decision

Remove the disclosure. Replace it with neutral encouragement to attempt an answer that reveals **nothing** about the mechanic in either direction. We must not imply that skipping is penalized harder (it is not, and in the speed block a wrong answer is in fact −0.5 vs. skip 0 — so we also must not claim guessing beats skipping). "Try to answer" is honest under every block's rules: an *attempted* answer with partial knowledge beats a skip, and the item design guarantees everything needed is in the item.

The scoring invariant (`SCORING.md` §3.6, `scoring.ts`, the property test) is unchanged and remains an internal fairness guarantee.

### 3.2 Exact changes

| File : line | Current | New |
|---|---|---|
| `src/app/(candidate)/[locale]/apply/[applicationId]/briefing/page.tsx:48` | `<li>אפשר לדלג (דילוג אף פעם לא גרוע מניחוש)</li>` | `<li>אפשר לדלג על שאלה, אבל מומלץ תמיד לנסות לענות — כל מה שנדרש נמצא בשאלה עצמה</li>` |
| `src/app/(candidate)/[locale]/apply/[applicationId]/assessment/runner.tsx:427` | `{skipConfirm ? "לאשר דילוג?" : "דלג/י"}` | `{skipConfirm ? "לדלג בלי לענות?" : "דילוג על השאלה"}` — rendered as the `ghost` button (§1.6), the primary stays "שליחת תשובה" (`:436`, was "שלח/י") |
| `docs/CANDIDATE_FLOW.md:103` | "אפשר לדלג (דילוג אף פעם לא גרוע מניחוש)" | the new sentence above |
| `docs/DESIGN_SUMMARY.md:26` | "skip allowed (skip is never worse than a guess)" | "skip allowed (the skip-never-worse-than-guess invariant holds in scoring but is not disclosed to candidates — DECISIONS_LOG #21)" |
| `docs/DECISIONS_LOG.md` #10 | ends "Briefing copy tells candidates so." | append "**Superseded for disclosure only by #21:** the invariant stays; the briefing no longer states it." Add **#21** with the reasoning in §3.1 |

The two-click skip confirmation stays (it is honest friction, and it already exists). Nothing in `consent-text.ts`, the block intros, or `assessment-block-copy.ts` mentions the mechanic — verified.

---

## 4. Hebrew content audit — findings and fixes

Audited: every candidate page component, `assessment-block-copy.ts`, `consent-text.ts`, email templates, and all 52 template families in `src/assessment/bank/**` (14 speed, 12 reasoning, 14 tech, 12 investigation scenarios). Severity **A** = renders wrong or is unanswerable/ambiguous; **B** = unprofessional or awkward for a fintech hiring process; **C** = polish.

Process note for every bank change: bump the template's `version` (`1 → 2`) so `assessment_items.template_version` separates old and new wording in admin analytics, then run `pnpm test -- -u` and review the `tests/unit/assessment/__snapshots__/bank.test.ts.snap` diff line by line — the snapshot is expected to change only in the strings listed here.

### A — must fix (rendering / correctness)

**A1. `reasoning.grid_pattern` is unanswerable as rendered.** `src/assessment/bank/reasoning/grid_pattern.ts` puts raw `<svg …>` strings in `content.options` and a `[תא] [תא] [?]` text placeholder in the prompt. `item-views.tsx` renders options as `{opt}` (React escapes → candidates see literal `<svg viewBox=…` markup) and nothing renders the grid. Fix:
- `src/assessment/types.ts`: add to `ChoiceContent` two optional fields: `figureSvg?: string` (a single composed SVG of the 3×3 grid, the missing cell drawn as a dashed square with a "?" `<text>` element) and `optionsFormat?: "text" | "svg"`.
- `grid_pattern.ts`: compose the grid into `figureSvg` (3×3 `<g>` translated cells, 72 px each, 8 px gaps, `viewBox="0 0 232 232"`), set `optionsFormat: "svg"`, delete `gridText` and the "מבנה הרשת (...)" line. Prompt becomes the rule sentence + "התא הימני-תחתון חסר." + instruction. Because the grid is rendered `dir="ltr"`, "ימני-תחתון" is visually correct.
- `item-views.tsx`: when `content.figureSvg` exists render `<div dir="ltr" className="figure" dangerouslySetInnerHTML={{__html: content.figureSvg}} />` (safe: generated by our own code, never from user input; add a comment saying so). When `optionsFormat === "svg"` render each option as a 96 px square tile grid (`grid-template-columns: repeat(auto-fill, 112px)`) with the letter badge under the tile and the same selected styling. Keep `data-testid="option-{i}"`.
- Add a unit test asserting every generated `grid_pattern` item has `figureSvg` starting with `<svg` and options all starting with `<svg`.

**A2. Inline backticks render as literal characters.** `item-text.tsx` `renderInline` handles `**bold**` only. Templates using `` `code` `` inline: `speed.path_resolve`, `speed.regex_match`, `speed.bool_logic`, `speed.count_matches`, `speed.bracket_balance`, `reasoning.state_machine`, `reasoning.rule_induction` (inside table cells), `tech.env_diff_bug`, `tech.data_normalize`. Fix: in `renderInline` split on `/(\*\*[^*]+\*\*|`[^`]+`)/g` and render backtick spans as `<code dir="ltr" className="inline-code">` (bg `--ink-100`, radius 4, padding 1 5, mono 0.92em, `unicode-bidi: isolate`). Apply `renderInline` to table cells in `renderTable` and to option text in `item-views.tsx` (wrap `{opt}` in a shared `<InlineText text={opt}/>` exported from `item-text.tsx`).

**A3. `speed.timezone_shift` states the offset backwards.** `timezone_shift.ts:27` "ישראל מוקדמת יותר" — Israel is *ahead* of UTC; "מוקדמת" reads as "earlier" and contradicts the correct answer. New prompt:
```
בתקופה הנוכחית השעה בישראל מאוחרת ב-{offset} שעות משעון UTC.
כשהשעה ב-UTC היא {hh:mm}, מה השעה בישראל?
```
and `conventionsStated` (both the static string and the per-instance override) → `השעה בישראל מאוחרת ב-{offset} שעות משעון UTC`.

**A4. `reasoning.constraints_seating` is ambiguous in RTL.** The prompt says seats run "משמאל לימין" and the clue is "X יושב/ת מיד משמאל לY", but options render as `דנה · יוסי · מאיה` in an RTL paragraph, so the first-read name is the *rightmost*. A Hebrew reader cannot tell whether דנה is seat 1. Fix: make the puzzle right-to-left, which matches how the option reads: prompt `… יושבים בשורה של {n} מקומות, מימין לשמאל (מקום 1 הוא הימני ביותר). ידוע:`; adjacency clue text → `${x} יושב/ת מיד מימין ל${y}` (semantics unchanged: x at index i, y at i+1); "לפני" clue → `${x} יושב/ת ימינה מ${y} (לא בהכרח צמוד/ה)`; option format → `1 ${a} · 2 ${b} · 3 ${c} …` (seat numbers inline, `tnum`), which is unambiguous in either direction. Keep everything else.

**A5. Practice scene leaks internal vocabulary.** `practice-scene.tsx:25` tab label `"הערות פריסה (decoy)"` → `"הערות פריסה"`. Also (B15) hide q2/q3 in practice: in `InvestigationView`, when `scored === false` render q1 only and drop the `"לא רלוונטי בתרגול"` / `"—"` placeholders; `PRACTICE_CONTENT.q2/q3` can stay as data.

**A6. `investigate.sso_login_subset` uses the wrong word four times.** "משתמשים חוסמים" / "העובדים החוסמים" (= "blocking") → "משתמשים חסומים" / "העובדים החסומים" (= "blocked"). Lines 19, 57 (`buildA`), 77, 116 (`buildB`), 135 (`buildC` tab label). Also `buildB` mapping tab body "הקבוצה ${groupNew} שונתה השם שלה" → "שם הקבוצה ${groupOld} שונה ל-${groupNew} ביום שני, אבל המיפוי לא עודכן".

**A7. Free-text inputs force LTR on Hebrew answers.** `item-views.tsx` `ShortTextView` (`:205`) and the investigation `q3` input (`:373`) are `dir="ltr"`, but expected answers include Hebrew: `reasoning.cipher_rule` (Hebrew words), `sso_login_subset` ("3 חודשים", "אירוע אבטחה"), `duplicate_submissions` ("מנוי #2"). The caret and punctuation misbehave. Fix: `dir="auto"` with `text-align: start` on both inputs (numeric input stays `ltr`).

**A8. Tables with Hebrew headers are laid out LTR.** `item-text.tsx` `renderTable` hard-codes `dir="ltr"`, so `speed.table_lookup` (`עיר`/`סטטוס`), `reasoning.table_must_be_true`, `reasoning.rule_induction` (`קלט`/`פלט`), `tech.minimal_access` (`תפקיד`), `tech.cloud_waste`, `tech.field_mapping_error` (`שדה מקור`) show columns in reverse for a Hebrew reader while `tech.sql_outcome` (English headers) is correct. Fix: `const rtl = /[\\u0590-\\u05FF]/.test(header.join(""))` → `dir={rtl ? "rtl" : "ltr"}`; cells containing only Latin/digits still isolate correctly because `<td>` content with `unicode-bidi: isolate` is applied via a `.cell` class.

### B — should fix (professional Hebrew)

**B1. `reasoning.set_counts`** — "כמה {noun} אינם לא זה ולא זה (neither)?" is not Hebrew. d1: `כמה {noun} אינם שייכים לאף אחת משתי הקטגוריות?`; d3: `… ו-{neither} אינם שייכים לאף אחת משתי הקטגוריות. כמה {noun} הם גם "{catA}" וגם "{catB}"?`. Also "ומתוכם {both} הם גם וגם" → `ו-{both} הם גם "{catA}" וגם "{catB}"` (state both names — "גם וגם" alone is slang).

**B2. `reasoning.analogy_structural`** — "X שייך ל-Y באותו יחס ש-Z שייך ל-?" is stilted. Use the standard Israeli psychometric format:
```
{exA} : {exB}
{tgA} : ?

איזו מילה משלימה את הזוג השני כך שהיחס בין המילים זהה ליחס בזוג הראשון?
```
(C1) replace the weak pair `["תרשים", "מוצר מוגמר"]` with `["שרטוט", "בניין"]`.

**B3. `reasoning.table_must_be_true`** — "איזה מהמשפטים הבאים חייב להיות נכון (must be true) לפי הטבלה בפועל?" → `איזה מהמשפטים הבאים נכון לפי הטבלה?` (only one is true by construction; the English gloss adds nothing). Header "שעות פתיחה" → "שעות מאז הפתיחה". Statement text "יש בדיוק {k} כרטיסים שעונים על: {desc}." → `בדיוק {k} כרטיסים מקיימים: {desc}`.

**B4. `reasoning.state_machine`** — put the transition list inside a fenced code block (it is LTR data) and rewrite the sentence:
```
לפניכם דיאגרמת מצבים של משימה (חץ = אירוע):
```
{transitions}
```
כל אירוע שאינו מצויר מהמצב הנוכחי — מתעלמים ממנו.

המשימה מתחילה במצב `Open`. האירועים הבאים מתרחשים לפי הסדר: {events}.
באיזה מצב המשימה בסוף?
```
Update `conventionsStated` to the exact new sentence `כל אירוע שאינו מצויר מהמצב הנוכחי — מתעלמים ממנו` (the bank audit checks verbatim inclusion).

**B5. `tech.minimal_access`** (three prompts) — `איזה תפקיד הכי "קטן" (עם הכי מעט הרשאות) שעדיין מספיק כדי לבצע את המשימה?` → `מהו התפקיד המצומצם ביותר (עם הכי פחות הרשאות) שעדיין מספיק לביצוע המשימה?`

**B6. `tech.log_root_cause`** — "מאגר חיבורי הדאטהבייס (connection pool)" → `מאגר החיבורים למסד הנתונים (connection pool)`; every "שיעור הפגיעה במטמון (cache hit rate)" → `יחס ה-cache hit במטמון` (three wrong options).

**B7. `tech.data_normalize`** — `title` values "טור …" → "עמודת …" (×4) and the prompt `${c.title} מגיע ממקורות שונים` → `${c.title} מגיעה ממקורות שונים בפורמטים לא אחידים:`.

**B8. `tech.env_diff_bug`** — "או שהחומה (firewall) לא פותחת אותו" → `או שחומת האש (firewall) לא פותחת אותו`.

**B9. `tech.git_what_happened`** `CASES_MODERATE` wrong option — "כי הן מעולם לא נדחפו" → "כי הם מעולם לא נדחפו".

**B10. `tech.site_down_first_check`** `CASES_EASY[0]` wrong option — "כדי שיבדקו את זמינות השרת מול המפקח" → `כדי שיבדקו את זמינות השרת`.

**B11. `speed.percent_change`** — "מ-{from} ל-{to}, זה שינוי של כמה אחוזים?" → `מהו השינוי באחוזים מ-{from} ל-{to}?`

**B12. Gendered slash imperatives in UI chrome.** The flow otherwise addresses candidates in the plural ("שמרו", "הזינו", "אתם"). Normalize: `runner.tsx` "דלג/י"/"שלח/י" (→ §3.2), "רענן/י את הדף" (×4, lines 153/158/168/261/285) → "רעננו את הדף"; `item-views.tsx:254` "בחר/י אירוע" → "בחרו אירוע"; `resume-form.tsx:144` "אין לך את הקוד? שלחו לי קוד למייל" → "אין לכם את הקוד? קבלו קוד למייל"; `briefing-panel.tsx:133` "שימו לב: הדפדפן שלכם לא תומך…" keep. Keep the legal consent phrasing "קראתי ואני מסכים/ה" (standard Israeli form convention).

**B13. `assessment-block-copy.ts`** `tech.howItWorksHe` — "כל מוסכמה שצריך יודגש בתוך השאלה" (ungrammatical) → `כל מוסכמה שנדרשת מצוינת בתוך השאלה עצמה`. `speed.ruleHe` "קריאה ותשובה מהירה ומדויקת." → `קריאה מהירה, תשובה מדויקת.`

**B14. Personal details** `personal-details-form.tsx:370` legend "יכולת לעבוד מראשון לציון (פיזית, בהיברידי)" → `זמינות להגיע פיזית לאזור ראשון לציון (במודל היברידי)`; `:437` label → `קורות חיים (לא חובה)` with the format as a chip (§1.7).

**B15.** Practice scene q2/q3 placeholders — see A5.

**B16. `speed.bracket_balance`** option label "לא מאוזן — נשבר במיקום {p}" → `לא מאוזן — התו הראשון שאינו תואם במיקום {p}`; prompt "באיזה מיקום (מספר התו, מ-1) הוא נשבר?" → `באיזה מיקום (מספר התו, החל מ-1) נמצא התו הראשון שאינו תואם?`

**B17. `investigate/helpers.ts`** `wait_and_see` anti-pattern — "לסמן את הכרטיס כ'בבדיקה' ולחכות בסבלנות עד מחר לראות אם התקלה חוזרת על עצמה מחדש או נעלמת לבד" → `לסמן את הכרטיס כ"בבדיקה" ולחכות עד מחר, לראות אם התקלה חוזרת או נעלמת מעצמה` (double quotes, drop the padding words). Same trim on `escalate_no_evidence`: `לפתוח פנייה למנהל/ת עם תיאור התקלה כפי שדווחה, ולבקש הנחיה על הצעד הבא לפני שבודקים משהו בעצמכם`.

**B18. Terms card title** "כרטיס תנאים" (both pages) → `תנאי ההתקשרות` (§1.5). The confirmation sentence `confirmations-form.tsx:45` keeps "הבנתי את התנאים".

**B19. Landing 50/50 line** `jobs/[slug]/page.tsx:56` → `התפקיד הוא כ-50% פיתוח וכ-50% תפעול טכנולוגי, כולל חלק של תמיכה טכנית פנימית — אנחנו אומרים את זה מראש.` Keep `data-testid="tech-ops-line"`.

**B20. Done/abandoned and error copy** — `runner.tsx:153` "פג תוקף החיבור. רעננו את הדף כדי להתחבר מחדש."; `:168` "שגיאת רשת. רעננו את הדף — ההתקדמות נשמרה."

### C — polish

**C1.** analogy pair swap (see B2). **C2.** `speed.odd_one_out` category "כלי מטבח" contains "צלחת", "קערה" (not tools) → rename `ציוד מטבח`. **C3.** Use the typographic gershayim consistently: `מ״ש` (U+05F4) — `speed.units_math` uses `מ"ש` while `duplicate_submissions` uses `מ״ש`; standardize on `מ״ש`, and `ס״מ`/`ק״מ` in `odd_one_out`. **C4.** Arrows in Hebrew prose: prefer the real arrow `←` (points "forward" in RTL) over ASCII `->` in `reasoning.cipher_rule` (`"בית" ← "תיב"`) and `reasoning.ordering_clues`; keep `->` / `→` only inside LTR code runs (`field_mapping_error` options are all-Latin runs and are fine). **C5.** `investigate/webhook_missing.ts` tab label "Logs – integration" → `לוג אינטגרציה`. **C6.** `speed.units_math` RULE: `ריצה "בטור"` → `ריצה בטור (serial)` / `ריצה במקביל (parallel)` without the scare quotes.

Verified good and left alone: `speed.date_diff`, `speed.ip_valid`, `speed.json_diff`, `speed.sorted_which`, `speed.count_matches`, `speed.regex_match` (after A2), `reasoning.ordering_clues`, `reasoning.pseudocode_trace`, `reasoning.min_moves`, `reasoning.seq_numeric`, `reasoning.rule_induction` (after A2/A8), `tech.http_status_next`, `tech.sql_outcome`, `tech.automation_pick`, `tech.api_pagination_math`, `tech.cloud_waste` (after A8), `tech.field_mapping_error` (after A8), `tech.security_smell`, `tech.webhook_vs_polling`, all investigation tickets and q3 prompts, the privacy notice and monitoring disclosure (`consent-text.ts` — do **not** edit: their SHA-256 is the consent version), the job seed text.

Mixed-direction check: `<Term>` is used correctly on dates, codes, "75", "AI", URLs, and the terms figures. Two gaps: `briefing-panel.tsx:129` renders `{device.viewportWidth}px` bare → wrap in `<Term>`; `block-intro.tsx:56` "בעוד {secondsLeft} שניות" → `<Term>{secondsLeft}</Term>`.

---

## 5. Implementation checklist (top to bottom)

Estimated total: ~5 engineering days. P0 is a half day and ships alone first.

### P0 — client-visible copy (ship first, same day)
- [ ] §2.3 step-1 success panel: new hierarchy and copy in `personal-details-form.tsx` (`created` branch); submit button → "שמירה והמשך"; drop the response-date line. Keep all three `data-testid`s.
- [ ] §2.4 landing process outline copy in `jobs/[slug]/page.tsx`.
- [ ] §2.5 `renderApplicationReceived` subject/body/text in `src/lib/email/templates.ts`; stop rendering `responseByDateHe`.
- [ ] §2.6 done page copy in `done/page.tsx`; update `tests/e2e/assessment-runner.spec.ts:246` assertion.
- [ ] §3.2 briefing rule line (`briefing/page.tsx:48`) and runner button labels (`runner.tsx:427`, `:436`).
- [ ] §2.8 + §3.2 docs: `CANDIDATE_FLOW.md`, `DESIGN_SUMMARY.md`, `DECISIONS_LOG.md` #20 and #21.
- [ ] Run `pnpm typecheck && pnpm lint && pnpm test && pnpm test:e2e` (chromium project at minimum).

### P0 — content correctness (ship second; these are bugs, not style)
- [ ] A1 grid_pattern: `types.ts` fields, `grid_pattern.ts` composition (+ `version: 2`), `item-views.tsx` figure + SVG option tiles, new unit test.
- [ ] A2 inline code in `item-text.tsx` (`renderInline`, table cells, options via `InlineText`).
- [ ] A3 timezone_shift copy + `conventionsStated` (+ `version: 2`).
- [ ] A4 constraints_seating right-to-left rewrite (+ `version: 2`).
- [ ] A5 practice tab label; q1-only rendering when `scored === false`.
- [ ] A6 sso_login_subset "חסומים" ×4 + mapping tab body (+ `version: 2`).
- [ ] A7 `dir="auto"` on short-text and q3 inputs.
- [ ] A8 table direction by header script in `renderTable`.
- [ ] `pnpm test -- -u`; review the snapshot diff — only listed strings may change. `pnpm bank:audit` must pass (A3/B4 change `conventionsStated`, which the audit checks verbatim).

### P1 — design system foundation
- [ ] `globals.css`: tokens (§1.2), `body` canvas/text, `.tnum`, `.inline-code`, reduced-motion rule.
- [ ] `tailwind.config.ts`: `extend.colors` mapping to the CSS variables; mono stack with Heebo fallback (§1.3); `borderRadius` 10/12/16; `boxShadow.card`.
- [ ] `layout.tsx` (candidate): Heebo weights 400–700; metadata title from `BRAND_NAME`.
- [ ] `src/lib/brand.ts`, `src/components/brand-mark.tsx`, `public/brand/` (ask the client for `logo.svg` + brand hex now; the wordmark fallback ships regardless).
- [ ] `src/components/ui/`: `button`, `field` (input/select), `checkbox`, `card`, `callout`, `chip`, `stepper`, `terms-card`, `resume-code-row`, `option-button` per §1.5.
- [ ] `src/components/candidate-shell.tsx` (header + stepper slot + footer) and wire every candidate page into it.

### P1 — candidate screens (in funnel order, so each PR is testable end-to-end)
- [ ] Landing: InkCard terms, "מה התפקיד באמת" card, numbered process card, CTA.
- [ ] Step 1: grouped form, segmented Rishon control, CV dropzone with states, consent checkbox, success panel using `ResumeCodeRow` + stepper.
- [ ] Step 2: prose tokens, InkCard, confirmations with custom checkboxes.
- [ ] Briefing: three cards, disclosure card, device-status row, CTA.
- [ ] Done: hero check, copy from §2.6.
- [ ] Resume + privacy pages: shell + fields + buttons.
- [ ] B12/B14/B18/B19/B20 copy fixes land with their screens.
- [ ] Re-run the Playwright RTL screenshot suite; update baselines deliberately.

### P2 — assessment runner
- [ ] `TimerBand` replacing header + `timer-bar.tsx` (keep `data-testid`s and `data-timer-state`).
- [ ] Item `Card`, `OptionButton` for single/multi/investigation, code-block and table styling, notices as `Callout`.
- [ ] Bottom action bar: primary "שליחת תשובה", ghost "דילוג על השאלה" with the 4 s confirm state.
- [ ] Investigation 5/7 layout, underline tabs, ticket callout, numbered sub-question chips.
- [ ] Block intro on ink; practice scene band variant.
- [ ] `<Term>` gaps (§4 end) in `briefing-panel.tsx` and `block-intro.tsx`.
- [ ] B-level bank copy (B1–B11, B13, B16, B17) and C-level polish, each with `version: 2`; snapshot update; `pnpm bank:audit`.

### P3 — surrounding surfaces
- [ ] Email `wrap()` restyle (§2.5) applied to all three candidate templates.
- [ ] Admin: tokens + primitives only (§1.9).
- [ ] Optional `assessment_completed` email (§2.7) — only after P0–P2 are live and the client has seen them.

### Definition of done for the whole plan
- The strings "המועמדות התקבלה" / "קיבלנו את המועמדות" appear nowhere before `/done` (grep `src/` and `docs/`).
- The string "גרוע מניחוש" appears nowhere in `src/` or in candidate-facing docs; `SCORING.md` §3.6 and the property test are byte-identical to today.
- A generated `reasoning.grid_pattern` item shows a real 3×3 figure and six SVG option tiles; no candidate-facing text contains a literal backtick or `<svg`.
- Every table whose header is Hebrew reads right-to-left; every free-text answer field accepts Hebrew with a correct caret.
- Lighthouse accessibility ≥ 95 on landing, step 1, briefing, runner (choice item), done; keyboard-only completion of the full flow works.

---

## Round 2 — client feedback: "not professional enough" + tech-ops line

Status: **Decided.** Author: Fable. Basis: the live build (working tree as of this round, including the other engineer's "20 דקות" and root-redirect changes) run locally against real Postgres and screenshotted with Playwright at 1366×768 and 390×844 — every candidate route, every runner block type (speed, reasoning incl. the SVG grid and ordering, tech incl. table and code, investigation), every block intro, the practice scene, all runner button states (amber timer, skip-confirm, hover, disabled), the done page, resume (code + OTP + error), privacy, the inactive-job page, the bare 404, `/apply/*` without a cookie, and the "already past this step" variants. The critique below is from those renders, not from the component code.

Already handled elsewhere, not repeated here: the bare `/` route now redirects to the job page; "20 דקות" is in all candidate copy. One knock-on from the latter is flagged in §R2.2 landing.

Round-1 decisions stand unless a subsection explicitly overrides one and says why. Overrides in this round: the canvas/line/shadow values (§R2.3.1), the disabled-button treatment (§R2.3.4), the CTA width rule (§R2.3.4), the header composition (§R2.3.2), the investigation grid ratio (§R2.2 runner), and the cards-everywhere rhythm (§R2.3.3).

### R2.0 Why it still does not read as "a professional website" — the diagnosis in one paragraph

The tokens landed; the art direction did not. Every page is the same composition: a 24 px heading, then a vertical stack of identical white cards with the same 24 px padding and the same barely-visible shadow on a barely-different grey, then a blue button whose width and alignment differ from page to page. Nothing on any page is visually primary. The header is an empty 56 px strip with a placeholder wordmark ("Careers") on one edge and, on flow pages, a 13 px stepper flung to the opposite edge of a 1366 px viewport, leaving 900 px of nothing between them — that single element is what makes the site read as "a template" before the candidate reads a word. Type is small and flat (the H1 is literally *smaller* on desktop than on mobile because of an inverted breakpoint), the canvas (#F6F7FB) against white cards has too little contrast for the card edge to register, and several unfinished states leak through: an English Next.js 404, English Zod error strings, a job description rendered as one 11-line wall of text, a skip button stuck in its confirmation state for the rest of the assessment, and an unstyled "already past this step" screen. Palette-wise, ink-navy + electric-blue + mint is fine and stays; the problem is hierarchy, rhythm, and finish, not hue.

### R2.1 The tech-ops line — new copy and placement

**Diagnosis.** Two things make it read as a warning. (a) The words: "כולל חלק של תמיכה טכנית פנימית — אנחנו אומרים את זה מראש" is the grammar of a disclaimer ("we're telling you now so you can't complain later"). (b) The placement: it is a bare paragraph floating between the ink terms card and the white process card, with no heading and no container — visually the same position and weight as fine print. The seed's own job description already has the right framing ("זו לא משרת Help Desk: המטרה הרחבה היא להפוך את הארגון למקום טכנולוגי, אוטומטי ויעיל הרבה יותר, ואת/ה תהיו חלק מרכזי בזה") — the landing line just never inherited it.

**Constraint preserved.** The founding brief: be transparent that IT/support work exists; do not position the job as Help Desk. The new copy names internal technical support explicitly and in the first sentence. It is not softened into invisibility; its *valence* changes.

**Placement.** The line moves inside a new `Card` titled **"מה התפקיד באמת"** on the landing page (round 1 §1.7 already specified this card; it was never built — the line shipped as a loose `<p>`). The card has a two-column split at ≥ 480 px and the line under it as body text. It is *not* a `Callout` (a tinted box with an icon is a warning affordance).

```
Card  "מה התפקיד באמת"                                   (H2 20/28 600 --ink-900)

  grid 2 cols (1 col < 480px), gap 24                  each column:
  ┌──────────────────────────┬──────────────────────────┐
  │ eyebrow  פיתוח · כ-50%   │ eyebrow  תפעול טכנולוגי · כ-50% │   13/20 600 --brand-700
  │ כלים פנימיים, אוטומציות,  │ תשתיות ו-Cloud, הרשאות     │   15/24 --text-2
  │ אינטגרציות ועבודה מול APIs│ ומערכות SaaS, נתונים, לוגים │
  │                          │ ותקלות                    │
  └──────────────────────────┴──────────────────────────┘

  p  data-testid="tech-ops-line"                         16/26 --text, mt 20
```

**Exact new Hebrew copy** (`jobs/[slug]/page.tsx`, keep `data-testid="tech-ops-line"`):

> חלק מהתפעול הוא תמיכה טכנית פנימית לעובדים — זה חלק אמיתי מהתפקיד, אבל זו לא משרת Help Desk. מי שרואה את התקלות מקרוב הוא מי שיודע מה כדאי לאוטמט ולייעל, וזו בדיוק ההזדמנות: להפוך את הארגון למקום טכנולוגי, אוטומטי ויעיל הרבה יותר — **ואתם תהיו חלק מרכזי בזה.**

Render the last clause (from "ואתם") as `<strong class="font-semibold text-ink-900">`. `Help Desk` and `APIs`/`Cloud`/`SaaS` go through `<Term>`.

Column copy (verbatim): right column eyebrow `פיתוח · כ-50%`, body `כלים פנימיים, אוטומציות, אינטגרציות ועבודה מול APIs.`; left column eyebrow `תפעול טכנולוגי · כ-50%`, body `תשתיות ו-Cloud, הרשאות ומערכות SaaS, נתונים, לוגים ותקלות.`

**Same framing in step 2.** The seeded job description (`supabase/migrations/0002_seed.sql`, and the live `jobs.description_he` row) still contains "חלק מזה הוא תמיכה טכנית פנימית לעובדים — זה קיים, ואנחנו אומרים את זה מראש." Replace that sentence in the seed with: `חלק מזה הוא תמיכה טכנית פנימית לעובדים — זה חלק אמיתי מהתפקיד.` (the following sentence "זו לא משרת Help Desk: …" already carries the mission). On the **live** database this is a one-line edit in Admin → Jobs → edit description (re-saving also fixes the paragraph-rendering bug in §R2.2 step 2); do not write a data migration for a text edit an admin screen exists for. Also update `docs/CANDIDATE_FLOW.md` §1.1 and §3.1 to the new sentences. The step-2 confirmation checkbox #1 ("הבנתי שהתפקיד משלב … תמיכה טכנית פנימית") is unchanged — it is the explicit acknowledgement the brief asks for.

### R2.2 Screen-by-screen critique and fixes

Each item: **what I saw → fix.** Tailwind/CSS values are exact; component names refer to `src/components/ui/*`.

#### Landing `/jobs/{slug}` (1366 and 390)

1. **H1 is 24 px on desktop, 28 px on mobile** — `text-[28px] … min-[480px]:text-[24px]` is inverted (round 1 said 28 desktop / 24 mobile). Same bug on step 1, step 2, briefing, resume, privacy. → New shared class in `globals.css`: `.h1 { font-size: 26px; line-height: 34px; font-weight: 700; letter-spacing: -0.01em; color: var(--ink-900) } @media (min-width: 640px) { .h1 { font-size: 32px; line-height: 40px } }`. Replace every H1 class string with `h1`. (Type scale change recorded in §R2.3.5.)
2. **Summary line under the H1 is meta, not a hook.** 18 px `--text-2` with no separation from the H1. → Add an eyebrow row *above* the H1: `BRAND_NAME · ראשון לציון · משרה חלקית` 13/20 600 `--brand-700` (`tnum`); H1; summary 18/28 `--text-2` with `mt-3`; then `mt-8` before the terms card. (Verify the production `summary_he` is real copy — the local test row contains e2e junk "תקציר מעודכן 1788…", which is a reminder that this line is admin-editable and must be checked on prod after every admin test run.)
3. **The terms card has a ragged 2-column grid** ("התחלה" alone on the last row, keys 13 px grey on ink) and the hero rate is under-scaled for a 720 px card. → `TermsCard`: rate 40/48 700 `--mint-300` (`tnum`), "לשעה" 15/24 `--ink-200` on the same baseline; a 1 px `--ink-800` rule under the rate row (`mt-5 border-t border-ink-800 pt-5`); the `dl` becomes **three** columns at ≥ 640 px (`grid-cols-1 min-[480px]:grid-cols-2 sm:grid-cols-3`, `gap-x-8 gap-y-5`), keys 12/16 600 `--ink-200`, values 15/24 600 white. Five cells fill 2×3 with no orphan by giving "מיקום" `sm:col-span-2` — DOM order: מיקום (span 2) · התחלה / היקף שבועי · אורך יום · סוג התקשרות. Keep exactly four `<Term>`s in the card (the e2e suite counts them).
4. **Tech-ops line floats as fine print.** → §R2.1.
5. **Process list: duration chips sit inline after the text and wrap under it on mobile ("כ-20 דקות" dropped to its own line).** Also the "20 דקות" chip is now visually lighter than the row that was designed around "30". → Rebuild each row as `grid grid-cols-[28px_1fr_auto] items-center gap-3` (number badge · text · chip); chips get `justify-self-end` so all three durations align in one column; the badge grows to 28 px (`h-7 w-7`), bg `--brand-50`, text `--brand-700`, 13/20 600; row height 44 px with a 1 px `--line` divider between rows (`divide-y divide-line`, padding `py-3`). Row 3 text stays bold. The line under the list ("כדאי לעבור את כל התהליך ברצף…") → 14/22 `--text-2`, `mt-4`, with "כ-25 דקות" in `<Term>`.
6. **CTA is auto-width, right-aligned, 48 px, and the only auto-width CTA in the funnel; its hover state (brand-600 → brand-700) is invisible in a screenshot; the privacy link is duplicated (under the CTA and again in the footer).** → CTA per §R2.3.4 (`size="lg"`, 52 px, `min-w-[240px]`, start-aligned, plus a helper line at its side: "כ-25 דקות · במחשב" 13/20 `--text-3`). Delete the under-CTA privacy link; the footer has it.
7. **Inactive job (`/jobs/does-not-exist`) is a lone H1 on an empty canvas.** → Render a `Card` (max-w 480, centered): icon-less, H1 "המשרה אינה פתוחה כרגע" 24/32, body "ייתכן שהקישור ישן או שהמשרה כבר אוישה. אם הגעתם לכאן מהודעה שקיבלתם מאיתנו, כתבו לנו — הכתובת בעמוד מדיניות הפרטיות." 16/26 `--text-2`, `secondary` button "למדיניות הפרטיות". Same treatment for step 1's and step 2's `!job` branches.
8. **Bare 404 is Next's default: English, LTR, no shell.** → Add `src/app/(candidate)/[locale]/not-found.tsx` rendering `CandidateShell` + the same `Card` pattern: H1 "העמוד לא נמצא", body "הקישור שגוי או שפג תוקפו.", primary "למשרה הפתוחה" → `/jobs/student-tech-2026` (via `BRAND`/`DEFAULT_JOB_SLUG` constant in `src/lib/brand.ts`, not a string literal in the page), ghost "חזרה לתהליך עם קוד" → `/resume`. Also `error.tsx` at the same level with "משהו השתבש" + a reload button, so a thrown server error never shows the default Next error page.

#### Step 1 `/jobs/{slug}/apply`

1. **English validation strings leak: "Expected number, received nan" (study year) and "Required" (Rishon radio).** → `src/lib/validation.ts`: `studyYear: z.coerce.number({ invalid_type_error: "יש לבחור שנת לימוד" }).int().min(1, …).max(7, …)` — and because `z.coerce.number("")` yields `NaN` which hits `invalid_type_error` only in some Zod versions, guard with `.pipe()` after `z.string().min(1, "יש לבחור שנת לימוד")`; `canWorkRishon: z.enum(["yes","no"], { errorMap: () => ({ message: "יש לבחור תשובה" }) })`. Add a unit test that submits an empty form and asserts every error string matches `/[֐-׿]/` and none matches `/Expected|Required|received/`.
2. **Eyebrow under the H1 wraps to two lines because it carries the full job title** ("כ-3 דקות · נשמר אוטומטית בדפדפן — סטודנט/ית למשרה…"). → Eyebrow is `כ-3 דקות · נשמר אוטומטית בדפדפן` only. The job title goes *above* the H1 as the page eyebrow (13/20 600 `--brand-700`, truncated with `truncate` at one line).
3. **One 560 px column of 48 px inputs with 20 px gaps and 13 px grey group labels reads as an unstyled HTML form.** → Two-up rows at ≥ 480 px: `grid grid-cols-1 gap-5 min-[480px]:grid-cols-2` for (שם פרטי, שם משפחה), (תאריך לידה, טלפון נייד), (מוסד לימודים, תואר / מסלול), (שנת לימוד, ממוצע); email, LinkedIn, GitHub stay full width. Group labels become real section headings: 15/24 600 `--ink-900` with a 13/20 `--text-3` description beside/under them ("מי את/ה" → "פרטי קשר"; "לימודים" → "לימודים"; "זמינות" → "זמינות"; "אופציונלי" → "לא חובה — אבל עוזר לנו"), section spacing `pt-6 mt-6 border-t border-line`. Field label 14/22 500 `--text-2` stays.
4. **The date input shows the browser's LTR `dd/mm/yyyy` with a calendar icon on the far left of an RTL form.** Acceptable functionally; make it look intended: `dir="ltr" text-start` (already) plus `min-[480px]:max-w-[220px]` so it does not stretch as an empty 48 px bar.
5. **Segmented כן/לא control is 96 px per side and hugs the right edge under a long legend.** → `min-w-[120px]` per side, and the legend shortens to `זמינות להגיע לאזור ראשון לציון (היברידי)` with helper `נדרש חלק מהשבוע; לא מרחוק בלבד` 13/20 `--text-3`.
6. **CV dropzone is a 130 px tall dashed box for an optional field — the largest element on the page.** → Compact: `py-4`, icon and text on one `rtl-row` (icon 20 px · "גררו קובץ או לחצו לבחירה" 15/24 · chip), height ~64 px.
7. **Success panel: the stepper renders twice (header and inside the card), three different step counters are visible on mobile ("שלב 1 מתוך 4" ×2 and "שלב 1 מתוך 3 הושלם"), the page H1 "פרטים אישיים" + "כ-3 דקות" eyebrow stay above the panel, "/resume" appears as a raw path in prose, and the CTA is auto-width while the form's was full width.** → (a) Remove `<Stepper>` from inside the card; the header stepper gets `currentAlsoDone`. (b) Eyebrow → `הפרטים נשמרו` (no numbers; the landing counts 3 steps, the stepper 4 — do not put both totals in front of the candidate). (c) Move the H1 and eyebrow into `PersonalDetailsForm` so the `created` branch renders its own heading: H1 "הפרטים נשמרו" (class `h1`), sub 18/28 `--text-2` "השלב הבא: התפקיד והמבחן — המועמדות נבחנת רק אחרי המבחן המקוון (כ-20 דקות, במחשב)." (d) A 48 px mint check disc (bg `--mint-600`, white 24 px check) at the start of the card, `rtl-row gap-4` with the heading. (e) Helper under the resume code: `אם תצטרכו לעצור באמצע, האימייל והקוד מחזירים אתכם לאותה נקודה ב` + `<Link href="/resume">עמוד החזרה לתהליך</Link>` + `. שלחנו אותו גם למייל.` (f) CTA per §R2.3.4, start-aligned, `size="lg"`.

#### Step 2 `/apply/{id}/job`

1. **The job description is one unbroken 11-line paragraph — the single most unprofessional element in the funnel.** Cause: `renderJobDescriptionHtml` (`src/db/queries/jobs.ts:204`) splits paragraphs on `\n{2,}` and the stored `description_he` uses single newlines, so every paragraph — including the `**פיתוח תוכנה (~50%)**` lead-ins — is joined with spaces into one `<p>`. → `const blocks = markdown.trim().split(/\n+/)` (a single newline is a paragraph break; there is no use of soft line breaks in job descriptions), and lines that are *only* a `**…**` run become `<h3>` instead of `<p><strong>`. Re-save the live job in Admin → Jobs (the description is re-rendered on save) — that is also where the §R2.1 sentence edit happens. Add a unit test on `renderJobDescriptionHtml` with the seed text asserting ≥ 5 `<p>`/`<h3>` blocks.
2. **Prose card styling is flat once paragraphs exist.** → In the `prose` class map add `[&_h3]:mt-6 [&_h3]:text-[17px] [&_h3]:font-semibold [&_h3]:text-ink-900 [&_p]:mt-3 [&_p]:text-text-2 [&_p:first-child]:mt-0 [&_p:first-child]:text-text [&_p:first-child]:text-[17px] [&_p:first-child]:leading-7` so the opening paragraph is the lede.
3. **Three stacked surfaces (description card, ink card, confirmations card) with equal weight.** → Description card becomes **flat** (`variant="flat"`, §R2.3.3); the ink card stays; the confirmations card keeps the shadow — it is the action surface. Title the confirmations card: H2 "לפני שממשיכים, שלושה אישורים" 17/24 600, `mb-4`. Checkbox rows get `py-2` and a 1 px `--line` divider (`divide-y divide-line`).
4. **Already-past variant** ("כבר אישרת את השלב הזה") is a bare H1 + paragraph + button. → Same `Card` pattern as the landing's inactive-job card; body "אפשר להמשיך מהנקודה שבה עצרתם.", primary "המשך" → `stepPath`. Reuse for the briefing's already-past branch.

#### Briefing `/apply/{id}/briefing`

1. **Four identical cards + a floating status row + a full-width washed-out disabled button.** The disabled primary at 45 % opacity reads as a rendering glitch, and the mint "✓ מסך רחב ✓ מסך מלא זמין" row floats on the canvas with nothing anchoring it. → Merge "מה זה" and "מה לצפות" into **one** flat card with two H2 sections separated by `border-t border-line pt-5 mt-5`; "הכללים" stays its own flat card; the disclosure becomes a flat card whose *content* is the callout text styled as plain body (drop the nested `Callout` — a callout inside a card is a box inside a box): eyebrow "שקיפות" 13/20 600 `--brand-700`, body 15/24 `--text-2`, then the consent checkbox with `mt-4 pt-4 border-t border-line`. The device check moves into the same card as a two-row status list under the checkbox (`rtl-row gap-2 text-[14px]`: 16 px check disc `--mint-600`/`--amber-500` + label); the viewport warning `Callout warning` stays where it is (it is a real warning). CTA per §R2.3.4 (`size="lg"`, start-aligned, `min-w-[240px]`) with the disabled treatment from §R2.3.4 — not opacity.
2. **Rule list check icons are 16 px `--brand-600` ticks with no container — fine, keep; but bump list gap to `space-y-3`.**

#### Block intro (all four) and practice scene

1. **A 560 px column whose heading, chips and rule are right-aligned while the auto-advance line is centered; no sense of which part of four this is; CTA is a 560 px white bar.** → Add eyebrow `חלק {n} מתוך 4` (`tnum`) in place of "החלק הבא"; above the column, a 4-segment progress rail (`grid grid-cols-4 gap-1.5`, each segment `h-1 rounded-full`, done `--brand-400`, current white, upcoming `--ink-800`). Auto-advance line → `text-start`, not centered. CTA → `onInk` `size="lg"` auto-width `min-w-[240px]` start-aligned; put the auto-advance line beside it on the same row at ≥ 640 px (`rtl-row items-center gap-4`).
2. **Display type on ink is fine (36/44 700).** Keep. Rule text → 17/28 `--ink-200` for readability on ink.
3. **Practice scene: band, page heading and CTA use three different widths (1180 / 1040 card / 1180 button).** → The practice CTA uses the runner's action-bar layout (`mt-8 flex justify-between`) with the primary at the end side, exactly like an item, so the candidate rehearses the real button position.

#### Assessment runner

1. **BUG — the skip button stays in its "לדלג בלי לענות?" confirm state on every item after the first skip click, with no 4 s revert and no reset on item change.** Screenshots of items 3, 11, 13–17, 19, 24 all show the confirm label; on those items a single click skips with no confirmation. → In `runner.tsx`: reset `skipConfirm` to `false` in the item-load effect (the `useEffect` keyed on `phase.item.itemId`) and add `useEffect(() => { if (!skipConfirm) return; const t = setTimeout(() => setSkipConfirm(false), 4000); return () => clearTimeout(t); }, [skipConfirm])`. Add an e2e assertion: after `skip-button` is clicked once and the next item loads, its text is "דילוג על השאלה".
2. **Option rows are 924 px wide for two-word answers (items 1, 3, 14, 19); the eye travels the full width to find the badge.** → Runner content column 1040 → **880 px** (`max-w-[880px]`) and the item card padding stays 32; the options column gets `max-w-[640px]` for `single_choice`/`multi_choice` when every option is < 40 characters (compute in `SingleChoiceView`: `const short = content.options.every(o => o.length < 40)`), otherwise full card width. Investigation and table items are unaffected.
3. **Numeric input renders full width** (`w-40` loses to `w-full` in `FIELD_BASE`). → Wrap in `<div className="w-40">` and drop `w-40` from the input; unit label stays beside it.
4. **Grid-pattern figure is pinned to the far left of an RTL card while the prompt and option tiles are on the right — the composition is split in two.** → Figure wrapper `flex justify-center my-6` (the SVG itself keeps `dir="ltr"`); option tiles become `justify-content: flex-start` in RTL (i.e. start-aligned under the prompt) with `gap-3` and 104 px tiles; selected tile gets the same inset ring plus `bg-brand-50`.
5. **Table item (16) and mapping item (17): tables fill 924 px with 5 columns of 3-character content.** → Tables get `w-auto min-w-[420px]` instead of `min-w-full`, header cells `whitespace-nowrap`, and the wrapper `inline-block max-w-full`.
6. **Timer band: fine. The progress label has no block-of-four context.** → Start side becomes `חלק 2 מתוך 4 · חשיבה` (13/20 600 `--ink-200`, `tnum`) above `שאלה 11 מתוך 27` (16/24 600 white); band height 64 stays.
7. **Disabled "שליחת תשובה" at 45 % opacity looks broken next to the sharp skip button.** → §R2.3.4 disabled treatment.
8. **Investigation: answers column (5/12) is cramped — every option wraps to three lines — while the artifact pane (7/12) is 70 % empty, and the tab list wraps to a second row ("טקסט שגיאת הדפדפן").** Override round 1's 5/7: → **7/5** (answers `lg:col-span-7`, artifacts `lg:col-span-5`); the artifact pane is `lg:sticky lg:top-24 self-start` so it stays visible while scrolling q1→q3; tab list `flex-nowrap overflow-x-auto` with `whitespace-nowrap` tabs and a hidden scrollbar (`[scrollbar-width:none]`); artifact `<pre>` gets `dir="auto"` (Hebrew bodies like "תוקף: פג אתמול ב-03:00" currently render inside an LTR block). Sub-question chips "1/2/3" → 24 px `--brand-50`/`--brand-700` badges to match the landing's process badges (one numbering style across the product).
9. **Ordering item: five 180 px selects with "בחר/י אירוע" (gendered — round 1 B12 said "בחרו אירוע") right-aligned under a wide empty card.** → Selects `w-full max-w-[420px]`; copy fix.
10. **Round-1 P2 B-level copy not landed** — item 16 still says "(must be true)" (B3), item 14 uses the old analogy format (B2), the ordering placeholder (B12). These are in round 1's §5 P2 list; they are not visual and are not re-specified here, but the engineer should confirm the P2 bank-copy checklist actually shipped before closing round 2.

#### Done `/apply/{id}/done`

The strongest screen in the funnel; keep the composition. Two changes: → the outline check becomes a filled 64 px disc (bg `--mint-600`, white 28 px check) so it reads as a state, not a line icon; the date sentence gets `text-[18px] leading-7` with the date in `<Term>` 700 `--ink-900` (already 600 — bump). Mobile is fine.

#### Resume `/resume`

1. **The label "קוד החזרה (K7M4-Q2XP)" puts a sample code in the label where it reads as a real value.** → Label `קוד החזרה`; the input gets `placeholder="K7M4-Q2XP"` and `font-mono tracking-wider` (`className="font-mono tracking-[0.08em]"`), `autoCapitalize="characters"`, `maxLength={9}`.
2. **OTP mode shows two "אימייל" fields on one screen (one per form).** → One email field; the "שליחת קוד למייל" form owns it; after `sent === true` the verify form appears *below* with the email carried in a hidden input (`<input type="hidden" name="email" value={email}>`) and a line "שלחנו קוד ל-{email}" 14/22 `--text-2` with a ghost "לשנות אימייל". Until sent, the verify form is not rendered.
3. Error callout, "אין לכם את הקוד?" ghost link: fine. Page sub-line: fine.

#### Privacy `/privacy`

Fine as a reading page; two changes: → the request card becomes flat (it is secondary to the notice); the H2 "בקשה לגבי הפרטים שלי" gets `mt-12`. The notice text itself is consent-hashed (`consent-text.ts`) and is **not** edited; the "**מה אנחנו אוספים ולמה.**" lead-ins cannot be bolded without changing the hash — accepted.

#### `/apply/{id}/assessment` already-past branch

Unstyled: raw `text-neutral-600`, a black `bg-neutral-900` button, no shell, no header. → Wrap in `CandidateShell` with the same `Card` pattern as step 2's already-past variant. Grep `src/app/(candidate)` for `neutral-` and remove every hit.

### R2.3 Cross-cutting design-system changes

#### R2.3.1 Canvas, line, shadow (overrides round 1 §1.2 values; everything else in §1.2 stands)

The card edge does not register at #F6F7FB/#FFFFFF with a 6 % shadow. New values, `globals.css` only (Tailwind reads the variables):

```css
--canvas: #EEF1F7;        /* was #F6F7FB */
--line:   #DCE2EC;        /* was #E3E7F0 */
--line-strong: #C3CBDA;   /* was #C9D0DE */
```
`tailwind.config.ts` `boxShadow.card` → `0 1px 2px rgba(11,21,48,.06), 0 10px 30px rgba(11,21,48,.08)`. Contrast re-check: `--text-3` (#6B7690) on the new canvas is 4.2:1 — **below AA** — so `--text-3` becomes `#606B86` (4.6:1 on #EEF1F7, 5.1:1 on white). Propagates automatically to every `text-text-3` use; no per-file work.

#### R2.3.2 Header and footer (`candidate-shell.tsx`, `brand-mark.tsx`, `stepper.tsx`)

- Header height 56 → **64 px**; layout `grid grid-cols-[1fr_auto_1fr] items-center` so the stepper is **centered** and the brand mark sits at the start; the end cell holds nothing on candidate pages (reserved). Under 640 px: two columns (brand · "שלב N מתוך 4").
- `BrandMark` without a client logo: a 28 px rounded-8 `--ink-900` square containing the first letter of `BRAND_NAME` in white 15/700, then the wordmark 17/24 700 `--ink-900`, `gap-2.5`. Ask the client — again — for `logo.svg` and a hex; the monogram is the fallback, not the brand.
- `Stepper`: dots 8 → **10 px**, labels 13 → **14/20**, connectors 16 → **28 px** (`w-7`), gap 10; done dot `--mint-600` keeps a 12 px white check inside (so "done" is not only a color).
- Footer: `© {year} {BRAND_NAME} · מדיניות פרטיות · {PRIVACY_CONTACT_EMAIL}` (email as `mailto:` in `<Term>`), 13/20 `--text-3`, `py-8`.

#### R2.3.3 Card weight — one primary surface per page

`Card` gets `variant?: "raised" | "flat"` (default `raised` = current). `flat` = `bg-surface border border-line rounded-16` with **no shadow**. Rule: the surface the candidate acts on (the form, the confirmations, the item pane, the done card) is `raised`; reading content (job description, briefing text, privacy request) is `flat`. Never two raised cards stacked directly.

Vertical rhythm on reading pages: H1 block → `mt-8` to the first surface (was 24); between surfaces `mt-5` (was 24 — the stack breathed in the wrong place: too much air between cards, too little after the heading).

#### R2.3.4 Buttons — size, alignment, disabled (overrides round 1 §1.5 on the last two)

- Add `size="lg"`: **52 px** height, `px-7`, 17/24 600, `rounded-12`. Used for every page-level primary (landing CTA, step-1 success CTA, briefing "מתחילים", block-intro "להתחיל", practice continue, done page has none).
- Width rule: **form submits are full width inside their card** (step 1, step 2 confirmations, resume, privacy); **page-level CTAs are auto width, `min-w-[240px]`, aligned to the start side** of the content column. On < 640 px all primaries are full width. This is the one rule; the current mix (landing auto/right, step-1 success auto/left-ish, briefing full) is what makes the pages feel un-art-directed.
- Hover: keep `--brand-700` but add `shadow-[0_6px_16px_rgba(43,77,255,.28)]` and `-translate-y-px` so the state is visible; active resets both.
- **Disabled (override):** round 1 chose 45 % opacity to "keep the color legible"; in practice it reads as broken. New: `disabled:bg-line-strong disabled:text-white disabled:shadow-none disabled:cursor-not-allowed` for `primary`; `secondary`/`ghost` disabled keep opacity .5. The label stays legible (white on #C3CBDA is 2.2:1 — acceptable for a disabled control per WCAG's exemption; the enabled state carries the real contrast).

#### R2.3.5 Type scale (amends round 1 §1.3)

- H1: 32/40 (≥ 640) / 26/34 (mobile), 700, −0.01em — via the `.h1` class; fixes the inverted breakpoint everywhere in one place.
- Page eyebrow (above H1): 13/20 600 `--brand-700`.
- Section heading inside forms: 15/24 600 `--ink-900` (replaces 13 px grey group labels).
- Everything else unchanged.

#### R2.3.6 Focus ring

The ring exists but at 3 px `--brand-100` it is nearly invisible on white. → `box-shadow: 0 0 0 2px var(--surface), 0 0 0 4px var(--brand-600)` (a white gap then a solid brand ring — visible on white, canvas and ink). Keep the same declaration in `.focus-ring:focus-visible`, `FIELD_BASE` focus, and the checkbox/radio peer rules.

### R2.4 Prioritized implementation checklist

Estimated ~3 engineering days. P0 is copy + bugs and ships first, the same day.

#### P0 — client-visible copy and outright bugs (half a day)
- [ ] §R2.1 tech-ops line: new copy + "מה התפקיד באמת" card with the 50/50 columns in `jobs/[slug]/page.tsx`; keep `data-testid="tech-ops-line"`; update `CANDIDATE_FLOW.md` §1.1/§3.1 and the seed sentence; edit the live job description in Admin (also fixes the next item on prod).
- [ ] Step 2 paragraph collapse: `renderJobDescriptionHtml` split on `\n+`, bold-only lines → `<h3>`; unit test; re-save the live job.
- [ ] Runner skip-confirm never resets: reset on item change + 4 s revert in `runner.tsx`; e2e assertion.
- [ ] English Zod strings on step 1 (`validation.ts` studyYear / canWorkRishon); Hebrew-only error test.
- [ ] H1 inverted breakpoint: `.h1` class, applied on landing, step 1, step 2, briefing, resume, privacy.
- [ ] `not-found.tsx` + `error.tsx` under `(candidate)/[locale]`; inactive-job and already-past screens on the shared `Card` pattern; assessment already-past branch wrapped in `CandidateShell`; grep-and-remove `neutral-` from candidate pages.
- [ ] Numeric input width; ordering placeholder "בחרו אירוע".
- [ ] `pnpm typecheck && pnpm lint && pnpm test && pnpm test:e2e` (chromium).

#### P1 — design system (one day)
- [ ] §R2.3.1 tokens (`--canvas`, `--line`, `--line-strong`, `--text-3`, `boxShadow.card`).
- [ ] §R2.3.2 header grid + centered stepper + monogram `BrandMark` + footer; stepper sizes and done-check.
- [ ] §R2.3.3 `Card variant="flat"`; apply the one-raised-surface rule per page; rhythm `mt-8` after H1, `mt-5` between surfaces.
- [ ] §R2.3.4 `Button size="lg"`, width/alignment rule, hover shadow, disabled treatment; wire every page-level CTA.
- [ ] §R2.3.5 page eyebrow + form section headings; §R2.3.6 focus ring.
- [ ] Re-run the Playwright RTL screenshot suite; update baselines deliberately.

#### P1 — screens (one day, funnel order)
- [ ] Landing: eyebrow row, terms-card 3-column grid + 40 px rate + rule, process rows as `grid-cols-[28px_1fr_auto]` with aligned chips, CTA row with helper, remove duplicate privacy link.
- [ ] Step 1: two-up field rows, section headings, compact dropzone, date field width, segmented control width + legend/helper; success panel — no inner stepper, own H1 "הפרטים נשמרו", mint disc, eyebrow without numbers, real `/resume` link, `lg` CTA.
- [ ] Step 2: flat description card with lede/`h3` styles, confirmations card title + dividers.
- [ ] Briefing: merged flat cards, disclosure without nested callout, device status inside the consent card, `lg` CTA.
- [ ] Resume: code placeholder/mono input; single-email OTP flow.
- [ ] Privacy: flat request card. Done: filled mint disc, date 700.

#### P2 — runner polish (half a day)
- [ ] Runner column 880, short-option `max-w-[640px]`, centered grid figure + start-aligned tiles, `w-auto` tables, band "חלק N מתוך 4" line.
- [ ] Investigation 7/5, sticky artifact pane, no-wrap scrollable tabs, `dir="auto"` artifact body, badge style unified with landing.
- [ ] Block intro: "חלק N מתוך 4" eyebrow, 4-segment rail, start-aligned auto-advance line beside an auto-width `onInk` `lg` CTA; practice scene action bar = item action bar.
- [ ] Confirm round-1 P2 B-level bank copy (B2, B3, B12 at minimum) actually landed.

#### Definition of done for round 2
- No English string is reachable on any candidate route, including 404, thrown errors, and empty-form validation (`grep -rn "Expected\|Required\|could not be found" src/app/\(candidate\)` is empty and the Hebrew-only validation test passes).
- The skip button reads "דילוג על השאלה" at the start of every item.
- Step 2's description renders as ≥ 5 blocks.
- At 1366 px: exactly one raised card per page, the stepper centered in the header, every page-level CTA start-aligned and 52 px, every form CTA full width; at 390 px every primary is full width.
- The tech-ops line contains the words "תמיכה טכנית פנימית" and "Help Desk" (transparency preserved) and does not contain "אומרים את זה מראש".
