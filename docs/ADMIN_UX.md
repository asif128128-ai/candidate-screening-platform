# ADMIN UX

Status: **Decided.** Information architecture, screens, filters/sorts, job and pipeline management, and the auth/user model. Hebrew-first RTL; strings in `messages/he.json`. Built with Next.js server components + Server Actions; tables are server-rendered and keyset-paginated so they stay fast at thousands of rows.

## 1. Goals
1. The hiring manager opens one screen and sees, within seconds, who is worth an interview.
2. Every fact about a candidate is one click away, on one page, with the assessment breakdown and the integrity timeline.
3. Managing jobs and pipeline stages is boring and obvious.
4. No dashboards for their own sake.

## 2. Navigation (top bar, RTL)

`מועמדים` · `משרות` · `בנק השאלות` · `הגדרות` · (user menu: name, `התנתקות`)

Default landing after login: **מועמדים** for the most recently active job.

## 3. Screen: מועמדים (candidate list) — `/admin/candidates`

The primary screen. One dense table, sticky header, 50 rows per page (keyset on `(sort_key, application_id)`), URL-encoded filter state (shareable, back-button safe).

### 3.0 Alert banners
Above everything: `admin_alerts` rows not yet dismissed (`ARCHITECTURE.md` §10) — e.g. "משפחת שאלות `tech.sql_outcome`: דיוק 4% ב-50 ההגשות האחרונות — ייתכן שהתשובה שגויה", "תור מחיקת קבצים תקוע (3 קבצים, 26 שעות)", "מסד הנתונים ב-72% מהמכסה", "אתמול הייתה תקלת שרת של 3 דקות — 4 מועמדים קיבלו זמן נוסף". Each has "הבנתי" (dismiss) and, where relevant, a link.

### 3.1 Header strip (per selected job)
Five numbers, not charts: `הגישו` · `סיימו מבחן` · `ממתינים לבדיקה` (assessment_completed, not yet reviewed) · `בראיון` · **`עבר מועד התשובה`** (owed a reply per `CANDIDATE_FLOW.md` §6). Plus "חדשים ב-24 השעות האחרונות".

### 3.2 Quick filters (chips, one click)
- **מובילים** — confidence ≥ 0.6, sort overall desc, limit to top 10 % (`pct_rank ≥ 0.9`). Integrity is **not** a filter here — flagged candidates appear with their pill so the reasons get read, not skimmed away.
- **ממתינים לבדיקה** — stage = assessment_completed
- **עבר מועד התשובה** — owed a reply
- **בראיון** — stage = interview
- **לבדיקת אמינות** — integrity = medium|high and not yet marked "נבדק"
- **לא סיימו** — stage ∈ {applied, assessment_started}
- **הכול**

### 3.3 Filters panel (collapsible)
Job (select; default = last used), stage (multi), integrity (multi), overall band (multi), each pillar band (multi), can_work_rishon (yes/no/all), has CV / GitHub / LinkedIn, study year (multi), institution (multi-select from distinct values, cached 10 min), applied date range, duplicate phone (yes), free-text search (name/email/phone via the trigram index).

**Academic average is displayed, never a filter or sort key.** Candidates are told the average "אינו פוסל מועמדות"; making it impossible to filter or rank by it in the tool keeps that literally true. It remains visible on the row and the profile card as context.

### 3.4 Columns (default order, RTL; all sortable except actions)
| Column | Content |
|---|---|
| שם | `first last`, link to detail; badges: `טלפון כפול`, `לא בראשון` (can_work_rishon = false) |
| ציון כולל | number + band color; grey if confidence < 0.6; sorted desc by default |
| חשיבה / עצמאות / טכנולוגי / מהירות | four mini bars with numbers |
| אמינות | pill: סיכון נמוך / בינוני / גבוה; hover shows top two reasons; **not sortable** |
| אחוזון | within job |
| שלב | stage pill; inline dropdown to change (Server Action); "עבר מועד התשובה" chip when overdue |
| מוסד · שנה | short |
| ממוצע | number (no color, no threshold, **not sortable**) |
| קבצים | icons: CV, GitHub, LinkedIn |
| הוגש | relative time |
| … | row menu: `פתח`, `שנה שלב`, `הוסף הערה`, `מחק` |

Row density: 40 px. Keyboard: `j/k` move, `Enter` opens, `1–7` set stage (with confirmation toast + undo for 8 s).

