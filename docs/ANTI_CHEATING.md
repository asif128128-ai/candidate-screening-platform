# ANTI-CHEATING AND ASSESSMENT INTEGRITY

Status: **Decided.** What we collect during the assessment, how "מדד אמינות המבחן" (Assessment Integrity Risk) is computed, and what the admin sees. The integrity risk is **always separate** from competence scores and **never** states that a candidate cheated.

## 1. Camera / proctoring decision: **omitted**

Reasons, in priority order:

1. **Weak, unreliable signal.** Without a human reviewer watching the recording, camera streams yield either (a) automated "gaze/face" heuristics that are demonstrably noisy, biased across appearance, lighting and disability, and explicitly forbidden by the requirements (no appearance-based inference), or (b) recordings nobody will watch. The hiring manager does not want to review hundreds of anything.
2. **It does not address the actual threat.** The realistic cheating vector is a second device or a second browser window with an LLM. A laptop camera does not see a phone in the lap. Strict per-item timing plus item design attacks the threat directly (`ASSESSMENT_DESIGN.md` §2.2, §2.4).
3. **Cost and maintenance.** Video storage, retention policy, consent management, bandwidth, and a media pipeline are exactly the kind of moving parts the zero-maintenance requirement excludes.
4. **Friction and privacy.** Camera requirements measurably reduce completion rates among strong candidates who have options, and turn a 30-minute test into a surveillance experience.

What replaces it: timing design that makes externalization slow; item content that is hard to transcribe; behavioral telemetry that reveals *patterns* of externalization; and a human interview for everyone who advances. The architecture leaves a hook (an `integrity_events.kind` namespace and a consent kind) so that if a future need arises, a proctoring module could be added without schema changes — but it is not planned.

## 2. Candidate disclosure (shown in step 3, consent `assessment_monitoring_v1`)

> **שקיפות לגבי ניטור במבחן.** כדי להעריך את אמינות התוצאות, במהלך המבחן נשמרים: זמני תגובה לכל שאלה, אירועי דפדפן כמו יציאה מהחלון או מהמסך המלא, ניסיונות העתקה/הדבקה, שינויי גודל חלון, וכתובת ה-IP. **אין** שימוש במצלמה או במיקרופון, ואין הקלטה של המסך או של ההקלדה. הנתונים האלה משמשים רק כדי לסמן לצוות הגיוס האם התוצאה נראית אמינה — ואף פעם לא כדי לקבוע אוטומטית שמישהו "רימה".

## 3. Telemetry: the closed list of event kinds

All events are inserted into `integrity_events`. Client-side events carry client timestamps corrected by the measured skew; server-side events use `now()`. The client buffers events and flushes them (a) with every answer, (b) via `sendBeacon` on `visibilitychange`→hidden and `pagehide`, (c) on the next `GET /current` after a reload. Buffer cap 200 events; beyond that only counters are kept per kind.

