# OPEN QUESTIONS

Everything else has been decided in the docs. These two items need the hiring manager's input because they are business facts, not design choices. Neither blocks implementation; defaults are in place.

| # | Question | Default assumed in the design | Impact if changed |
|---|---|---|---|
| 1 | **Public domain, privacy contact email, and alert email.** What domain should the candidate site live on, which mailbox receives data requests, and which address should receive Sentry/UptimeRobot/Render alerts (`ALERT_EMAIL`)? Resend needs DNS access on that domain (≈ 15 minutes) because transactional email is required at launch. | `jobs.<company>.co.il`; `PRIVACY_CONTACT_EMAIL` and `ALERT_EMAIL` = the hiring manager's address | Env vars only |
| 2 | **Pilot group availability.** Time limits, difficulty mix, and the Independence weight are set from first principles and must be checked on 10–20 strong students (including at least three second-language Hebrew readers) before public launch (`TEST_STRATEGY.md` §9). Can the manager provide that group? | Team recruits pilots from personal networks across ≥ 2 institutions | Launch date only |

Not open (decided, listed for transparency): camera omitted; transactional email required at launch (resume code works without it, closure emails do not); one attempt per candidate per job; candidates never see their score; academic average is displayed but never gates, filters or sorts; full date of birth is collected because the business requirements mandate it, is shown to admins as age, and is purged with the rest of the record at 24 months; contractor terms and Rishon requirement are stated on the landing page before any form; a half-day annual developer session for runtime/dependency updates is the one planned maintenance exception.
