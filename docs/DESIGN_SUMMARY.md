# DESIGN SUMMARY — Candidate Screening Platform

Entry point for reviewers and implementers. Every decision below is final and elaborated in the linked document. Read this page, then the docs in the order listed in §7.

## 1. What we are building
A Hebrew-first, RTL web application that collects applicants for technology roles, runs a 30-minute server-timed assessment, scores four pillars (reasoning, independence, technology aptitude, speed), attaches a separate integrity-risk level, and gives the hiring manager one fast admin screen that surfaces the handful of candidates worth an interview. No automatic hire/reject. No CV review needed to find the top of the list.

## 2. Stack and topology (`ARCHITECTURE.md`)
- **Next.js 15 (App Router, TypeScript)** — one codebase, one **Render Web Service** (Starter, Frankfurt).
- **Supabase Postgres + Auth + Storage** (Pro, eu-central-1). The Next.js server is the **only** database client, connecting as a least-privilege role `app_user` with **real RLS policies** scoped per transaction (candidate context sees only its own application; admin context requires an enabled admin id) — a second boundary that catches a missed `WHERE` in application code.
- **No workers, no cron, no optional Postgres extensions, no Redis, no polling, no websockets, no runtime LLM calls.** A throttled hourly maintenance sweep runs inside `/api/health` (which Render pings forever): IP nulling, retention pruning, CV purge queue, invariant checks.
- **Alerting is on by default**: Sentry (required), UptimeRobot on the health endpoint, Render notifications, in-app admin banners for invariant checks (broken template, leaking scenario, DB size, outage credits).
- Admin auth: Supabase Auth with **mandatory TOTP MFA** + `admin_users` allowlist (multi-admin from day one, no roles until needed). Candidates: no accounts; a signed httpOnly cookie bound to their application, with an 8-character resume code for re-entry that does not depend on email.
- **Server outage credit**: if the process was down while an item was live, the item's deadline is extended by the outage (server-side facts only), so platform downtime never silently docks a candidate.
- Localization via `next-intl`; `he` is the only launch locale, `en` is a file drop-in. Logical CSS properties only; mixed Hebrew/English handled by a `<Term>`/`<bdi>` convention.
- Cost ≈ $32/month (≈ $52 in a month with > 1,000 applicants, for email). **One bounded maintenance exception**: a half-day annual developer session to bump Node LTS and dependencies. Everything else that would need a developer (new assessment shape, schema change) is listed in `ARCHITECTURE.md` §8.

## 3. Candidate flow (`CANDIDATE_FLOW.md`)
0. **Landing shows the terms first** — pay, hours, contractor status, Rishon LeZion, the tech-ops/support component, and "the test needs a computer" — before any form.
1. **Personal details** (required: names, DOB, phone, email, institution, degree, year, average, Rishon availability; optional: LinkedIn, GitHub, CV ≤ 5 MB as PDF/DOCX, uploaded asynchronously). Normalized (E.164, lowercase email), duplicates flagged not blocked. Average never gates and is not even filterable in the admin; DOB never scores. The success panel points at the next step; the resume code is shown quietly; "application received" appears only on the done page.
2. **Job description** on its own step with the structured terms card and three explicit confirmations (with a branch acknowledging a "לא" on Rishon).
3. **Briefing**: rules, a reassuring line about margins, integrity disclosure + consent, device check (≥ 900 px), then start.
4. **Assessment** → **Done** with a promised response date. Re-entry via email + resume code (or OTP). **Closure**: a short "לא ממשיכים הפעם" email on rejection (admin can suppress), and an "overdue reply" counter in the admin so nobody is left in silence.