| kind | Source | Payload (`meta`) | Notes |
|---|---|---|---|
| `visibility_hidden` | client | `{item_position}` | `document.visibilitychange` → hidden |
| `visibility_visible` | client | `{item_position, hidden_ms}` | pairs with the previous hidden; `duration_ms` filled |
| `window_blur` / `window_focus` | client | `{item_position, blur_ms}` | catches alt-tab to another window on the same screen (visibility may stay visible) |
| `fullscreen_enter` / `fullscreen_exit` | client | `{item_position}` | fullscreen is requested, not enforced |
| `fullscreen_unavailable` | client | `{ua}` | e.g. iOS Safari |
| `copy_attempt` | client | `{item_position, selection_len}` | copy is cancelled inside the item pane |
| `paste_attempt` | client | `{item_position, len}` | paste is blocked in answer inputs; logged |
| `contextmenu` | client | `{item_position}` | |
| `resize` | client | `{w, h, prev_w, prev_h}` | only when Δ > 15 % (side-by-side window arrangement) |
| `devtools_hint` | client | `{outer_inner_delta}` | `outerWidth-innerWidth > 160` or debugger timing; **low weight**, informative only |
| `keydown_shortcut` | client | `{combo}` | ⌘/Ctrl+Tab, ⌘/Ctrl+C/V, Alt+Tab where observable |
| `input_burst` | client | `{item_position, chars, ms}` | ≥ 12 characters entering a text field within 50 ms (drag-drop / autofill) |
| `first_interaction` | client | `{item_position, ms_since_render}` | stored on the response row too |
| `answer_change` | client | `{item_position, from, to}` | counted on the response row |
| `artifact_open` | client | `{item_position, artifact_key, ms_since_render}` | investigation items only |
| `late_submit` | server | `{late_by_ms}` | received within the 2 s grace |
| `expired` | server | `{item_position}` | deadline passed without answer |
| `instance_conflict` | server | `{prev_instance, new_instance}` | a request with a different `client_instance_id` while another instance was active within the last 30 s (concurrent second device/tab) |
| `instance_new` | server | `{instance, ordinal}` | any new `client_instance_id` seen in the session, regardless of timing (always-on; a reload produces one, a paced device switch produces one too) |
| `server_outage` | server | `{credit_ms, window_start, window_end}` | outage credit applied to this item (`ARCHITECTURE.md` §5.2); an excusal, never a risk signal |
| `telemetry_empty_item` | server | `{item_position}` | an answer arrived with no client events and no `first_interaction_ms` for that item |
| `ip_change` | server | `{from_prefix, to_prefix}` | IP changed mid-session (prefix compared; full IP kept 90 days) |
| `ua_change` | server | `{from, to}` | user agent changed mid-session |
| `clock_anomaly` | server | `{skew_ms, prev_skew_ms}` | client clock skew jumped > 5 s between requests |
| `network_retry` | client | `{item_position, attempts}` | submit retried (used to *excuse* an expiry) |

Deliberately not collected: keystroke content, mouse trajectories, screen recording, camera, microphone, clipboard content, browser history, other tabs' content, precise geolocation.

## 4. Threat model and how each threat is addressed

| Threat | Primary defense | Detection |
|---|---|---|
| Paste item into ChatGPT in another tab | Per-item limits (20/75/60/180 s); SVG rendering; copy cancelled | `visibility_hidden` / `window_blur` spans during the item, especially hidden spans > 8 s followed by a correct answer near the deadline |
| **Script the two JSON endpoints directly with the session cookie** (no browser, LLM solves items, human-plausible delays) | Per-serve `item_token` (must GET the item to answer it); the answer body must reference materialized option ids | This produces **no client telemetry at all** — which a real runner never does. Telemetry-empty items are the primary signal and carry hard floors (§5.3): ≥ 40 % empty items → at least סיכון גבוה. The interview is the final backstop for a candidate who scripts *and* fakes telemetry |
| Second monitor/window side by side | Same limits; investigation items require *navigating* artifacts — the assistant can't see the tabs | `resize` to a narrow viewport at start; `window_blur` without `visibility_hidden`; consistently long `first_interaction` on text-heavy items combined with high accuracy |
| Phone with camera pointed at the screen | Limits; grids/tables are dense; investigation needs interaction | Timing pattern: long idle before first interaction then fast completion; not individually strong — combined signal only |
| Friend takes the test / candidate takes it twice | One application per email+job; OTP re-entry; interview for finalists | `duplicate_phone_of` badge; `ip_change` + `ua_change` mid-session; admin sees multiple applications from the same IP prefix (list filter) |
| Automation (script answering) | Answers must reference materialized options; unknown option ids rejected | Impossible timing: `first_interaction` < 300 ms on multiple items; `response_ms` < 1.5 s on difficulty-3 correct answers |
| Refresh to reset timer | Server-authoritative `served_at` written once (DB trigger prevents change) | n/a — impossible |
| Opening the item in a second tab to pre-read while the first is paused | There is no pause; both tabs see the same deadline | `instance_conflict` |
| Blocking `sendBeacon` / disabling JS events | Server-side signals do not depend on client events; missing telemetry on many items is itself a strong flag with hard floors | `TELEMETRY_GAP` (§5.1, §5.3) |
| Friend takes the test on a second device, paced > 30 s apart | One attempt; interview | `instance_new` is always-on (not window-gated): ≥ 2 distinct instances is a signal; `instance_conflict` additionally marks true concurrency |

## 5. Computing "מדד אמינות המבחן"

`integrity.ts: computeIntegrity(items, responses, events) → { score: 0..100, risk: 'low'|'medium'|'high', reasons: Reason[] }`. Pure function; runs at completion; stored in `assessment_results`. It is **never** input to any competence score.

