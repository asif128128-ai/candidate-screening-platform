# REVIEW 3 — SECURITY, PRIVACY & ASSESSMENT INTEGRITY

Reviewer: Reviewer 3 (Security, Privacy & Assessment Integrity). Scope: critique only, no redesign. Source docs: `DESIGN_SUMMARY.md`, `ANTI_CHEATING.md`, `DATA_MODEL.md`, `ARCHITECTURE.md`, `CANDIDATE_FLOW.md`, plus `DEPLOYMENT.md` and `ADMIN_UX.md` for auth/secrets detail.

---

## CRITICAL

### C1. The entire behavioral-telemetry defense can be bypassed by exactly the population it targets, and the design's own scoring rubric rewards this
The candidate cookie (`app_session`) is a plain HMAC token sent on every request — it is not bound to a browser or to JavaScript execution. Nothing in `GET /api/assessment/current` / `POST /api/assessment/answer` requires the request to originate from the runner's JS: a technical candidate (the target population is CS students) can lift the cookie from DevTools, script the two endpoints directly (or via a saved "copy as fetch/cURL"), solve each item with an LLM, and submit with human-plausible delays. Doing so produces **zero** client-side events — no `visibility_hidden`, `window_blur`, `copy_attempt`, `first_interaction`, nothing — because there is no DOM at all.

The rubric's only signal for this exact scenario, `TELEMETRY_GAP`, is weighted **2 out of 100** (normalized 0 at ≤10% empty items, 1 at ≥50%), and `IMPOSSIBLE_TIMING` only fires on unrealistically fast answers, which a scripted attacker simply avoids by sleeping plausible durations. The result: a fully scripted, LLM-assisted run that never touches a browser lands at `סיכון נמוך` (0–19) with a very achievable near-perfect competence score. `ANTI_CHEATING.md` §4 explicitly names this threat ("Blocking `sendBeacon` / disabling JS events") and claims "server-side signals do not depend on client events; missing `first_interaction` on many items is itself a flag" — but the §5.1 weight table contradicts that claim by nerfing exactly this flag to irrelevance. Also, the CSRF/Origin checks (`ARCHITECTURE.md` §6) do nothing here: a script controlled by the cookie's legitimate owner can set `Content-Type` and `Origin` headers to whatever it wants; those checks only stop *third-party* forgery, not the account holder replaying their own session.

