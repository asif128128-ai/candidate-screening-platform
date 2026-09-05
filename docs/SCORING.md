# SCORING

Status: **Decided.** Converts raw responses, timing and (for Independence) process telemetry into four pillar scores, an overall screening score, and a confidence indicator. Implemented as pure functions in `/src/assessment/scoring.ts`, executed once at session completion, stored in `assessment_results` with `scoring_version = 1`.

Principles: integers for display, no decimals that imply precision; every number the admin sees is explainable in one sentence; integrity is never an input; date of birth, average, institution are never inputs.

## 1. Inputs
`scoreSession({ items, responses, events, blueprint })` where:
- `items`: materialized `assessment_items` (block, pillar, difficulty, time_limit_s, answer_key, status)
- `responses`: one per served item (`is_correct`, `partial_credit`, `response_ms`, `first_interaction_ms`, `artifacts_opened`, `answer_changes`)
- `events`: only `artifact_open` and `network_retry` are read by scoring (for process signal and excusal); everything else belongs to integrity
- `blueprint.weights`

## 2. Item score `s_i ∈ [0, 1]`
| Item kind | Rule |
|---|---|
| single_choice, numeric, short_text | 1 if correct else 0. short_text/numeric compare after normalization (trim, collapse spaces, Unicode NFKC, strip surrounding quotes/brackets, numeric tolerance ±0 unless the template declares a tolerance) |
| multi_choice | Jaccard(selected, correct) with a penalty: `max(0, |S∩C| − |S∖C|) / |C|` |
| ordering | Kendall-τ-based: `max(0, 1 − 2·inversions / maxInversions)`; exact order = 1 |
| investigation | `0.5·q1 + 0.25·q2 + 0.25·q3` (root cause, next action, extracted fact) |
| skipped / expired | 0 |

Difficulty weight `w_i`: difficulty 1 → 1.0, 2 → 1.3, 3 → 1.7.

## 3. Pillar scores

### 3.1 Reasoning (חשיבה והסקה) — from the reasoning block only
```
R_raw = Σ w_i·s_i / Σ w_i           over the 6 reasoning items
R = round(100 · R_raw)
```

### 3.2 Technology aptitude (אינסטינקט טכנולוגי) — from the tech block only
```
T_raw = Σ w_i·s_i / Σ w_i           over the 7 tech items
T = round(100 · T_raw)
```

### 3.3 Independence (עצמאות) — investigation block correctness + investigative judgment
```
I_correct = Σ w_i·s_i / Σ w_i       over the 4 investigation items   (s_i is the 0.5/0.25/0.25 composite)

I_process = mean over the 4 items of p_i, where, with D = the scene's declared decisive artifact
            and an "open" counting only if dwell ≥ 3 s:
    p_i = 0.50 · evidence     evidence  = 1 if D was opened before submit (or before skip), else 0
        + 0.30 · efficiency   efficiency = 1.0 if D was reached within the first 2 opens
                                         = 0.6 if within the first 3
                                         = 0.3 if opened later
                                         = 0   if never opened
        + 0.20 · deliberation deliberation = 1 if an artifact was opened before any answer was selected, else 0
    Special case: a scene where the candidate opened every artifact in < 15 s total ("click-through")
    scores efficiency = 0.3 regardless of order — mechanical tab-cycling is not judgment.

I_raw = 0.70 · I_correct + 0.30 · I_process
guess_penalty = min(6, 2 · guessed_items)   // see 3.5; includes blind guesses in this block
I = round(100 · I_raw) − guess_penalty, clamped to [0, 100]
```
Rationale: correctness alone would reward a lucky pick; the process score must reward *knowing where to look*, not opening everything. `efficiency` gives full credit to a candidate who infers from the ticket which artifact matters and goes there first or second; a candidate who cycles every tab reaches the decisive one "eventually" and gets partial credit only. There is deliberately **no** component for "opened many artifacts" and **no** component for "submitted rather than skipped" (see §3.6). The 70/30 split keeps "got it right" dominant.

**Pre-committed weight fallback.** If the pilot's split-half reliability for this block is materially below the reasoning block's (`TEST_STRATEGY.md` §9), the blueprint weights ship as I 0.25 / T 0.30 instead of 0.30 / 0.25. Either way the weights live in the blueprint, not in code.

### 3.4 Speed (מהירות וביצוע)
Two components:

**(a) Speed block score (60 %)** — the 10 warm-up items, with guessing discouraged:
```
per item: correct → +1 ; wrong → −0.5 ; skip/expired → 0
S_block = clamp(Σ / 10, 0, 1)
```

**(b) Pace across the whole assessment (40 %)** — how fast the candidate answers when they answer correctly:
```
for every item (all blocks) with s_i ≥ 0.75:  u_i = response_ms / (time_limit_s · 1000)
pace_raw = 1 − median(u_i)                 requires ≥ 8 such items; otherwise pace_raw = S_block
S_pace = clamp((pace_raw − 0.15) / 0.65, 0, 1)   // maps median 15 % of limit → 1, 80 % → 0
```
Then:
```
S_raw = 0.6 · S_block + 0.4 · S_pace
accuracy_gate: overall_accuracy = Σ s_i / N over all served items
   if overall_accuracy < 0.60 → S_raw = min(S_raw, 0.50)
S = round(100 · S_raw)
```
The gate is what prevents "fast random guessing" from scoring: speed is only measured on correct work, and a low-accuracy session cannot exceed 50 in speed.

### 3.5 Guess detection (feeds only the small Independence penalty and the admin view)
An item is "guessed" if:
- (any block) it was answered **wrong** and `response_ms < 0.25 · time_limit_ms`; or
- (investigation block) sub-question 1 was answered **wrong** and the decisive artifact was **never opened** (a "blind guess", regardless of how long the candidate waited).

Skipping is *never* a guess. Displayed as "ניחושים: k" on the detail page.

### 3.6 Skip is never worse than a blind guess (invariant)
The design promises that honest skipping is never punished harder than guessing. In the investigation block this is enforced by construction:
- A skipped scene scores `s_i = 0` on correctness — the same as a wrong guess.
- Its process score `p_i` is computed from whatever the candidate did **before skipping** (a candidate who investigated, could not decide, and skipped keeps their `evidence`/`efficiency`/`deliberation` credit).
- A blind wrong guess scores `s_i = 0`, loses `evidence` and `efficiency` (decisive artifact never opened), **and** incurs the guess penalty.
- Partially answered scenes are allowed: blank sub-questions score 0 without penalty; only a wrong sub-question 1 can be a guess.

Unit test `scoring.test.ts › skip_dominates_blind_guess` asserts for 10,000 random behaviors that `I(skip) ≥ I(blind wrong guess)` holds item-by-item.

## 4. Overall screening score (ציון סינון כולל)
```
Overall = round(0.30·R + 0.30·I + 0.25·T + 0.15·S)
```
Weights come from the blueprint (so a future job can shift them) and reflect the hiring manager's priorities: independence and reasoning first, tech instinct next, raw speed last (it is already partially embedded in the other pillars through time limits).

**Bands** (used for pills and filters, all pillars and overall):
| Band | Range | Hebrew |
|---|---|---|
| Exceptional | 80–100 | מצטיין |
| High | 65–79 | גבוה |
| Medium | 50–64 | בינוני |
| Low | 0–49 | נמוך |

## 5. Confidence (רמת ביטחון בתוצאה)
```
confidence = served_and_finalized_items / total_items         // 27 in the default blueprint
```
- 1.00: full session.
- < 1.00: the session was abandoned (wall clock) or reset; items never served count as missing. Expired-with-attempt items do **not** reduce confidence — running out of time is data.
- Shown as a percentage next to the overall score, and as a grey stripe on the score bar. Results with confidence < 0.6 are listed with the score greyed and are excluded from percentile ranking (they still appear, sorted at the bottom).

## 6. Relative standing (אחוזון בתוך המשרה)
Computed at query time: `percent_rank() over (partition by job_id order by score_overall)` among results with `confidence ≥ 0.6`. Displayed as "אחוזון 93" (top 7 %). This is what makes "surface the top few" instant: the list default sort is overall score desc, and a "Top 10 %" quick filter uses this window.

No cross-job normalization (different jobs may use different blueprints); no time-decay; no re-scoring when new candidates arrive (percentile updates naturally because it is a window function).