### 5.1 Signals (each normalized to 0..1, then weighted)

| code | Signal | Normalization | Weight |
|---|---|---|---|
| `HIDDEN_DURING_ITEMS` | Number of items with a **`visibility_hidden`** span ≥ 8 s while the item was live (tab switched / window minimized) | 0 at 0 items, 1 at ≥ 5 items (linear) | 24 |
| `BLUR_DURING_ITEMS` | Number of items with a **blur-only** span ≥ 8 s (window lost focus but stayed visible — second monitor, chat app). Weak evidence on its own; counts fully only when corroborated | 0 at 0, 1 at ≥ 6; multiplied by 0.4 unless at least one other signal is > 0 | 8 |
| `HIDDEN_THEN_CORRECT_LATE` | Items where a hidden **or** blur span ≥ 8 s **and** answer correct **and** submitted in the last 25 % of the time | 0 at 0, 1 at ≥ 3 | 22 |
| `TOTAL_HIDDEN_RATIO` | Σ hidden ms during live items ÷ Σ live time (blur excluded) | 0 at ≤ 3 %, 1 at ≥ 25 % | 8 |
| `COPY_PASTE` | `copy_attempt` + `paste_attempt` + `input_burst` count | 0 at 0, 1 at ≥ 6 | 6 |
| `INSTANCE_OR_DEVICE` | `instance_new` count ≥ 2 (always-on), plus `instance_conflict`, `ip_change`, `ua_change` | 0 / 0.5 (one kind) / 1 (two+ kinds, or any `instance_conflict`) | 10 |
| `IMPOSSIBLE_TIMING` | Difficulty-3 items correct in < 20 % of limit, or `first_interaction` < 300 ms on ≥ 3 items | 0 at 0, 1 at ≥ 3 | 6 |
| `ARTIFACT_BLIND_CORRECT` | Investigation items answered correctly **without opening the decisive artifact** | 0 at 0, 1 at ≥ 2 | 4 |
| `TELEMETRY_GAP` | Share of served items with **zero client events and no `first_interaction_ms`** | 0 at ≤ 5 %, 1 at ≥ 40 % | 12 (+ hard floors, §5.3) |

`score = Σ weight × normalized`. Total possible = 100.

Why `TELEMETRY_GAP` is treated as strong evidence: the runner emits at least `first_interaction` and `answer_change`/`artifact_open` on every item it renders, and flushes them with the answer in the same request. The only ways to produce a run with many telemetry-empty items are (a) driving the JSON endpoints without the runner, or (b) deliberately disabling the runner's event code — both are externalization tooling, not accidents. A single empty item can be a flaky beacon; many cannot. Hence the weight is moderate in the sum but the **floors** below make the gap decisive on its own.

### 5.2 Excusals (applied before scoring)
- A hidden/blur span that overlaps a `network_retry` window or a `server_outage` window is not counted, and an item with `outage_credit_ms > 0` is excluded from `HIDDEN_THEN_CORRECT_LATE` and `IMPOSSIBLE_TIMING`.
- A single `visibility_hidden` ≤ 3 s per block is ignored (notifications, accidental alt-tab).
- `resize` alone never adds risk; it only appears on the timeline.
- `fullscreen_exit` alone never adds risk (browser inconsistencies); it is shown on the timeline.
- `devtools_hint` never adds risk; shown as an informational dot.

### 5.3 Levels and hard floors
| Level (Hebrew) | Score | Meaning shown to admin |
|---|---|---|
| **סיכון נמוך** | 0–19 | "לא זוהו דפוסים שמעוררים שאלות" |
| **סיכון בינוני** | 20–49 | "זוהו כמה דפוסים שכדאי לבדוק בראיון" |
| **סיכון גבוה** | 50–100 | "זוהו דפוסים שמעוררים ספק ממשי באמינות התוצאה" |

**Floors** (applied after the sum; the level is the maximum of the score-derived level and the floor):
- ≥ 40 % of served items telemetry-empty → at least **סיכון גבוה**.
- ≥ 20 % telemetry-empty → at least **סיכון בינוני**.
- Any `instance_conflict` (true concurrency) → at least **סיכון בינוני**.
- A blur-only pattern with no other signal can never exceed **סיכון נמוך** (the corroboration rule in §5.1).

