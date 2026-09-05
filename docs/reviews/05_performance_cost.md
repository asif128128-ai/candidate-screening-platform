# REVIEW 5 — PERFORMANCE & COST EFFICIENCY

Reviewer: Reviewer 5 (Performance & Cost). Scope: latency risk in the timed-assessment loop, server-side generation cost under concurrency, admin dashboard scale, Supabase/Render tier fit, storage/telemetry cost trajectory, and frontend bundle risk for Hebrew/RTL mobile candidates. This is a critique, not a redesign — every finding below assumes the current architecture stays as-is.

---

## CRITICAL

### 1. The 5-connection Postgres pool is undersized for the one concurrency pattern this design is actually exposed to: a synchronized start burst
`DEPLOYMENT.md` §10 sets `Postgres pool: max 5`, and `ARCHITECTURE.md` §7 justifies this against *steady-state* load ("~200 concurrent candidates ... one request per ~60s ... < 5% CPU"). That steady-state math is right — sustained throughput for 200 paced candidates is ~3 req/s, trivial for 5 connections.

But the actual risk the brief calls out — "many candidates finishing an application cycle around the same deadline" — is a **burst**, not steady state, and it hits exactly the endpoints that matter most for timer fairness: `startAssessment` (bulk-inserts 26 items) and the first `GET /api/assessment/current` (sets `served_at`, starting the clock). If a cohort is told "the test opens at 10:00" or a reminder email goes out, dozens of candidates can hit these endpoints within the same few seconds. With only 5 pooled connections, requests queue at the pool, not at the CPU — and that queuing delay lands *after* `served_at` is set in the transaction that produced it or *before* it, depending on exact ordering, but either way it is exactly the kind of delay the design elsewhere goes out of its way to avoid (2 s grace is provisioned for network latency, not for server-side queuing). On a 20 s speed item, 400-800 ms of pool-wait during a burst is 2-4% of the entire budget, silently and disproportionately absorbed by whoever happens to start in the same window as everyone else — the opposite of "fair."

Supabase Pro's Supavisor pooler in transaction mode comfortably supports far more than 5 app-side connections. There is no cost or complexity reason to keep the pool this tight.

