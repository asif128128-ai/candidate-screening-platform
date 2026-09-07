# ASSESSMENT DESIGN

Status: **Decided.** Defines the assessment a candidate takes, the question bank, generation, timing and navigation rules. Scoring math is in `SCORING.md`; telemetry in `ANTI_CHEATING.md`.

## 1. Design goals, restated as constraints

1. The assessment must be a stronger signal than the CV for: reasoning, independence, technology aptitude, speed.
2. Every item has a strict server-enforced time limit, chosen so that the "photograph it → ask a model → read → answer" loop is not viable *for that item type* — and where an item honestly needs more thinking time than that loop takes (§2.2), it is defended by transfer cost and item design instead of by its clock.
3. No trivia, no LeetCode, no memorization, no personality test. Everything is either "figure it out from what is in front of you" or "what would a technically sensible person do next".
4. Hundreds of candidates must not see the same test. Variability is built into content generation, not into a big hand-written pool.
5. Zero runtime LLM dependency. Zero post-launch content maintenance.
6. Total time ≈ 25 minutes (19:30 of items plus intros and the practice scene). Intense, not exhausting.

## 2. Structure

**Fixed block order, one item on screen at a time, no backward navigation, explicit skip allowed.**

| # | Block (Hebrew name) | Pillar | Items | Time / item | Block time | Item kinds |
|---|---|---|---|---|---|---|
| 1 | חימום מהיר | Speed | 10 | 15 s | 2:30 | single choice / numeric |
| 2 | ידע טכנולוגי | Tech aptitude | 10 | 15 s | 2:30 | single choice |
| 3 | חשיבה | Reasoning | 6 | 30 s | 3:00 | single choice / numeric / ordering |
| 4 | אינסטינקט טכנולוגי | Tech aptitude | 8 | 30 s | 4:00 | single choice / multi choice |
| 5 | חקירה | Independence | 3 | 150 s | 7:30 | investigation (4–5 artifacts, 3 sub-answers) |
| | | | **37** | | **≈ 19:30** | |

**Blueprint v3** (`0014_blueprint_v3_knowledge_block.sql`) added the knowledge block and moved weight from the two long blocks to short ones, on the client's instruction ("I prefer more short questions than long ones" plus an explicit ask for technology-knowledge items). Seven more questions, one minute shorter than v2.

**`ידע טכנולוגי` is a block, not a pillar.** Its items carry `pillar: "tech"`, so they score into the technology number alongside `אינסטינקט טכנולוגי` rather than adding a fifth score, a fifth weight and a fifth admin column for a distinction the hiring manager has not asked to see. Two consequences, both deliberate: the tech pillar is now roughly half recall (its labels say so), and the generator must keep the two blocks' pools apart, which is why `poolForBlock` finally honors the blueprint's per-block `pool` glob instead of filtering on pillar alone.

**Blueprint v2** (`0013_blueprint_v2_fast_items.sql`) replaced v1's 27 items / 29:50 after the threat model in §2.2 was re-derived against a phone camera rather than retyping. The rows above are the shipped blueprint; the block order in this table is also the order the runner serves (`BLOCK_ORDER`, `blockKeyForPosition`), which v1's docs contradicted.