A fully scripted run (zero client telemetry) therefore lands at סיכון גבוה regardless of how plausible its timing is, with the reason "ב-27 מתוך 27 שאלות לא התקבלו אירועי דפדפן כלל — התשובות כנראה לא נשלחו דרך ממשק המבחן".

Reasons are emitted for every signal with normalized value > 0, sorted by contribution, each with a Hebrew sentence and concrete evidence, e.g.:

- `HIDDEN_DURING_ITEMS` → "ב-4 שאלות החלון היה מוסתר למשך 8 שניות ומעלה בזמן שהשאלה הייתה פעילה (שאלות 7, 9, 14, 21)."
- `HIDDEN_THEN_CORRECT_LATE` → "ב-2 שאלות: החלון הוסתר, ואז נשלחה תשובה נכונה ברבע האחרון של הזמן (שאלות 9, 14)."
- `INSTANCE_OR_DEVICE` → "כתובת ה-IP השתנתה באמצע המבחן (בין שאלה 12 ל-13)."

The wording is always descriptive ("the window was hidden"), never accusatory ("the candidate used ChatGPT").

### 5.4 Why not a machine-learned model
No labeled data exists, the population is small, and a model would need retraining (maintenance). A transparent weighted rubric is explainable to the admin and to a candidate who asks, and it is trivially adjustable in code if the pilot shows drift.

## 6. What the admin sees

**In the candidate list**: a small pill in the "אמינות" column — green/amber/red with the level text; hovering shows the top two reasons. Filterable (the manager must be able to find flagged sessions) but **not sortable**, and the "מובילים" quick filter does **not** exclude flagged candidates — they appear with their pill so that a human reads the reasons before acting. Never combined with the overall score into one number.

**In the candidate detail — tab "אמינות המבחן"**:
1. Level pill + score bar + the plain-Hebrew reasons list with evidence.
2. **ציר זמן** (timeline): a horizontal per-item strip (27 segments, width ∝ time limit) with overlays: hidden spans (grey hatched), blur-only spans (light dotted, visually distinct), copy/paste (icon), fullscreen exit (icon), new instance / IP change (vertical line), server outage credit (blue band, labelled), telemetry-empty items (segment outlined in red), expiry (segment end marked). Hover/tap shows exact times. Below it, a chronological event table (time, item, kind, detail) with filter by kind.
3. Per-item table: position, block, difficulty, result (✔/✘/דילוג/פג), response time vs. limit (bar), first interaction, hidden time, artifacts opened (investigation).
4. Session facts: user agent, screen size, timezone, IP prefix at start/end, fullscreen availability, number of resumes (distinct `client_instance_id`s), clock skew range.

**Admin actions**: "סמן כנבדק" (marks the integrity review done; stored as an admin note of kind `integrity_reviewed`), "אפס מבחן" (deletes session/results; the candidate can retake — used when a genuine technical failure is established), and free-text notes.

## 7. Candidate-side controls (friction only, never blocking)
- Fullscreen requested at start with explanation; exit shows a non-blocking banner "המבחן אמור לרוץ במסך מלא — לחזור?" once per block.
- Copy in the item pane cancelled; paste in answer inputs blocked with a tooltip "כאן מקלידים תשובה קצרה".
- Context menu disabled in the item pane.
- Leaving the tab shows, on return, a one-line notice "שימו לב: יציאה מהחלון נרשמת" (first time only).
- No "you are being watched" nagging beyond that; the goal is honest candidates barely noticing.

## 8. Fairness and privacy guardrails
- Integrity risk uses only behavior during the assessment; never name, institution, average, DOB, IP geolocation, or device brand.
- Candidates with assistive technology (screen readers cause focus churn) can be excused: the admin can mark "התעלם מאותות פוקוס" on a candidate, which recomputes the level with `HIDDEN_*`/`TOTAL_HIDDEN_RATIO` weights set to 0, stores it in `assessment_results.integrity_risk_adjusted` (the original level is kept), and records who did it and why (`integrity_adjusted_by`, `integrity_adjust_reason`, plus an `admin_audit_log` row).
- Full IPs are nulled after 90 days (lazy, on admin read); prefixes are retained.
- The risk level is visible to admins only and is never communicated to candidates.