**Fix:** Make "near-total absence of client telemetry across the session" a severe, near-standalone signal (e.g., ≥40–50% empty items alone should reach `סיכון גבוה`, not contribute 2 points), since a normal candidate using the real runner will essentially never produce a fully event-free session. Consider also a lightweight anti-replay measure (a short-lived, per-item nonce minted into the rendered page and required on submit, rotated so it can't be pre-harvested) to raise the cost of pure HTTP replay without adding proctoring.

### C2. "RLS with zero policies" is not a backstop against the actual operating credential — it only protects against a key that isn't the one in daily use
`ARCHITECTURE.md` frames zero-policy RLS as a "hard backstop": "even if an anon key leaks, PostgREST returns nothing." True, but irrelevant to the real risk: the app's actual DB connection (`DATABASE_URL`, and `SUPABASE_SERVICE_ROLE_KEY` for Storage/Auth admin) is a service-role-equivalent credential, and **RLS does not apply to it at all**, by Postgres/Supabase design. That means:
- Every authorization decision (candidate can only see their own application; admin must be in `admin_users` and not disabled) is enforced *exclusively* in application code with no DB-level fallback. One missed `WHERE application_id = $cookie_app_id` in a route handler, or one IDOR in an admin path, is a full unscoped read/write against the whole PII+CV dataset — there is nothing else in the stack to catch it.
- If the service-role key or `DATABASE_URL` leaks (log line, error report, compromised CI secret, compromised dependency), RLS provides **zero** mitigation, since it's not evaluated for that role. The doc's "hard backstop" language will be misread by an implementer as "even a credential leak is contained," which is false here.

**Fix:** Keep the architecture (it's a reasonable choice for this scale), but stop describing zero-policy RLS as protecting against the credential that's actually in use 24/7. For real defense-in-depth: use a Postgres role for the app that is *not* literally `service_role`/superuser-equivalent, with explicit `GRANT`s scoped to only the tables/operations the app needs (this is enforced by Postgres privileges, not RLS, and *does* apply regardless of RLS policy count); add integration tests that specifically assert cross-application data isolation at the query layer (the planned pgTAP suite tests anon/authenticated deny-all, which is the wrong layer for this risk).

### C3. CV deletion completeness is guaranteed only by one blessed code path, not by the schema — cascades and re-uploads can silently orphan files
`cv_files.application_id` is `references applications(id) on delete cascade`, and the doc is explicit that "a DB trigger is not used because the object delete is an external call" — so Storage cleanup only happens if application code remembers, every time, to call Storage-delete-then-row-delete in that order. The documented admin "מחק מועמד" flow does this correctly. But:
- Any *other* future or incidental deletion path (a bulk cleanup script, a migration, a future bulk-admin feature, a manual `DELETE FROM candidates ...` for a data fix) will cascade the DB rows fine but **cannot** reach out and delete the Storage object — the file is left behind, permanently orphaned, with no DB row pointing to it and therefore no way for any future audit or admin UI to ever discover or delete it. This directly contradicts the design's own claim that "deletion is real, cascading" (`DATA_MODEL.md` §Conventions) and the privacy notice's promise that "מחיקה מוחקת גם את תוצאות המבחן."
- The same gap applies to routine re-upload ("at most one per application, re-upload replaces"): nothing in the schema forces the prior Storage object to be deleted before the new one is written; if the replace is implemented as an upsert of `cv_files` rather than an explicit delete-then-insert, every superseded CV also becomes a permanent orphan.

**Fix:** Don't rely purely on code discipline for a legal-deletion guarantee. Route every write to `cv_files` (including replace-on-reupload) through one function that always deletes the prior object first; and add a periodic reconciliation check (list bucket objects, diff against `cv_files.object_path`) as an explicit, justified exception to "no background jobs," since this is exactly the kind of correctness property that can't be verified by looking at the DB alone.

---

## IMPORTANT

### I1. The single highest-weighted integrity signal is also the one the design admits is the weakest evidence
`HIDDEN_DURING_ITEMS` carries weight 30 — the largest in the entire rubric — and fires from a combined pool of `visibility_hidden` **and** `window_blur` spans ≥8s, reaching full normalized value at just 5 items. But `ANTI_CHEATING.md` §4 itself says, for the "second monitor/window side by side" threat, that `window_blur` without `visibility_hidden` is "not individually strong — combined signal only." The scoring table doesn't honor that distinction: blur-only spans (the innocuous case — glancing at Discord/Slack/a second monitor, common among CS students) are scored identically to true tab-hides, at the highest weight in the system. A habitual second-monitor user can land in `סיכון בינוני` or worse purely from behavior the design's own prose calls weak evidence.

**Fix:** Split `window_blur`-only spans from `visibility_hidden` spans into separate signals with materially different weights, and/or require corroboration (e.g., a blur span alone should need a second independent signal to move past `סיכון נמוך`).

### I2. A persistent, sortable, filterable integrity pill in the main triage list creates the practical effect the wording is designed to avoid
The reasons text is carefully non-accusatory ("the window was hidden," never "the candidate used ChatGPT"), which is good. But the *presentation* undoes some of that care: the "אמינות" pill sits in the primary candidate list as its own sortable/filterable column (`ADMIN_UX.md` §3.4, filter chip "סיכון אמינות"), next to the score, for every candidate, at a glance. Given the acknowledged false-positive vectors (I1, and assistive-tech users per §8 of `ANTI_CHEATING.md`), a busy hiring manager skimming amber/red pills without opening the reasons is functionally making the same judgment the design is trying to prevent ("this one looks like a cheater"), just with better-chosen words. This is exactly the kind of thing that becomes a fairness/legal problem if a rejected or deprioritized candidate later asks why.

**Fix:** Keep the pill out of the default sortable/filterable list surface, or gate its use as a filter behind an explicit "reasons reviewed" interaction; the design already insists integrity stay separate from competence in computation — the list UI should enforce the same separation visually, not just numerically.

### I3. The 90-day full-IP retention control doesn't actually fire unless an admin happens to open the record
Full IPs on `integrity_events` are "nulled after 90 days (lazy, on admin read)" with no cron guaranteed ("`pg_cron` ... only if the Supabase plan offers it — the design does not depend on it," `ARCHITECTURE.md` §8). Combined with "no automatic purge" as the general retention policy, any candidate who is screened out and never revisited by an admin keeps their full IP address **indefinitely** — not 90 days. The stated control is conditional on an event (an admin read) that may never happen for the majority of rejected applicants.

**Fix:** Either genuinely schedule this (it's a narrow, cheap, one-column update — a defensible exception to "no cron" given it's a compliance control, not a feature), or stop describing it as a 90-day guarantee in the docs and privacy notice.

### I4. Full date of birth is collected and retained indefinitely for a stated purpose that needs far less precision
`DATA_MODEL.md` and `CANDIDATE_FLOW.md` are explicit that DOB is "sanity only," "never used in scoring," shown to admins only "with computed age." That's a plausibility check, not a business need for exact DOB. Full DOB, retained forever alongside full name, institution and email (no purge), increases re-identification risk for no compensating benefit — a purpose-limitation problem under the "collect no more than necessary" expectation of Israeli privacy-law practice, especially given DOB is a text-book direct identifier.

**Fix:** Replace exact DOB with an age-band select or a self-certified "18+ / currently enrolled" checkbox; if age display is genuinely wanted, drop day-of-month granularity (year, or year+month).

### I5. Admin MFA is optional-and-deferred despite being the single gate in front of a full real-PII database
`ADMIN_UX.md` and `ARCHITECTURE.md` note MFA "can be enabled per user via Supabase Auth without code changes" — i.e., it's off by default at launch. This system's entire admin surface is one email+password login (with a 12-char minimum and IP rate limiting) protecting names, DOBs, phone numbers, academic records and CVs for every applicant, for every admin the allowlist grows to include. For data this sensitive, MFA should be a setup-time requirement, not a someday toggle.

**Fix:** Enforce MFA enrollment during admin bootstrap/invite, before first data access is granted.

### I6. Candidate deletion requests are a manual email-to-human process with no tracked queue
The only path to fulfilling a Privacy Law access/deletion request is "candidate emails `{privacy_contact_email}`; admin manually clicks 'מחק מועמד'" (`CANDIDATE_FLOW.md` §7, `DATA_MODEL.md` §8). There is no record that a request was ever received, no due-date tracking, and no way to notice a missed request — an email that's overlooked or lost simply means a legally-owed deletion never happens, silently, with nothing in the system able to flag it.

**Fix:** Log incoming privacy requests as a row (even a minimal table), with a status, so there's an auditable queue rather than an inbox-shaped single point of failure.

### I7. The 30-second `instance_conflict` window is trivially evaded by pacing device switches
Multi-device use is only flagged when "a request with a different `client_instance_id` [arrives] while another instance was active within the last 30 s" (`ANTI_CHEATING.md` §3). A candidate who deliberately spaces switches between a laptop and a second device by more than 30 seconds — entirely plausible, since items run 20–210 s — generates **no** `instance_conflict` event at all, defeating the one direct multi-device signal the design has. `served_at` immutability already makes legitimate reconnects safe without needing this leniency.

**Fix:** Track "more than one `client_instance_id` was ever active during the session" as an always-on signal independent of the 30 s window; reserve the rolling-window logic only for distinguishing "expected reconnect" from "concurrent second device," not for suppressing detection outright.

### I8. Uploaded CVs (including macro-capable DOC/DOCX) reach admin machines with no malware/exploit scanning
Validation covers type (magic bytes), size (≤5 MB) and filename (replaced with a UUID) — good hygiene against path traversal and content-type spoofing — but nothing scans content. DOCX/DOC are accepted formats and are macro-capable, zip-based containers; these files are downloaded and presumably opened natively by whoever reviews candidates. An applicant pool that is anonymous and internet-facing is a normal vector for malicious-document attacks against exactly the machine used to run this hiring pipeline.

**Fix:** At minimum, drop DOC/DOCX in favor of PDF-only (still covers the vast majority of real CVs), or serve CVs through a converted/flattened preview rather than a raw native-format download; if Office formats must stay, add a scanning step even if manual/best-effort.

---

## MINOR

### M1. The "secrets only in Render" claim is contradicted by the deployment doc's own env-var table
`ARCHITECTURE.md` §6 states "Secrets: only in Render env vars ... Never in the repo." But `DEPLOYMENT.md` §3 lists `DIRECT_DATABASE_URL` as "local/CI only," required to run `supabase db push` and `pnpm admin:add` — meaning a full, unpooled Postgres credential necessarily lives on a developer's laptop and/or in CI secrets, outside Render entirely. This isn't necessarily wrong operationally, but the security-architecture section shouldn't claim a trust boundary that the deployment doc's own instructions don't hold to.

**Fix:** Document the direct-DB credential's real handling (who holds it, rotation, whether it's scoped to a migration-only role) instead of implying Render is the only place secrets exist.

### M2. No CVE/dependency-update signal for a system meant to hold real PII for years
Dependencies are pinned exactly and Renovate is "deliberately not configured (it creates work)" (`ARCHITECTURE.md` §8). Given "no automatic purge" is also the retention default, this system is designed to run, unattended, for a long time while holding sensitive PII — and simultaneously designed to never be notified of a critical CVE in Next.js or any other dependency in that same window.

**Fix:** Keep manual/pinned updates as the policy, but still enable passive alerting (e.g., GitHub Dependabot security alerts only, no auto-PRs) so a critical CVE is at least visible to someone, without reintroducing "maintenance work."

### M3. `/api/health` publicly exposes the deployed git SHA
`{"status":"ok", ..., "version":"<git sha>"}` is returned to any unauthenticated caller (`DEPLOYMENT.md` §9). Small, but it's free fingerprinting for anyone trying to match the exact deployed commit against known vulnerabilities.

**Fix:** Keep `version` out of the public health response, or gate it behind a shared health-check secret / internal network only.

---

## Verdict

The design is unusually disciplined for its size — server-authoritative timing is genuinely sound against refresh/replay-of-the-same-request attacks, the deletion cascade is mostly real, the Hebrew integrity-risk wording is careful and non-accusatory, and the decision to skip camera proctoring is well-argued against its actual stated threat (a second device, not a hidden face). But the review surfaces one load-bearing gap that undercuts the whole anti-cheating story: because every meaningful behavioral signal is collected client-side, a technically capable candidate — precisely the population being screened — can bypass the entire telemetry layer by talking to the two JSON endpoints directly instead of through a browser, and the scoring rubric's own weights currently reward rather than penalize that (C1). Layered on top of that, the "RLS as a hard backstop" framing (C2) gives a false sense of defense-in-depth for the credential that's actually in continuous use, and CV deletion completeness (C3) depends entirely on one code path never being bypassed, with no schema-level or reconciliation guarantee behind the privacy notice's promise. None of these require a redesign — they're addressable with rubric-weight changes, a narrower Postgres role, and a reconciliation check — but as written, the three CRITICAL items mean a motivated technical candidate can likely defeat detection entirely, an app-layer bug can expose the full dataset with nothing else standing in the way, and a "complete" deletion is not actually guaranteed by anything the database enforces.