## 4. Assessment (`ASSESSMENT_DESIGN.md`)
- **27 items, ≈ 30 minutes, four fixed blocks, one item at a time, no back, skip allowed (the skip-never-worse-than-guess invariant holds in scoring but is not disclosed to candidates — DECISIONS_LOG #21).**
  - חימום מהיר — 10 × 20 s (speed)
  - חשיבה — 6 × 75 s (reasoning; SVG grids, rule induction, state machines, constraints)
  - חקירה — **4 × 180 s** (independence; 4–5-artifact investigation scenes with root cause / next action / extracted fact, preceded by an untimed practice scene; process telemetry rewards reaching the decisive evidence efficiently, not opening every tab)
  - אינסטינקט טכנולוגי — 7 × 60 s (tech aptitude; logs, API responses, permission matrices, env diffs, automation choices)
- **"The convention is in the item"**: any protocol/tool semantic an item depends on is stated inside the item, so the test measures reasoning with a fact, not recall of it (no re-measuring internship exposure).
- **Server-authoritative timing**: `served_at`/`deadline_at` written once (DB trigger prevents re-arming); refresh returns the same deadline; 2 s network grace; per-serve answer token; 75-minute wall-clock cap; outage credit for server downtime.
- **Content = parameterized templates in code**: 52 template families (14 speed, 12 reasoning, 14 tech, **12 investigation scenarios × 3 cause variants** with rotating next-action distractors and escalation sometimes correct), > 500k distinct concrete items, deterministic per session seed, CI bank audit over 20,000 generated sessions. No hand-written pool to go stale, no LLM at runtime.
- Word-of-mouth exposure over a round is an **accepted, mitigated** risk: pool size, trick rotation, cohort-balanced scenario selection, and an automatic leakage-drift alert (`ASSESSMENT_DESIGN.md` §3.3.1).
- Time limits chosen per item type so that a strong student finishes with margin while the copy → LLM → answer loop does not (table in §2.2); the pilot must confirm the margin for non-native Hebrew readers.
- Fully worked Hebrew examples for all four pillars are in `ASSESSMENT_DESIGN.md` §3.

## 5. Scoring and integrity (`SCORING.md`, `ANTI_CHEATING.md`)
- Pillar scores 0–100 with difficulty weights; **Independence = 70 % correctness + 30 % investigative judgment** (evidence reached, how efficiently, before committing to an answer); **Speed** = 60 % speed-block (wrong = −0.5, skip = 0) + 40 % pace over *correct* answers, capped at 50 when accuracy < 60 % — fast guessing cannot score. Blind guesses in the investigation block are penalized; skipping never is.
- **Overall = 0.30 R + 0.30 I + 0.25 T + 0.15 S** (pre-committed fallback to I 0.25 / T 0.30 if the pilot shows the investigation block is materially less reliable), bands מצטיין/גבוה/בינוני/נמוך, confidence = share of items actually served, percentile within job via a window function (no recompute jobs).
- **Camera/proctoring omitted** — weak signal, misses the real threat (a second device), costly, privacy-hostile. Replaced by timing design + behavioral telemetry + the human interview.
- **מדד אמינות המבחן** (Assessment Integrity Risk): transparent weighted rubric over tab-hidden spans (blur-only spans weighted low and needing corroboration), hidden-then-correct-late patterns, copy/paste, new instances/IP/UA changes (always-on), impossible timing, artifact-blind correct investigations, and **telemetry-empty items with hard floors** — a run that scripts the endpoints without the browser lands at סיכון גבוה by construction. Levels סיכון נמוך / בינוני / גבוה with plain-Hebrew reasons and evidence. Never an input to scores; never says "cheated"; not sortable in the list. Admin sees a per-item timeline strip and event table.

## 6. Admin (`ADMIN_UX.md`), deployment (`DEPLOYMENT.md`), testing (`TEST_STRATEGY.md`)
- **Candidate list**: alert banners on top; one dense server-rendered table over a denormalized results view; quick filters (מובילים = top 10 % by overall with confidence ≥ 0.6 — integrity pill shown, not filtered away; עבר מועד התשובה; לבדיקת אמינות), pillar bars, separate integrity pill (not sortable), inline stage change with closure-email checkbox, keyboard navigation, CSV export, **bulk archive-and-delete**. Average is displayed but never a filter/sort. < 150 ms at 5,000 applications.
- **Candidate detail**: profile card + tabs סיכום / תוצאות המבחן / אמינות המבחן / הערות / היסטוריה; click any item to see exactly what the candidate saw and answered; CV via 60-second signed URL; copy resume link; reset assessment; keep-forever flag; delete candidate (full cascade; Storage cleanup guaranteed by a trigger-fed purge queue).
- **Jobs**: create/edit/activate/deactivate, structured terms card, editable confirmation sentences, response window, closure-email toggle, assessment config selector (one shipped config; new jobs reuse it; a new config shape is developer work and the screen says so).
- **Pipeline**: הוגשה מועמדות → המבחן התחיל → המבחן הושלם → בבדיקה → ראיון → נדחה / התקבל/ה, with history.
- **Retention is bounded**: full IP 90 days; raw telemetry and rendered item content 12 months (scores kept); whole candidate 24 months after last application unless hired or kept; enforced by the hourly sweep; DB size shown in Settings with a 70 % banner.
- **Deploy**: `render.yaml` blueprint, Node 22 LTS, pool 20, env vars documented, Supabase CLI migrations run by a human under an enforced expand/contract rule (CI check), app refuses to serve on migration mismatch so a bad deploy auto-rolls back, graceful SIGTERM drain, `/api/health` without version leakage, runtime secrets only on Render (migration credential never on Render), Sentry + UptimeRobot required, restore drill before launch, a plain-language runbook for the manager. Setup ≈ 75 minutes.
- **Tests**: Vitest (pure assessment modules at 100 % branch, worked scoring example reproduced exactly, skip-dominates-guess property), pgTAP (RLS policies for `app_user` incl. cross-application isolation, triggers, purge queue), Playwright on three browsers (Hebrew RTL screenshots, real tab-switch telemetry, timer/recovery/outage credit with a test clock, resume code), k6 (200 paced candidates **and a 150-candidate synchronized-start burst with memory measurement**), a human pilot (incl. second-language Hebrew readers and a scripted-endpoint pilot) with split-half reliability per pillar.

## 7. Reading order
1. `DESIGN_SUMMARY.md` (this file)
2. `ARCHITECTURE.md`
3. `DATA_MODEL.md`
4. `CANDIDATE_FLOW.md`
5. `ASSESSMENT_DESIGN.md`
6. `SCORING.md`
7. `ANTI_CHEATING.md`
8. `ADMIN_UX.md`
9. `DEPLOYMENT.md`
10. `TEST_STRATEGY.md`
11. `OPEN_QUESTIONS.md` (two business facts; nothing blocks implementation)
12. `DECISIONS_LOG.md` (how each material review finding was resolved, and where)

## 8. Implementation order (suggested milestones)
1. Repo skeleton, i18n/RTL foundation, schema migrations, health check, Render deploy of a blank app.
2. Assessment core as pure modules: generator + 52 templates (incl. 12 investigation scenarios × 3 variants) + bank audit + scoring + integrity (all unit-tested before any UI).
3. Candidate flow steps 1–3 with CV upload and cookie auth.
4. Assessment runner + server timing endpoints + telemetry.
5. Admin: auth, list, detail, stage changes, notes, jobs, settings.
6. E2E suite, load test, pilot, calibration, launch.