**Fix:** raise the app pool to ~15-20 (still trivial relative to Supavisor's ceiling), and add a k6 scenario that fires N session-starts within a 5-10 s window (see IMPORTANT #5) rather than only the paced 200-VU scenario currently specified.

### 2. Retention is explicitly unbounded, deletion is explicitly per-candidate-only, and the design never quantifies where that combination becomes a real cost/size problem
`DATA_MODEL.md` §8 states plainly: "Everything is kept until an admin deletes the candidate ... There is no automatic purge ... the hiring manager may want to revisit past applicants." `ADMIN_UX.md` §3.5 explicitly excludes bulk delete ("No bulk delete — delete is per candidate, with typed confirmation"). This is a defensible simplicity choice, but the docs never run the numbers on it, and the numbers matter for a tool meant to run recurring hiring cycles for years:

- Per completed candidate: 26 `assessment_items` rows (`content` + `answer_key` jsonb, budgeted ≤ 1,600 chars/item, investigation items larger with 5-6 artifacts ≤ 900 chars each) ≈ 2-3 KB/item × 26 ≈ 60-75 KB, plus 26 `assessment_responses` rows (~0.5 KB each ≈ 13 KB), plus up to 200 `integrity_events` rows (small jsonb `meta`, ~0.2-0.3 KB each ≈ 40-60 KB). **Call it ~150-200 KB of raw row data per completed candidate**, before index overhead (typically +30-50% for uuid PKs and the several indexes defined on these tables) — say **~250 KB effective per candidate**.
- That's roughly **2.5 GB per 10,000 completed candidates**. Supabase Pro's included Postgres storage is commonly quoted around 8 GB before overage billing kicks in. A tool used for repeated hiring rounds (student/contractor roles like this one are typically re-run every semester) will pass 10,000-20,000 cumulative candidates within a few years, at which point the *database*, not CV storage, is the thing that starts costing extra every month — and there is no mechanism in the design to reclaim space short of an admin manually typing "מחק" hundreds of times.
- CV storage (Supabase Storage, 100 GB included) is **not** the bottleneck by comparison: even at the 5 MB hard cap, 20,000 CVs = 100 GB, but realistic PDF/DOCX resumes average well under 1 MB, so actual CV storage growth is an order of magnitude slower than the DB-row growth above. The design's cost-cliff risk is in Postgres row/index growth, not in the `cv` bucket — worth correcting if anyone on the team is currently watching the wrong number.

**Fix:** either state and own the overage cost explicitly (cheap, and honestly may be the right call), or add one lightweight admin capability — bulk export-then-purge for candidates past a chosen date/stage — so "no automatic purge" doesn't quietly become "no purge is *possible* without a very tedious afternoon."

---

## IMPORTANT

### 3. "~40 ms Israel→Frankfurt" undersells the real per-transition latency budget
`ARCHITECTURE.md` §5.2 states the answer→next-item round trip is "~40 ms from Israel to Frankfurt." That number is network RTT in the best case; it excludes TLS handshake/reuse overhead, Next.js route-handler processing, the 3-statement DB transaction, and any pool-wait (see CRITICAL #1). A more honest estimate for a real request on a good connection is 80-150 ms, and meaningfully more on weaker mobile links. This doesn't break the design — the pilot calibration in `TEST_STRATEGY.md` §9 requires a 15% time-left margin, which comfortably absorbs 100-300 ms even on a 20 s item — but the number as written will anchor whoever runs pilot calibration to an optimistic baseline. It should be corrected before it's used to justify not adding margin somewhere it's actually needed (e.g., CRITICAL #1's burst case).

### 4. `percent_rank()` in `admin_application_rows` is a full-partition window function, not a filterable/indexable column — fine at stated scale, but the doc's claim is unscoped
`DATA_MODEL.md` §3.14/§4 computes `percent_rank() over (partition by job_id order by score_overall)` live in the view, and asserts it is "trivial at thousands of rows, and always correct without a recompute job." That's true for the "hundreds → low thousands" scale this platform targets — Postgres sorting a few thousand numeric values is low-single-digit milliseconds. But because `pct_rank` is a plain `SELECT` column (not an indexed/materialized one), Postgres must evaluate the window function across **every row in that job's partition** on every list render, even when the visible page is only 50 keyset-paginated rows and even when filters like "מובילים" are applied on top of it (percentile-based filters can't use an index at all — they require the full per-job sort first, then a filter pass). The claim "always correct without a recompute job" is true; the implicit claim "always fast" is only true up to the volumes this doc assumes. There's no fallback if a single job's applicant count ever moves into the tens of thousands.

**Fix:** no code change needed now — just scope the claim in the doc to the stated volumes, and note the fallback (a materialized/denormalized percentile column refreshed at completion time) if that assumption is ever revisited.

### 5. The k6 load plan never tests the scenario this review was asked to stress: a synchronized start
`TEST_STRATEGY.md` §8 Scenario A ramps 200 virtual candidates with paced think-time drawn per-item (30-90% of the time limit) — this validates steady-state throughput and confirms `DB connections ≤ 5` under *that* load, but it does not simulate what actually happens when a job posting or reminder email causes many candidates to click "start" within the same short window. That burst — not the steady 200-VU soak — is where connection-pool contention (CRITICAL #1) would actually show up, and it's currently untested.

**Fix:** add a Scenario D: N virtual users all call `submitPersonalDetails` → `startAssessment` → first `GET /current` within a 5-10 s window; assert p95 time-to-first-item stays within the pilot's timing margin, not just "no errors."

### 6. The candidate acquisition funnel — the actual mobile-network-exposed pages — has no bundle budget
`ARCHITECTURE.md` §7 gives a bundle budget only for the assessment runner (~90 KB gzip, tested in `TEST_STRATEGY.md` to ≤120 KB). But the assessment itself is explicitly desktop-gated (`ASSESSMENT_DESIGN.md` §5: cannot **start** below 900 px), which is a good mitigation for the timed portion. The pages that actually see "average mobile networks in Israel" traffic are the ones *before* that gate — personal details, job description, briefing — and those have no stated or tested bundle budget at all. Given the brief's explicit concern (Hebrew RTL, mobile, average Israeli networks), the unmeasured surface is the top-of-funnel, not the runner. A bloated first-load here (accidentally pulling in radix-ui, a markdown renderer for the job description step, etc.) costs conversions, not test-timer fairness, but it's the one part of the "frontend bundle" question the docs leave completely unaddressed.

### 7. Resend's free tier is a real near-term cost line that isn't in the $32/month estimate
`DEPLOYMENT.md` §1 lists Resend free tier (3,000 emails/month) as $0 and excludes it from "nothing scales with candidate count at the volumes in scope." But email volume does scale with candidates: application-received + OTP re-entry per candidate, plus a daily admin digest. At roughly 2 emails/candidate, the free tier is exhausted around **~1,500 candidates in a single month** — plausible for a popular posting's initial wave, not just a multi-year cumulative total. This is cheap to fix (Resend's next tier is on the order of $20/month) but it is the most concrete near-term item in "growing into the thousands" that the stated $32/month figure doesn't account for.

---

## MINOR

### 8. Admin "institution" / "study year" filter population implies a live DISTINCT scan
`ADMIN_UX.md` §3.3 describes "institution (multi-select from distinct values)" with no caching mechanism specified. At target scale (thousands of candidate rows) a `SELECT DISTINCT institution FROM candidates` is trivially fast, so this is not a real risk today — but it's recomputed on every filter-panel open rather than cached/memoized, which is unnecessary work for a value list that changes rarely.

### 9. No load test exercises memory pressure, only throughput
`--max-old-space-size=384` on a 512 MB single instance (`DEPLOYMENT.md` §10) is reasonable headroom for the documented steady-state load, but the only load test that exists (k6 Scenario A/B/C) measures request latency and DB connection count, not process memory under a start-burst (CRITICAL #1 / IMPORTANT #5). Given there's no autoscale and a single instance, a memory-pressure regression would show up as GC pauses affecting *every* concurrent candidate's timer, not just the burst cohort — worth a cheap addition to the same new k6 scenario rather than a separate effort.

---

## Overall verdict

For the load profile actually described — a recruiting funnel with a handful of concurrent candidates most of the time and occasional bursts when a posting goes out, not a consumer app — this design is **well-tuned on the big calls and cost point**: one round trip per question transition with items pre-materialized at session start (no per-transition generation cost, ever), Render Starter + Supabase Pro correctly avoids both platforms' free-tier pausing/cold-start behavior (which would be a real correctness problem for a live timed test or a bursty, idle-between-rounds usage pattern), and the admin list's denormalized-view-plus-keyset-pagination approach is the right shape for hundreds-to-thousands of rows. The ~$32/month estimate is close to right for infrastructure. Where it's weaker is in the details that only show up under the *specific* concurrency pattern this platform will actually see — a synchronized start, not a steady ramp — where a 5-connection pool and an untested burst scenario are the one place server-side latency could measurably eat into a candidate's timer budget, and in the fact that "keep everything forever, delete only one row at a time" has a real but currently unquantified multi-year cost/size trajectory that the design doesn't budget for or provide tooling against. Both are cheap to address (raise the pool, add one k6 scenario, add one bulk-archive action or an explicit accepted-cost note) without touching the architecture.