### 3.5 Bulk actions
Checkbox column (or "בחר את כל התוצאות של הסינון", up to 5,000) →
- `שנה שלב ל…` — with the "שלח הודעת סיום" checkbox when the target is נדחה.
- `ייצוא CSV` (visible columns, UTF-8 with BOM so Excel opens Hebrew correctly).
- **`ארכב ומחק`** — the space-reclaim path: exports the selection as CSV (all profile fields + scores + integrity level; no telemetry) and then deletes the selected candidates through `delete_candidate()` (cascades; CVs go to the purge queue). Typed confirmation with the count ("הקלד/י 312 כדי לאשר"), excludes `hired` and `keep_indefinitely` rows automatically and says so. Runs in batches of 100 inside one request each, with a progress bar; safe to interrupt.
- `שמור לתמיד` / `בטל שמירה` — toggles `keep_indefinitely` (exempts from 24-month retention).

### 3.6 Performance
Backed by `admin_application_rows` view; sort keys are denormalized in `assessment_results`; filters map to indexed columns. Target: < 150 ms server time at 5,000 applications (measured in `TEST_STRATEGY.md` §8).

## 4. Screen: candidate detail — `/admin/candidates/{application_id}`

Two-column layout (RTL): **start column** fixed profile card, **end column** tabs.

### 4.1 Profile card (always visible)
Name, age (computed from DOB, DOB shown on hover), phone (tel: link, copy button), email (mailto:, copy), institution, degree, year, average, Rishon availability, LinkedIn, GitHub (links open in new tab), CV (`הורד קורות חיים` → signed URL, 60 s), job applied to, applied at, source, duplicate-phone link to the other candidate, other applications by the same candidate (links).
Stage selector (dropdown) with `stage_changed_at` and by whom; choosing נדחה shows the "שלח הודעת סיום" checkbox (default on). Response due date with an overdue chip. `העתק קישור חזרה` (signed 24 h resume link for support).
Danger zone (collapsed): `אפס מבחן`, `שמור לתמיד`, `מחק מועמד` (typed confirmation "מחק").

### 4.2 Tabs
1. **סיכום** — Overall + band + percentile + confidence; four pillar cards; integrity pill with top 2 reasons; last 3 notes; stage history. This is the "decide in 20 seconds" view.
2. **תוצאות המבחן** — full breakdown (`SCORING.md` §8): pillar cards, item table, click-to-open rendered item with the candidate's answer and the correct one.
3. **אמינות המבחן** — level, reasons with evidence, timeline strip, event table, session facts (`ANTI_CHEATING.md` §6). Buttons: `סמן כנבדק`, `התעלם מאותות פוקוס` (with reason).
4. **הערות** — threaded notes (author, time, markdown-lite), add/edit own notes.
5. **היסטוריה** — stage history, consents (kind, version, time), emails sent (if enabled), admin actions (reset, delete attempts, integrity flags).

`←` / `→` (RTL-aware) navigate to the previous/next candidate in the current list order — enables reviewing the top 20 without going back to the list.

## 5. Screen: משרות — `/admin/jobs`

List: title, slug, active toggle, candidates count (by stage: applied/completed/interview/hired), assessment config name, created. Sorted active-first.

**Job form** (`/admin/jobs/new`, `/admin/jobs/{id}`):
- כותרת (he), כותרת (en, optional), slug (auto from title, editable, validated unique)
- תקציר (one line), תיאור (markdown editor with preview; RTL)
- כרטיס תנאים: hourly rate, hours/week, days/week, hours/day, engagement type, location, hybrid text, start text
- דורש נוכחות בראשון לציון (toggle — controls the badge only; the question is always asked)
- אישורי הבנה (3 editable confirmation sentences; defaults from the seed)
- תצורת מבחן (select from `assessment_configs`; default `default_tech_student_v1`); note "שינוי תצורה אחרי שהוגשו מועמדויות משפיע רק על מבחנים חדשים". Creating a *new* config (different blocks/limits) is developer work — the screen says so ("תצורה חדשה דורשת מפתח/ת").
- מועד תשובה מובטח (`response_window_days`, default 14) and `שלח הודעת סיום בדחייה` (default on)
- פעיל (toggle). Deactivating shows the count of candidates mid-flow and explains they can finish.
- Preview button → opens the candidate landing in a new tab with `?preview=1` (admin-only, renders inactive jobs).