Plus four block intro screens (each auto-advances after 45 s or on click; the countdown for the block's first item starts only when the item is served), and one **untimed interactive practice scene** before the investigation block (a one-artifact, one-question mini-investigation with the real tab UI; not scored, not telemetered, and not auto-advanced — see `assessment-block-copy.ts` on why the 90 s auto-advance was removed). Advertised to candidates as "כ-25 דקות".

**Why 4 investigation items, not 3.** Independence carries the highest weight, so it must not rest on the fewest data points. Four scenes × 3 sub-answers = 12 scored judgments plus process telemetry; scenes were tightened to 4–5 artifacts so that four of them fit in 10 minutes. The pilot (`TEST_STRATEGY.md` §9) must compute split-half reliability for this block; if it is materially below the reasoning block's, the blueprint weights shift to I 0.25 / T 0.30 **before launch** — that fallback is pre-committed here so it is a data decision, not a debate.

Session wall-clock cap: **75 minutes** from `started_at`. After that the session is `abandoned`; unanswered items count as expired; results are still computed (with low confidence) so the admin sees whatever exists.

### 2.1 Why this order
Speed first: a short, low-stakes warm-up gets the candidate into the rhythm and calibrates the pace before the important material. Reasoning second while fresh. Tech third: its items are short and instinct-driven. Investigation last.

**Known open question — investigation's position.** The original argument here was that investigation belongs *third*, not last, because independence is the hiring manager's most important pillar and should not be measured on a fatigued candidate. That argument was never implemented: the seed blueprint, `BLOCK_ORDER`, `blockKeyForPosition` and the runner have always served tech third and investigation last, while this document and the briefing screen told the candidate the opposite. Round 3 made the docs and the candidate-facing copy tell the truth about what the code does; it did **not** settle which order is actually better. The fatigue argument still stands on its merits and is worth revisiting with pilot data — investigation is now 7:30 of a 19:30 test, so where it sits matters more than it did. Whoever changes it must move the blueprint, `BLOCK_ORDER`, `blockKeyForPosition`, the briefing copy and this table together.

### 2.2 Why these time limits

**The threat model changed, and v1's limits were derived from the old one.** Every v1 limit was set against a *transcription* loop: how long it takes to retype an item into an LLM and read the answer back. A candidate with a phone camera and a multimodal assistant transcribes nothing. The real loop is: raise phone → photograph → send → read → click.

| Step | Fast | Typical | Slow |
|---|---|---|---|
| Raise, frame, shoot (one photo captures a whole non-investigation item) | 3 s | 4 s | 5 s, +4 s per extra photo |
| Send + upload | 1 s | 2 s | 2 s |
| Model returns a usable answer | 4 s | 10 s | 25–60 s (multi-step deduction, or a reasoning model) |
| Read answer, map to option, click | 3 s | 4 s | 6 s; typed string +5–10 s; 5 dropdowns +15 s |
| **Total round trip** | **≈ 11–12 s** | **≈ 20 s** | **≈ 40–80 s** |

Consequences, stated plainly:
- **≤ 15 s**: the loop fails except by luck. This is the only band where *timing alone* is a defense.
- **30 s**: the typical loop fits. Only items where the model must genuinely compute resist, and only weakly. **No item in the bank is above this** — a client constraint (`DECISIONS_LOG.md` #22), and the right one: at 30 s the loop is at least *expensive*, and every second above it is free for a cheater.
- **60–75 s** (v1 reasoning and tech): every single-screen item in the bank was beatable with time to spare.
- **150–180 s multi-tab**: 2–3 photos ≈ 60–90 s. Beatable, but it costs the candidate half their budget and leaves a visible tab-open trace.

**Two v1 arguments are now retired as false.** (1) "Grids and diagrams are inline SVG, so they resist externalization" — a photo captures the grid and all six option tiles at once; SVG defeats copy-paste, not a camera. (2) "Options are labelled א/ב/ג/ד so an LLM answer like 'B' doesn't map trivially" — the labels are in the photo. Both remain worth keeping as cheap friction against the *copy-paste* loop, but neither is load-bearing.

**The honest limit of the approach: no item that a strong human needs more than ~15 s to think about can be made photo-proof by its clock.** Reasoning and investigation therefore do not try. They rest on transfer cost (typed answers, five-dropdown orderings, evidence spread across tabs the candidate has not opened yet), on item count so no single externalized item is worth much, on the telemetry in `ANTI_CHEATING.md` §5, on the open declaration to candidates (§2.5), and on the interview.

| Item type | Strong candidate needs | Photo loop needs | Limit |
|---|---|---|---|
| Speed micro-item (one glance, one fact) | 5–10 s | ≥ 11 s at its fastest | **15 s** |
| Reasoning (sequence/constraints/trace; fast-tier shapes only) | 15–30 s | 20–50 s | **30 s** |
| Tech scenario (≤ 250-char prompt + 4 short options) | 15–25 s | ≈ 20–25 s | **30 s** |
| Investigation (4–5 artifacts across tabs, 3 sub-answers) | 70–110 s (measured artifact sizes) | 60–90 s, 2–3 photos | **150 s** |

Where a family could not honestly meet its new limit, the family changed rather than the limit: `reasoning.constraints_seating` is fixed at 4 entities (the n=5 shape needs 45–60 s of real deduction), `reasoning.table_must_be_true` scales d3 through compound predicates instead of a 9-row table, `reasoning.state_machine` caps at 6 events, and the speed families were trimmed (`json_diff` 4 keys, `count_matches` 6 lines, `table_lookup` 5 rows, `bracket_balance` ≤ 5 pairs). **Nothing with a typed answer goes below 30 s, and investigation is not cut below 150 s before the non-native-reader pilot** (`TEST_STRATEGY.md` §9).

**Known gap at 30 s — the tech block's reading load.** Several tech families still render ~350-character prompts with four ~90-character options that each carry their own justification clause (`tech.log_root_cause`, `tech.cloud_waste`, `tech.http_status_next`, `tech.env_diff_bug`). That is ~700 characters of Hebrew: roughly 40 s of honest reading, against a 30 s limit. The limit is correct and the *text* is what must give — capping prompts at 250 characters and options at 60 with no justification clause (which also removes the "pick the hedged option" shortcut a test-wise candidate can use without reading the artifact). Until that pass lands, expect elevated expiries on those four families in the pilot; they are the first thing to look at, not the limit.

The limits are tight but honest: pilot targets in `TEST_STRATEGY.md` §9 require that ≥ 70 % of a reference group of strong students finish each item type with ≥ 15 % time left, **and** that the investigation block's margin holds for non-native Hebrew readers in the pilot group (the pilot must include at least three). If the pilot violates either, the limit is raised in the blueprint (a data change, not a code change). The blueprint is the single source of truth for every limit; `0013_blueprint_v2_fast_items.sql` is what ships (`DATA_MODEL.md` §3.3). The pilot matters more under v2 than it did under v1, because v2's margins are genuinely thinner — the 15 s speed limit in particular is set at the photo loop's own floor, and it is the first number to revisit (to 18 s, not back to 20 s) if strong students are expiring. Post-launch, the sweep's "expiry among strong candidates" invariant check (`ARCHITECTURE.md` §10) is the ongoing guard that the timer, not ability, has become the binding constraint for the best candidates. Accepted residual risk: a genuinely brilliant but very deliberate thinker can be under-measured by strict timing; this is the price of the anti-LLM constraint and is mitigated, not eliminated, by the margins above and by the human interview.

### 2.3 Navigation rules
- One item visible at a time. The **next item is only served after the current one is finalized** (answered, skipped, or expired).
- No "back". The UI does not show a list of items. A progress bar shows block + position.
- "דלג/י" (skip) is always available. Skipping is never penalized beyond scoring 0 — it is the honest alternative to guessing, and it is a behavioral signal in the speed block (see `SCORING.md`).
- Timer is shown as a shrinking bar plus mm:ss; the last 10 s turn amber. At 0 the client auto-submits whatever is selected (a selected-but-unsubmitted answer **is** submitted; nothing selected = expired).
- Refresh, tab close, network drop: `GET /api/assessment/current` returns the same item with the original `deadline_at`. The candidate loses nothing except the seconds that elapsed. See `ARCHITECTURE.md` §5.2.
- Between blocks: intro screen with the block's rules and time-per-item. Untimed for the candidate's benefit but auto-advances after 45 s so the wall clock can't be gamed.

### 2.4 Anti-externalization rendering rules (apply to all items)

All of these defeat the **copy-paste** loop. None of them defeat a camera (§2.2) — they are kept because they are free and they cost an honest candidate nothing, not because they are load-bearing.

- Grids, sequences of shapes, state diagrams are rendered as **inline SVG**, never text; SVG text uses `<text>` elements with `pointer-events: none` and `user-select: none`. *(Stops selection and clean transcription. A photo reads them fine — do not count this as protection.)*
- Tables/logs/artifacts render with `user-select: none` and a `copy` handler that cancels the copy and logs an event.
- Right-click context menu disabled inside the item pane (logged if attempted).
- Option order is shuffled per session, so a leaked "the answer is the third one" is worthless. *(Option labels are א/ב/ג/ד, which was once justified as stopping an LLM's "B" from mapping trivially; the labels are in the photo, so that argument no longer holds and the shuffle is the part that still earns its place.)*
- Every numeric/name/timestamp in an item is a generated parameter, so a leaked question is worthless.

### 2.5 Telling the candidate (the declaration)

The tight limits are stated openly, on the briefing screen and again on every block intro, in `AI_DECLARATION_HE` (`src/lib/assessment-block-copy.ts`):

> מהיר בכוונה. עובדים עם הראש, לא עם אפליקציה — זה בדיוק מה שאנחנו רוצים לראות.

Why say it at all, rather than quietly relying on the clock:

1. **It is the intervention with the best cost/benefit.** A candidate weighing whether to reach for their phone is making a time calculation. Telling them plainly that the round trip costs more than it saves settles that calculation before they waste 20 seconds discovering it on item 3 — which is a real risk to an *honest* candidate's score under v2's limits.
2. **It makes the timing legible rather than cruel.** 15 seconds with no explanation reads as an arbitrarily hostile test. 15 seconds with "fast on purpose, we want to see how *you* think" reads as a design choice, which is what it is.
3. **It is the only honest version of a claim we were already making.** v1's briefing told candidates that AI tools "simply don't help in the time given" (`השאלות בנויות כך שהם פשוט לא עוזרים בזמן הנתון`). At 60–180 s that was false. The declaration replaces a false claim with a true one.

It is deliberately **not** a threat and **not** a monitoring notice: it never accuses, never mentions what is recorded, and is kept separate from the `assessment_monitoring_v1` disclosure (`ANTI_CHEATING.md` §2), which is about what we store. One is about intent; the other is about data.

## 3. The four pillars — measurement design and worked examples

All examples below are **real generated instances** of templates in the bank, shown exactly as a candidate would see them (Hebrew, RTL, technical tokens in LTR). Correct answers are marked for the reader only.

**Rule for every template — "the convention is in the item".** The assessment must not re-measure prior industry exposure (an internship where someone saw a `429`, a networks course that covered CIDR). So any item whose answer depends on a convention, protocol semantic, or tool behavior **states that convention inside the item or its artifacts** (a one-line doc excerpt, a legend, a rule), and the question tests reasoning *with* that fact, not recall *of* it. What remains "instinct" is knowing what to do with the fact. Each template declares `conventions_stated: true` with the text it embeds; the bank audit (§4.4) fails a template that references a named protocol/tool behavior without an embedded statement. Templates whose answer is derivable from the artifact alone (`env_diff_bug`, `sql_outcome`, `log_root_cause`) declare `conventions_stated: 'n/a'`.

### 3.1 Speed / cognitive execution — block "חימום מהיר"

**What it measures.** Fast, accurate reading of small technical artifacts and micro-decisions. It rewards *accurate* speed: the speed score is computed only from correct answers, and accuracy below 60 % caps the speed score (see `SCORING.md`). Wrong answers cost more than skips.

**Item families (12 templates, 15 s each):**

| template_id | Task | Parameter space (variants) |
|---|---|---|
| `speed.json_diff` | Two 5-key JSON objects; which key's value differs? | keys × values × position ≈ 20k |
| `speed.table_lookup` | 6-row table; value of column Y where id = X | ≈ 50k |
| `speed.count_matches` | 8-line log; how many lines are `ERROR`/`WARN`/specific service? | ≈ 30k |
| `speed.path_resolve` | Resolve `/a/b/../c/./d`; the item states the two rules (`..` = up one folder, `.` = same folder) | ≈ 5k |
| `speed.bool_logic` | Value of `(A && !B) || C` given A,B,C and a one-line legend (`&&` and, `\|\|` or, `!` not) | 8 × 6 shapes = 48 (used at most once/session) |
| `speed.sorted_which` | Which of 4 lists is sorted ascending? | ≈ 10k |
| `speed.timezone_shift` | 09:00 UTC is what time in Israel (offset given in item)? | ≈ 300 |
| `speed.percent_change` | From 240 to 300 = +?% | ≈ 2k |
| `speed.units_math` | 3 servers × 250 ms each in parallel/serial → total? (item defines parallel/serial) | ≈ 3k |
| `speed.bracket_balance` | Is this bracket/quote sequence balanced? If not, which position breaks it? (replaces a binary-conversion item that rewarded a specific course); capped at 5 pairs for the 15 s limit | ≈ 4k |
| `speed.smell_the_number` | Four one-line dashboard metrics, exactly one internally impossible (more successes than attempts, an average above its own maximum, rows in a 0-byte file) — which? | ≈ 20k |
| `speed.log_gap` | 6-line timestamped log with one conspicuous pause; between which two lines did the most time pass? | ≈ 30k |

Each session draws 10 distinct families out of 12, so two candidates share the same *family set* with probability ≈ 1/66 and the same *content* with probability ≈ 0. Round 3 narrowed this pool deliberately: `speed.ip_valid` and `speed.regex_match` (both tagged `fluency: true`) plus `speed.odd_one_out` and `speed.date_diff` were retired as off-target — they measured CS-course fluency or category vocabulary rather than processing speed — and `speed.smell_the_number` and `speed.log_gap` were added in their place. Family-set variety is now thin, and **restoring the pool to ~14 with more short, photo-resistant families is the highest-value follow-up in this block**; content collision (the property that actually matters) is unaffected. `path_resolve` remains tagged `fluency: true`, and the bank-analytics page still separates its contribution to Speed variance.

**Worked example 1 — `speed.count_matches`**

> בכמה מהשורות הבאות מופיע `ERROR` של השירות `billing`?
>
> ```
> 12:01:03 INFO  auth     login ok user=4412
> 12:01:04 ERROR billing  charge failed order=88213
> 12:01:04 WARN  billing  retry scheduled order=88213
> 12:01:06 ERROR auth     token expired user=4412
> 12:01:07 ERROR billing  charge failed order=88214
> 12:01:09 INFO  billing  charge ok order=88215
> 12:01:11 ERROR billing  webhook timeout order=88214
> 12:01:12 WARN  auth     rate limit user=9001
> ```
>
> א. 2  ב. 3 ✔  ג. 4  ד. 5

**Worked example 2 — `speed.path_resolve`**

> בנתיבי קבצים, `..` פירושו "תיקייה אחת למעלה" ו-`.` פירושו "אותה תיקייה".
> מה הנתיב המלא שמתקבל מ־`/srv/app/logs/../config/./env/../prod.yaml`?
>
> א. `/srv/app/config/prod.yaml` ✔  ב. `/srv/app/logs/config/prod.yaml`  ג. `/srv/app/config/env/prod.yaml`  ד. `/srv/config/prod.yaml`

### 3.2 General reasoning — block "חשיבה"

**What it measures.** Inducing rules from examples, deduction under constraints, tracking state, combining information from a small table. Language-free where possible (SVG grids), otherwise minimal Hebrew. We do not claim an IQ measure; the admin UI calls it "חשיבה והסקה".

**Item families (11 templates, 30 s each, difficulty 1–3 with per-session mix 2/4/2):**

| template_id | Task | Kind | Variants |
|---|---|---|---|
| `reasoning.rule_induction` | Black-box function: 4 input→output pairs, predict 5th (rules composed from a library of 18 primitives: reverse, +k, ×k, take-evens, rotate…) | numeric / short_text | ≈ 15k |
| `reasoning.seq_numeric` | Sequence with a two-rule composition (alternating, second-order) | numeric | ≈ 20k |
| `reasoning.grid_pattern` | 3×3 SVG matrix with 2–3 varying attributes (shape, count, fill, rotation); pick missing cell | single choice (SVG options) | ≈ 100k |
| `reasoning.constraints_seating` | 4–5 entities, 3–4 constraints; which assignment is forced? | single choice | ≈ 30k |
| `reasoning.state_machine` | SVG state diagram (4 states, 5 transitions) + event sequence of 5–7 → final state | single choice | ≈ 40k |
| `reasoning.table_must_be_true` | 6-row table; which of 4 statements *must* be true? | single choice | ≈ 20k |
| `reasoning.ordering_clues` | Reconstruct order of 5 events from 4 partial clues | ordering (drag or numbered select) | ≈ 10k |
| `reasoning.cipher_rule` | Two encoded examples reveal a transformation; encode a third | short_text | ≈ 8k |
| `reasoning.pseudocode_trace` | 6-line language-neutral loop; what is printed? | numeric / short_text | ≈ 25k |
| `reasoning.set_counts` | "Of 40 tickets, 22 are bugs, 18 urgent, 9 both…" how many neither? | numeric | ≈ 5k |
| `reasoning.min_moves` | Small optimization: minimal steps/cost under 2 rules | numeric | ≈ 4k |

**Worked example 3 — `reasoning.rule_induction` (difficulty 2)**

> לפניכם פונקציה "קופסה שחורה". אלה ארבע דוגמאות של קלט ופלט:
>
> | קלט | פלט |
> |---|---|
> | `[3, 8, 1]` | `[2, 7, 0]` |
> | `[10, 4]` | `[9, 3]` |
> | `[5, 5, 5, 5]` | `[4, 4, 4, 4]` |
> | `[12]` | `[11]` |
>
> מה הפלט עבור הקלט `[7, 2, 9]`?
>
> תשובה (מספרים מופרדים בפסיק): `[6, 1, 8]` ✔

(Generated rule: `map(x → x − 1)`. Difficulty 3 composes two primitives, e.g. `reverse ∘ map(×2)`, and shows one pair where the composition is disambiguating.)

**Worked example 4 — `reasoning.state_machine` (difficulty 2)**

> במערכת ניהול משימות יש ארבעה מצבים. הדיאגרמה מציגה את המעברים המותרים (חץ = אירוע). *(SVG diagram: `Open → assign → InProgress`, `InProgress → block → Blocked`, `Blocked → unblock → InProgress`, `InProgress → finish → Done`, `Done → reopen → Open`. Any event not drawn from the current state is ignored.)*
>
> משימה מתחילה במצב `Open`. מתרחשים לפי הסדר האירועים: `assign, block, finish, unblock, finish, reopen, block`.
>
> באיזה מצב המשימה בסוף?
>
> א. `InProgress`  ב. `Blocked`  ג. `Done`  ד. `Open` ✔

(Trace: Open→InProgress→Blocked→(finish ignored)→InProgress→Done→Open→(block ignored)→Open.)

**Worked example 5 — `reasoning.grid_pattern` (difficulty 3)** — rendered as SVG. Rows vary shape (circle/square/triangle), columns vary count (1/2/3), and fill alternates by diagonal. The 9th cell is missing; six candidate cells are shown as SVG options; exactly one satisfies all three rules. Generator guarantees uniqueness of the correct option by construction (each distractor violates exactly one rule).

### 3.3 Independence — block "חקירה"

**What it measures.** This is the pillar the hiring manager cares about most, and it is the one that cannot be measured by asking "are you independent?". We measure it by giving the candidate an **under-specified operational problem with real artifacts** (a ticket, logs, a config screen, an API doc excerpt, a chat thread, a DB table) spread across tabs, and observing: (a) did they find the root cause; (b) did they choose the right next action; (c) could they extract a concrete fact from the evidence; and (d) **how they worked** — which artifacts they opened, in what order, whether they answered before looking at anything, and whether they used the whole space.

An investigation item is a scene with **4–5 artifact tabs** (one of which is always a decoy) and **3 sub-questions** answered on one panel with one submit:

1. **שורש הבעיה** — single choice, 5 options (one correct, two plausible-but-refuted-by-evidence, two surface-level).
2. **הפעולה הראשונה שלך עכשיו** — single choice, 4 options. The correct option is always the *cheapest reversible evidence-based step available to someone in the candidate's position*. The three distractors are drawn per instance from a rotating pool of anti-patterns, so no single "trick" is stable across a session or across candidates:
   - escalate without evidence ("לשאול את המנהל מה לעשות")
   - drastic irreversible action (rollback everything, disable the integration, delete the resource)
   - treat the symptom (re-run the job, ask users to retry, restart the server)
   - fix the decoy anomaly
   - wait and see / "it will probably resolve itself"
   - gather more data that the artifacts already provide (busywork)

   **Escalation is sometimes correct.** In scenario variants where the evidence-based fix requires authority or money the candidate does not have (deleting a production resource, paying for a plan upgrade, rotating a shared secret owned by another team, a security incident), the correct option is "לדווח ל-X עם הראיות והצעת תיקון" — escalation *with* evidence and a proposal. "לשאול את המנהל מה לעשות" (escalation *without* a proposal) remains a distractor in those instances. The discrimination the block is after is exactly this: candidates who bring a finding and a plan versus candidates who bring a question. Across a session, at least one of the four scenes has escalation-with-proposal as the correct answer and at least one has the no-evidence escalation as a distractor; the generator enforces this.
3. **חילוץ עובדה** — short text with an exact, normalizable answer that only appears in the correct artifact (an order id, a timestamp, a domain, a config value).

Scenes are graded for headroom at the top: each scenario has at least one **hard variant** (difficulty 3) in which two artifacts point at different plausible causes and only a third artifact (a timestamp comparison, a version, a quota number) settles it; the "one obvious clue next to a chatty Slack message" shape shown in worked example 6 is a difficulty-1 variant. The per-session mix is 1 × d1, 2 × d2, 1 × d3.

**Scenario library (12 scenarios × 3 root-cause variants each × parameterized names/values/timestamps/decoys = 36 distinct stories at launch):**

| scenario_id | Situation (ticket) | Cause variants | Artifacts |
|---|---|---|---|
| `investigate.webhook_missing` | Orders from the online store stopped appearing in the CRM since yesterday | (a) webhook secret rotated on store side, signature check fails; (b) endpoint URL changed in a deploy; (c) CRM API key expired | ticket, integration log, webhook settings screen, API doc excerpt, deploy notes, chat thread |
| `investigate.sso_login_subset` | Some employees can't log in to a SaaS since Monday | (a) new email domain not in IdP allowed list; (b) group mapping renamed; (c) MFA enforcement for a group | ticket, user table with domains, IdP config, auth error log, chat |
| `investigate.nightly_report_empty` | Nightly report has been empty for 3 days | (a) cron timezone vs. data timezone window; (b) source table renamed; (c) API pagination change returns 1 page | ticket, cron config, report SQL, sample data rows, job log |
| `investigate.cloud_bill_spike` | Cloud bill tripled this month | (a) dev env with autoscale left on; (b) storage egress from a public bucket; (c) forgotten load test | ticket, billing breakdown, instance list, autoscale config, deploy/activity log |
| `investigate.export_permission` | A user can't export a report others can | (a) role missing one permission; (b) feature flag by org; (c) user in the wrong group | ticket, role matrix, user record, feature flags, audit log |
| `investigate.sync_rate_limited` | Data sync fails every afternoon | (a) API daily quota exhausted by a second job; (b) burst limit from parallelism; (c) token refresh at 15:00 | ticket, API limits doc, job schedules, log with timestamps, config |
| `investigate.duplicate_submissions` | Duplicate form submissions in DB | (a) client retry on timeout without idempotency; (b) two webhook subscriptions; (c) double-click without disable | ticket, frontend snippet, server log, network log, DB rows |
| `investigate.email_undelivered` | New domain's emails bounce | (a) the provider's domain-verification check shows `FAIL` for a DNS record the provider's own doc excerpt (in the artifact) says is required; (b) wrong sending domain in template; (c) recipient on the provider's suppression list | ticket, provider verification screen **with its doc excerpt**, DNS records, template config, bounce log |
| `investigate.cert_expired_subdomain` | One subdomain shows a browser security error since this morning | (a) certificate for that subdomain expired (expiry date in the artifact); (b) DNS points the subdomain at an old server; (c) redirect loop from a new rule | ticket, certificate details screen, DNS table, proxy rules, browser error text |
| `investigate.backup_silently_failing` | Restore test found the last good backup is 3 weeks old | (a) backup job's target bucket became full (quota numbers in artifact); (b) credentials rotated, job "succeeds" but writes 0 bytes; (c) schedule was edited to a day that doesn't exist (31st) | ticket, job run history with sizes, bucket usage, credentials audit, schedule config |
| `investigate.saas_seat_limit` | New employees can't be added to a SaaS tool | (a) seat limit reached — counts in the artifact; (b) new users' email domain not allowed; (c) invitations expire after 7 days and were sent 9 days ago | ticket, plan/usage screen, user list, invitation log, admin chat |
| `investigate.import_garbled_names` | Customer names import with wrong characters | (a) file encoding mismatch (the import screen shows the selected encoding and a sample); (b) column shift because a comma inside a name; (c) template mapped first/last name reversed | ticket, sample CSV rows, import settings, preview table, mapping config |

Every artifact set contains at least **one decoy anomaly** (something odd but irrelevant) so that "pick the first weird thing" is not enough. Every root-cause variant modifies the artifacts consistently (the generator builds the world from the cause, then renders artifacts from the world), so the item is always solvable and never contradictory. Every scenario declares which artifact is *decisive* for each variant (used by process scoring, `SCORING.md` §3.3).

### 3.3.1 Exposure over a hiring round — accepted risk and mitigation
Surface parameters make copying an item worthless, but they do not stop a classmate from describing the *shape* of a scene on WhatsApp ("it was the webhook secret thing"). This is a real, accepted residual risk in a small connected population. Mitigations, in force at launch:
1. **Pool size and variants**: 12 scenarios × 3 causes = 36 stories; knowing the scenario still leaves three causes to distinguish from evidence, a fact to extract, and a rotating next-action option set.
2. **Trick rotation** (above): no stable elimination heuristic exists for sub-question 2.
3. **Cohort-balanced selection**: the generator draws scenes so that scenario usage is balanced across a job's sessions (stratified by `assessment_items.template_id` counts at generation time), so no scenario is over-represented early in a round.
4. **Leakage detection**: the hourly sweep computes per-scenario accuracy for the first 50 vs. the most recent 50 servings within a job; a rise > 25 points raises an admin banner and a Sentry warning (`ARCHITECTURE.md` §10). The hiring manager then knows to discount that scene in this round.
5. **Cheap growth path**: a new scenario is ~1 developer-day (world builder + 3 variants + tests). Recommendation, not requirement: before any round expected to exceed ~300 candidates, add ≥ 4 scenarios. This is optional product work, not maintenance the system needs to keep running.

The same logic applies at smaller scale to `reasoning.rule_induction`'s 18 primitives and the tech families' "morals". The raw variant counts quoted in §4.3 support the *content-collision* claim only — they are not a claim of resistance to preparation.

**Worked example 6 — `investigate.webhook_missing`, variant (a)**

> **כרטיס תמיכה #4821** — "מאתמול בערב הזמנות מהחנות לא מגיעות ל-CRM. הלקוחות משלמים, אבל אין רשומה. דחוף."
>
> *Tabs:* `כרטיס` · `Logs – integration` · `Webhook settings (Store)` · `API docs – Store webhooks` · `Deploy notes` (decoy) — *(difficulty-1 variant)*
>
> **Logs – integration** (LTR block)
> ```
> 2026-09-03 18:42:11  POST /webhooks/store  200  order=A-77310  sig=ok
> 2026-09-03 19:05:37  POST /webhooks/store  200  order=A-77311  sig=ok
> 2026-09-03 21:14:02  POST /webhooks/store  401  order=A-77312  sig=invalid
> 2026-09-03 21:14:09  POST /webhooks/store  401  order=A-77312  sig=invalid (retry 1)
> 2026-09-03 22:30:55  POST /webhooks/store  401  order=A-77313  sig=invalid
> 2026-09-04 08:10:20  GET  /health           200
> ```
> **Webhook settings (Store)**: Endpoint `https://crm-bridge.example.co.il/webhooks/store` · Status: Active · Signing secret: `whsec_…c91f` · Last rotated: **2026-09-03 21:02** by `dana@…`
> **API docs excerpt**: "Each request carries `X-Store-Signature`, an HMAC-SHA256 of the body using your current signing secret. Rotating the secret invalidates the previous one immediately."
> **Deploy notes**: "2026-09-02 – bumped Node to 22, no config changes." (decoy) · "יוסי: ה-health של הגשר ירוק" (ticket comment)
>
> **1. מה שורש הבעיה?**
> א. השרת של גשר ה-CRM נפל ולא עלה
> ב. ה-secret לחתימת ה-webhook הוחלף בצד החנות, והגשר עדיין מאמת עם הישן ✔
> ג. שדרוג ה-Node שבר את ניתוח ה-JSON
> ד. ה-endpoint שגוי בהגדרות החנות
> ה. החנות הפסיקה לשלוח webhooks
>
> **2. מה הפעולה הראשונה שלך עכשיו?** *(this instance drew distractors: irreversible action, symptom treatment, busywork)*
> א. לעדכן את ה-secret החדש בהגדרות הגשר ולוודא שההזמנה הבאה מתקבלת ב-200 ✔
> ב. לעשות rollback לשדרוג ה-Node
> ג. לבקש מהחנות לשלוח מחדש את כל ההזמנות מאתמול
> ד. להוריד את כל ה-Logs של השבוע ולעבור עליהם לפני שנוגעים במשהו
>
> **3. מה מספר ההזמנה הראשונה שנכשלה?** `A-77312` ✔

In the difficulty-3 variant of the same scenario, the "Last rotated" line is absent from the settings screen and appears only in an audit-log artifact with a timestamp in a different timezone than the log (both stated), and a second plausible cause (an endpoint URL change in the deploy notes) is refuted only by noticing the 401s carry `sig=invalid` rather than 404s.

**Process signal captured for this item** (feeds Independence, see `SCORING.md` §3.3): ordered list of artifacts opened with dwell time, time to first artifact open, whether the decisive artifact was opened (with ≥ 3 s dwell) before submit, how many opens it took to reach it, whether an answer was selected before any artifact was opened, number of answer changes. The process score rewards **reaching the right evidence efficiently**, not opening everything.

### 3.4 Technology aptitude — block "אינסטינקט טכנולוגי"

**What it measures.** Instinct about how systems behave and what a sensible operator does — not recall. Each item presents a small concrete situation (a log, an API response, a permissions table, a config diff, a spreadsheet) and asks for the most likely explanation or the best next move. Options are written so that the wrong ones are things people actually do wrong.

**Item families (12 templates, 30 s each, mix 2/4/2 by difficulty):**

| template_id | Situation → question | Variants |
|---|---|---|
| `tech.log_root_cause` | 6-line log with one causal chain and one red herring → most likely cause | ≈ 8k |
| `tech.http_status_next` | API response with a body snippet **plus the provider's 3-line doc excerpt for that status** → correct next action (reasoning with the stated semantics) | ≈ 2k |
| `tech.minimal_access` | A permission matrix (what each role can do) + a described task → the smallest grant that gets the task done; the item never assumes prior RBAC vocabulary | ≈ 3k |
| `tech.sql_outcome` | 8-row table + short `SELECT … WHERE … GROUP BY` → result count / value | ≈ 20k |
| `tech.env_diff_bug` | `.env` for staging vs prod with one meaningful difference + one harmless → why prod fails | ≈ 5k |
| `tech.webhook_vs_polling` | Integration need → best mechanism (webhook, polling interval, batch export) and why | ≈ 1k |
| `tech.site_down_first_check` | Symptom set (DNS/TLS/5xx/timeout) → the first cheap check | ≈ 2k |
| `tech.automation_pick` | Repetitive manual task described → most appropriate automation shape (scheduled script / no-code flow / native feature / not worth automating) | ≈ 1.5k |
| `tech.cloud_waste` | Resource list with usage → which change saves most without risk | ≈ 3k |
| `tech.security_smell` | 4 practices, one dangerous (key in frontend, shared admin account, open bucket, no MFA on root) | ≈ 800 |
| `tech.api_pagination_math` | Doc excerpt (page size, rate limit) + record count → number of calls / minimum time | ≈ 5k |
| `tech.field_mapping_error` | Two systems' field lists + proposed mapping → the wrong mapping | ≈ 4k |

**Worked example 7 — `tech.env_diff_bug`**

> האפליקציה עובדת ב-staging ונכשלת ב-production עם השגיאה `connect ETIMEDOUT` בעת פנייה למסד הנתונים. אלה קובצי הסביבה (ערכים סודיים הוסתרו):
>
> ```
> # staging
> DATABASE_URL=postgres://app:***@db-stg.internal:5432/app
> DB_POOL_SIZE=5
> LOG_LEVEL=debug
> ALLOWED_ORIGIN=https://stg.example.co.il
>
> # production
> DATABASE_URL=postgres://app:***@db-prod.internal:5433/app
> DB_POOL_SIZE=5
> LOG_LEVEL=info
> ALLOWED_ORIGIN=https://app.example.co.il
> ```
>
> מה ההסבר הסביר ביותר?
>
> א. `LOG_LEVEL=info` מסתיר את השגיאה האמיתית
> ב. הפורט של מסד הנתונים ב-production שונה (5433) — כנראה שגיאת הקלדה או שהחומה (firewall) לא פותחת אותו ✔
> ג. `ALLOWED_ORIGIN` שונה ולכן הדפדפן חוסם את הבקשה
> ד. `DB_POOL_SIZE=5` קטן מדי ל-production

**Worked example 8 — `tech.http_status_next`**

> סקריפט סנכרון שרץ כל שעה מתחיל לקבל מה-API של ספק SaaS את התשובה:
>
> ```
> HTTP/1.1 429 Too Many Requests
> Retry-After: 120
> {"error":"rate_limited","limit":"1000/hour","reset":"2026-09-04T15:00:00Z"}
> ```
>
> מתוך התיעוד של הספק: "קוד 429 מוחזר כשחשבון חרג ממכסת הבקשות. `Retry-After` הוא מספר השניות עד שאפשר לנסות שוב. המכסה משותפת לכל המפתחות של אותו חשבון."
>
> מה הפעולה הנכונה?
>
> א. להריץ את הסקריפט מחדש מיד, כנראה תקלה זמנית
> ב. לבקש מהספק מפתח API נוסף ולפצל את הבקשות
> ג. לכבד את `Retry-After`, להוסיף backoff, ולבדוק אם יש תהליך נוסף שצורך את אותה מכסה ✔
> ד. לעבור ל-polling כל 10 דקות במקום כל שעה

### 3.5 Technology knowledge — block "ידע טכנולוגי"

**What it measures.** Whether this person has actually been around technology. Not reasoning, not speed — recall. Twelve families, 10 items per session, 15 s each.

**This block deliberately breaks §3's central rule** ("the convention is in the item"), which exists so the assessment never re-measures prior exposure. Here prior exposure *is* the measurement, on the client's explicit instruction (`DECISIONS_LOG.md` #25). Two things keep it defensible:

1. **The terms are general, not insider.** What DNS is, what a `.csv` holds, which IP address is well-formed, what `git commit` does. These are things anyone genuinely curious about technology picks up on their own; they are not what a particular internship or a particular course teaches. Deep protocol semantics stay in the tech block, where the item states them.
2. **The clock is the only anti-externalization defense this block has, so it is set at the floor.** A recall question is precisely what a phone LLM answers best and fastest — there is nothing to compute and nothing to navigate. What saves it is the asymmetry at 15 s: someone who knows answers in ~3 s, while the photo round trip needs 11–12 s at its absolute best (§2.2). **Raising this limit to 20–25 s gives the block away**, which is why it is 15 s despite the client's general "20–25 s" guidance.

Accepted cost, stated plainly: this block will systematically favor candidates who have been around technology longer, and that is a real narrowing of who scores well. It is the client's call, it is a legitimate thing to hire for in this role, and it is bounded — the block is 10 of 37 items inside a pillar worth 0.25.

| template_id | Task | Pool |
|---|---|---|
| `knowledge.what_is` | "מה זה X?" over general technology vocabulary (DNS, API, cache, webhook, uptime…) | 24 terms |
| `knowledge.http_status` | What a common status code means (200/301/400/401/403/404/500/503) | 8 |
| `knowledge.file_type` | What a given extension holds (`.csv`, `.json`, `.env`, `.log`, `.sql`…) | 8 |
| `knowledge.tool_purpose` | What a widely-used tool is for (Git, Docker, PostgreSQL, Postman, Terraform…) | 10 |
| `knowledge.command_purpose` | What a basic command does (`git commit`, `ls`, `ping`, `grep`, `curl`…) | 8 |
| `knowledge.url_parts` | Which part of a generated URL is the protocol / subdomain / domain / path / query — the item that surfaces whether `www` is understood as one subdomain among many | ≈ 5k |
| `knowledge.ip_valid` | Which of four is a valid IPv4 address (no rule stated — knowing the shape is the point) | ≈ 4k |
| `knowledge.format_valid` | Which value is well-formed: email, port, hex colour, MAC, ISO date | ≈ 3k |
| `knowledge.json_valid` | Which snippet is valid JSON; distractors are the mistakes people actually make | ≈ 2k |
| `knowledge.units_bigger` | Which quantity is largest (GB/MB/KB, hours/minutes/ms) | ≈ 3k |
| `knowledge.odd_one_out` | Three members of a real technology family plus one outsider (browsers, databases, cloud providers…) | 8 categories |
| `knowledge.spot_syntax_error` | Four one-line snippets, one with a syntax error that is wrong in any language | ≈ 2k |

Every family renders four options of the same *shape*, so the answer can never be found by comparing lengths — the bank audit's longest-option gate (§4.4) caught exactly that in `knowledge.json_valid`'s first version, where the valid object had two key-value pairs and several distractors had one.

### 3.6 Independence signals outside the investigation block
Two lightweight signals are also collected across all blocks and folded into Independence at low weight (`SCORING.md` §4.3):
- Skip-vs-guess discipline: skipping an item they clearly could not do (vs. random guessing) — measured as guess rate on items answered in < 25 % of the time with wrong answers.
- Use of the one on-page help affordance: each block intro has a collapsed "איך זה עובד" panel. Whether they open it is *not* scored (both behaviors are fine); it is shown to the admin as context only.

## 4. Content generation strategy (no runtime LLM, no maintenance)

### 4.1 Templates as code
Each template is a TypeScript module exporting:

```ts
export const template: ItemTemplate = {
  id: 'tech.env_diff_bug', version: 1, pillar: 'tech', kind: 'single_choice',
  difficulties: [1, 2, 3],
  generate(rng: Rng, difficulty: Difficulty): GeneratedItem { /* pure */ },
  score(answer: unknown, key: AnswerKey): ScoreResult { /* pure */ },
};
```

`generate` draws every parameter from `rng` (SplitMix64 seeded by `session.seed ⊕ hash(template_id, position)`), so the same seed always produces the same item — essential for tests and for the bank audit. `content` (candidate-visible) and `answer_key` (server-only) are stored in `assessment_items` at session start.

### 4.2 Session generation algorithm
```
for each block in blueprint:
  families = templates matching block.pool, filtered by pillar
  choose block.count distinct families (weighted uniform, no repeats within session)
  assign difficulties per block mix (e.g. reasoning 2×1, 3×2, 1×3), shuffled
  for each chosen family: item = family.generate(rng, difficulty); shuffle options with rng
items are numbered 1..N in block order
```
Investigation block: choose 4 distinct scenarios out of 12 with cohort balancing (§3.3.1); choose a cause variant and difficulty per scenario (mix 1/2/1); draw the next-action distractor set with the session-level constraints of §3.3; the generator builds the "world" then renders artifacts.

### 4.3 Bank size and uniqueness
- 12 speed + 12 knowledge + 11 reasoning + 12 tech + 12 investigation = **59 template families**, each with the variant counts above (most ≥ 1,000; total > 500k distinct concrete items).
- Probability two candidates receive the same full assessment is effectively zero; the probability two candidates share even one identical *item* in a 500-candidate round is < 1 % for every family except the intentionally small one (`speed.bool_logic`), which is limited to at most one item per session and carries the least weight.
- These numbers support the **content-collision** claim only. Resistance to preparation/word-of-mouth is a different property, addressed (and its limits stated) in §3.3.1.

### 4.4 Quality gates (run in CI, never at runtime)
`pnpm bank:audit` generates 20,000 sessions and asserts:
- every item has exactly one correct option and `score(key.answer, key) === 1`;
- every distractor scores 0 (or the specified partial credit);
- no two options in an item are textually identical;
- rendered content fits the layout budget (≤ 1,600 characters for non-investigation items; each artifact ≤ 900 characters);
- difficulty mix per block matches the blueprint;
- reasoning grids: the generator's uniqueness proof holds (exactly one option satisfies all rules);
- investigation: the decisive artifact contains the fact for sub-question 3 and no other artifact does; the declared decisive artifact for sub-question 1 exists in the scene; each session satisfies the escalation constraints of §3.3 (≥ 1 scene with escalation-with-proposal correct, ≥ 1 with no-evidence escalation as a distractor);
- `conventions_stated` is declared for every template and, where `true`, the declared text appears verbatim in the rendered content;
- per-scenario usage across 20,000 sessions is balanced within ±10 %.

A snapshot test freezes 50 seeds' rendered content so accidental template changes are visible in review.

### 4.5 Versioning and drift
- Changing a template's text or rules bumps `template.version`. Old sessions keep their stored content and are scored by `assessment_responses.is_correct` computed at answer time, so historical results never change.
- `scoring_version` is stored in `assessment_results`; if scoring math changes, old rows keep their version and the admin list shows a small badge when mixing versions in one job. There is no recompute job; a "recompute results for this job" admin action exists for the rare case it is wanted.

### 4.6 What "no maintenance" means here
Nothing about the bank requires touching after launch. Adding templates or scenarios is optional product work, done as a normal code deploy, gated by `bank:audit`. There is no dashboard for "question health" because there are no human-authored questions to go stale; template-level accuracy statistics are available in the admin bank analytics page (read-only, informative).

## 5. Accessibility and device support
- Desktop-first (≥ 1024 px). On smaller screens the candidate is asked to switch to a computer; the assessment cannot be **started** on a viewport narrower than 900 px (it can be *resumed* on any size so a mid-test window resize doesn't lock someone out). Rationale: investigation items need tabs and logs side-by-side; phone use also correlates with externalization.
- Keyboard: every item is fully operable by keyboard (arrow keys to move between options, Enter to submit, `S` to skip after confirmation).
- Color is never the only carrier of meaning; timer states also change shape/text.
- Font size ≥ 16 px; code blocks in `JetBrains Mono` with Hebrew fallback to `Heebo`.
- Hebrew text is written in modern register: second person plural-neutral forms where natural ("לפניכם", "בחרו"), masculine/feminine slash forms only in imperatives on buttons ("דלג/י", "שלח/י").