## 7. Per-block and per-item breakdown (stored in `assessment_results.breakdown`)
```json
{
  "blocks": [
    {"key":"speed","correct":8,"wrong":1,"skipped":1,"expired":0,"score":78,"median_u":0.42},
    {"key":"reasoning","correct":5,"wrong":1,"skipped":0,"expired":0,"score":83,"median_u":0.61},
    {"key":"investigate","correct_q1":3,"correct_q2":3,"correct_q3":4,"process":0.90,"score":84},
    {"key":"tech","correct":6,"wrong":1,"skipped":0,"expired":0,"score":86,"median_u":0.55}
  ],
  "items": [
    {"pos":1,"block":"speed","template":"speed.count_matches","difficulty":1,"s":1,"response_ms":7400,"limit_ms":20000,"first_ms":2100,"changes":0},
    ...
  ],
  "guessed_items": 1,
  "accuracy_overall": 0.81
}
```

## 8. Display to admin
Candidate row: `Overall` (bold, band color), then four compact bars R / I / T / S with numbers, then `אמינות` pill (separate column, separate color scale), then confidence if < 1.

Candidate detail — tab "תוצאות המבחן":
1. Header: Overall + band + percentile + confidence.
2. Four pillar cards; each shows score, band, one-line "מה נמדד", and the block's correct/wrong/skipped/expired counts; Independence also shows the process score and "פתח/ה את הראיה המכריעה ב-3/3 חקירות".
3. Item table (all 27): position, block, family (human name, e.g. "קופסה שחורה"), difficulty dots, result, time used (bar vs. limit), first interaction, answer changes, outage credit if any ("+42 שנ׳ תקלת שרת"). Clicking a row opens the exact rendered item with the candidate's answer highlighted and the correct answer shown — the admin sees precisely what the candidate saw.
4. Footer note (static Hebrew): "הציונים הם כלי לתעדוף בלבד. הם לא מחליטים על קבלה או דחייה, ולא נועדו למדוד אינטליגנציה. אמינות המבחן מוצגת בנפרד ואינה משפיעה על הציון."

## 9. Calibration and drift
- Pilot (10–20 known-strong students before launch; `TEST_STRATEGY.md` §9) sets initial expectations; if a block's median score is < 35 or > 90, its time limit or difficulty mix in the blueprint is adjusted **before** launch.
- After launch there is no automatic recalibration. The admin "בנק השאלות" page shows per-template accuracy and median time so a human can decide, in a future code change, to adjust. Nothing needs to be done for the system to keep working.
- `scoring_version` bumps whenever §2–§5 change; old results are not recomputed unless an admin explicitly triggers "חשב מחדש" for a job.

## 10. Worked example
Candidate answers: speed 8 correct / 1 wrong / 1 skip; reasoning items (difficulties 1,1,2,2,2,3) → correct on all but one difficulty-2; tech (1,1,2,2,2,2,3) → correct all but one difficulty-1; investigation (difficulties 1,2,2,3): scene A (d1) full (1.0), scene B (d2) root cause wrong but action+fact right (0.5), scene C (d2) full, scene D (d3) root cause + fact right, action wrong (0.75); process 1.0, 0.8, 1.0, 0.8; median u over correct items 0.48; one guessed item (in the speed block; scene B's wrong root cause was not blind — the decisive artifact was opened).

- Speed block: (8 − 0.5)/10 = 0.75. Pace: 1 − 0.48 = 0.52 → (0.52 − 0.15)/0.65 = 0.57. S_raw = 0.6·0.75 + 0.4·0.57 = 0.678. Accuracy 22.25/27 = 0.82 ≥ 0.6. **S = 68**.
- Reasoning: weights 1,1,1.3,1.3,1.3,1.7 = 7.6; lost 1.3 → 6.3/7.6 = 0.829 → **R = 83**.
- Tech: weights 1,1,1.3×4,1.7 = 8.9; lost 1.0 → 7.9/8.9 = 0.888 → **T = 89**.
- Independence: correctness = (1.0·1 + 1.3·0.5 + 1.3·1 + 1.7·0.75)/(1+1.3+1.3+1.7) = (1 + 0.65 + 1.3 + 1.275)/5.3 = 0.797; process = 0.90; I_raw = 0.7·0.797 + 0.3·0.90 = 0.828 → 83 − 2 (one guess) = **I = 81**.
- Overall = 0.30·83 + 0.30·81 + 0.25·89 + 0.15·68 = 24.9 + 24.3 + 22.25 + 10.2 = **81.65 → 82, מצטיין**.