Deleting a job is possible only when it has zero applications; otherwise deactivate.

## 6. Screen: בנק השאלות — `/admin/bank` (read-only analytics)
Per template family: pillar, difficulty levels, `fluency` tag, items served, accuracy (overall and per difficulty — a difficulty-3 row scoring higher than its difficulty-2 row is highlighted), median time used (% of limit), skip rate, expiry rate, **expiry rate among candidates scoring ≥ 65**, and for investigation scenarios the first-50 vs last-50 accuracy drift. Rows that triggered an `admin_alerts` invariant are highlighted. Sort by accuracy. Purpose: let the manager (or a future maintainer) see if a family is broken, too easy, leaking, or timer-bound, without any runtime dependency. A "צפה בדוגמה" button renders a fresh random instance (with answer) for sanity checks.

## 7. Screen: הגדרות — `/admin/settings`
- **משתמשי אדמין**: table (name, email, last login, MFA enrolled, status); `הוסף אדמין` (email + display name → row in `admin_users` + Supabase Auth invite email); `השבת`/`הפעל`. An admin cannot disable themselves. MFA (TOTP) enrollment is mandatory on first login.
- **פרטיות**: privacy contact email (used in candidate copy), retention windows (read-only, from `DATA_MODEL.md` §8), **בקשות פרטיות** queue (`privacy_requests`: open/done, due date, handled by; overdue rows are red and raise an alert), "בדיקת קבצים" (CV reconciliation, `DATA_MODEL.md` §3.9).
- **אימייל**: sender name/address (read-only from env), outbox status (pending / failed counts), send test email.
- **מערכת**: app version (git SHA — shown here, not on the public health endpoint), DB migration version, health check status, **DB size vs. plan** (from `maintenance.db_size_bytes`, with the 70 % banner threshold), CV purge-queue backlog, last sweep time, last outage window and credited sessions, last error count (24 h), links to Sentry and UptimeRobot.

## 8. Auth and user model
- Supabase Auth, email + password with "forgot password" via magic link. **MFA (TOTP) is mandatory**: middleware requires `aal2`; a user without an enrolled factor is routed to `/admin/mfa/enroll` and cannot reach any data page until done.
- Login page `/admin/login` (Hebrew). After auth, middleware checks `admin_users.email = jwt.email AND disabled_at IS NULL`; failure → "אין לך הרשאה למערכת זו" and sign-out.
- First admin: `pnpm admin:add --email x@y --name "…"` (runs against the DB and sends the Supabase invite). Subsequent admins from the settings screen.
- Sessions: Supabase refresh tokens via `@supabase/ssr` cookies; idle timeout 12 h (Supabase JWT expiry 1 h with silent refresh).
- Audit: every admin mutation records `admin_users.id` (stage history, notes, resets, deletions, job edits). Deletions write a single row to `admin_audit_log(action, target_type, target_id, admin_id, at)` — the only trace of a deleted candidate (no PII).
- Roles: none in v1. Adding `role` later touches the middleware and a handful of `canX()` helpers — no rebuild.

## 9. Visual language
- Tailwind + a small set of in-repo components (Button, Pill, Table, Tabs, Drawer). No heavy UI kit; `radix-ui` primitives for accessible dropdown/dialog/tabs (headless, RTL-aware).
- Colors carry meaning consistently: score bands use one blue-to-green ramp; integrity uses a separate grey/amber/red set; stages use neutral pills. Never mix the two scales.
- Font Heebo; numerals default (Western digits) with `he-IL` grouping.
- Mobile: the admin is desktop-first, but the candidate list and detail render usably on a phone (columns collapse to name / overall / integrity / stage) so the manager can glance from anywhere.

## 10. Email (required at launch)
- Candidate: application received (resume link + resume code + response date), OTP for re-entry, "לא ממשיכים הפעם" closure on rejection.
- Admin: **no digest.** The list header's counters ("חדשים ב-24 שעות", "עבר מועד התשובה") replace it. Alerts reach the admin through Sentry/UptimeRobot emails, not through app-sent mail.
- Delivery is via `email_outbox` (transactional insert, send after commit, retry by the hourly sweep); failures are visible in Settings and raise an alert after 3 attempts. Volume: ≈ 2–3 emails per candidate; Resend's free tier (3,000/month) covers ≈ 1,000 candidates/month; a busier month costs ≈ $20 (`DEPLOYMENT.md` §1).
