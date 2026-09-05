# CANDIDATE FLOW

Status: **Decided.** The candidate-facing product from landing to "done". Hebrew-first, RTL. All copy below is the launch copy (implementers copy it into `messages/he.json` and the job seed). Assessment internals are in `ASSESSMENT_DESIGN.md`.

## 1. Route map (candidate)

| Route | Step | Notes |
|---|---|---|
| `/jobs/{slug}` | Landing | **Terms before any form** (§1.1). Only active jobs render; inactive → friendly "המשרה אינה פתוחה כרגע" |
| `/jobs/{slug}/apply` | 1 — פרטים אישיים | Form. Creates candidate + application, sets cookie, shows resume code |
| `/apply/{application_id}/job` | 2 — על התפקיד | Full description + terms card + 3 confirmations |
| `/apply/{application_id}/briefing` | 3 — לפני המבחן | Rules, time, integrity disclosure, device check, consent → start |
| `/apply/{application_id}/assessment` | Assessment | Runner (client component) |
| `/apply/{application_id}/done` | Done | Thank-you, **response window**, what happens next, privacy link |
| `/resume` | Re-entry | Email + resume code (works without email), or email OTP → cookie re-issued → redirected to the correct step |
| `/privacy` | Privacy | Notice text + request form (access / correction / deletion) → `privacy_requests` row |

Every `/apply/*` route validates that the cookie's `application_id` matches the URL; mismatch → 404. Steps are strictly ordered by server state; hitting a later URL early redirects to the correct step; hitting an earlier URL later shows a read-only summary and a "המשך" button.

### 1.1 Landing page — the terms come first
Nobody types their phone number before knowing the pay and the engagement type. The landing shows, above the fold and before any button:

- Title and the two-line hook.
- **כרטיס תנאים** (the same structured card used in step 2): 85 ₪ לשעה · כ-18 שעות שבועיות (כ-3 × 6) · קבלן/ית עצמאי/ת, לא העסקה ישירה · אזור ראשון לציון, היברידי אפשרי, לא מרחוק בלבד · התחלה מיידית.
- One honest line about the tech-ops/support component ("כ-50% פיתוח, כ-50% תפעול טכנולוגי, כולל חלק של תמיכה טכנית פנימית").
- **What the process is**: "הגשה: טופס קצר (כ-3 דקות) ← תיאור התפקיד ← מבחן מקוון של כ-30 דקות. **את המבחן עושים במחשב** (לא בטלפון); את הטופס אפשר למלא מכל מכשיר. אפשר לעצור אחרי הטופס ולחזור למבחן מאוחר יותר עם קוד החזרה שתקבלו."
- Button "להגשת מועמדות". Below: link to the privacy notice.

A candidate who would self-select out on rate, contractor status, location, or the computer requirement does so here, having given us nothing.

## 2. Step 1 — פרטים אישיים

### 2.1 Fields
| Field (label) | Required | Validation / normalization |
|---|---|---|
| שם פרטי | yes | 2–40 chars, Hebrew or Latin letters, trimmed |
| שם משפחה | yes | same |
| תאריך לידה | yes | date picker (day/month/year selects, not free text); must be 16–70 years ago — sanity only, **never** used in scoring |
| טלפון נייד | yes | Accepts `05X-XXXXXXX`, `05XXXXXXXX`, `+9725XXXXXXXX`, `9725…`; normalized to E.164 `+9725XXXXXXXX`; non-Israeli numbers accepted if valid E.164 |
| אימייל | yes | RFC-valid, lowercased, trimmed; one-shot MX check is **not** done (no runtime dependency) |
| מוסד לימודים | yes | Free text with autocomplete from a static list of ~40 Israeli institutions (Technion, TAU, HUJI, BGU, Bar-Ilan, Haifa, Weizmann, Open University, Reichman, Afeka, Shenkar, HIT, Braude, Sami Shamoon, Jerusalem College of Technology, Ariel, Sapir, Ruppin, Azrieli, Tel-Hai, Kinneret, Ono, Colman, "אחר"…) |
| תואר / מסלול | yes | Free text with autocomplete (מדעי המחשב, הנדסת תוכנה, הנדסת מחשבים, הנדסת חשמל, מערכות מידע, מדעי הנתונים, מתמטיקה, פיזיקה, "אחר") |
| שנת לימוד נוכחית | yes | select 1–7 (מכינה/שנה א׳…, תואר שני) |
| ממוצע ציונים נוכחי | yes | numeric 0–100, one decimal. Helper text: "הממוצע נשמר כנתון עזר בלבד ואינו פוסל מועמדות" |
| יכולת לעבוד מראשון לציון (פיזית, בהיברידי) | yes | radio כן/לא. If לא: inline note "המשרה דורשת נוכחות באזור ראשון לציון. אפשר להמשיך, אבל זה ייכלל בשיקולים." — **not** blocking |
| LinkedIn | no | URL normalized to `https://www.linkedin.com/in/...` |
| GitHub | no | URL normalized to `https://github.com/<user>`; bare username accepted |
| קורות חיים | no | PDF or DOCX ≤ 5 MB. Magic-byte check server-side. Dropzone + button. **Uploads asynchronously** the moment a file is chosen (progress bar, cancel, "המשך בלי קורות חיים" on failure) so a stalled 5 MB upload on a phone can never block or lose the typed form; the form submit references the already-uploaded object id |
| הסכמה למדיניות פרטיות | yes | checkbox linking to the privacy text (§6). Records `consents(privacy_v1)` |

Inline validation on blur, all errors in Hebrew, focus moves to the first error on submit. Layout is one column, labels above inputs, LTR inputs (`dir="ltr"`) for phone/email/URLs with `text-align: start` so the caret behaves. The form header says "כ-3 דקות · הטופס נשמר בדפדפן בזמן המילוי" — field values are mirrored to `sessionStorage` on change and restored on reload so an interruption before submit loses nothing.

### 2.2 Duplicate handling
- Same normalized email applying to the **same** job → no new row. If the existing application has not completed the assessment, redirect to `/resume` pre-filled with the email ("כבר הגשת מועמדות עם האימייל הזה — הזינו את קוד החזרה או בקשו קוד למייל כדי להמשיך מאותה נקודה"). If it has completed: "כבר השלמת את התהליך למשרה זו. נחזור אליך עד {date}. לשאלות: {privacy_contact_email}" — with the date computed from the original application's response window.
- Same email, **different** job → new application under the same candidate; the form is pre-filled from the existing candidate row (except consent).
- Same phone, different email → application created; `applications.duplicate_phone_of` set; admin sees a "טלפון כפול" badge. Never blocked (siblings, typos).
- Rate limit: 5 signups / IP-prefix / hour; 5 resume attempts / email / hour; 3 OTP requests / email / hour.

### 2.3 On success
Server: transaction (upsert candidate, insert application with `resume_code_hash`, insert consent, attach the already-uploaded CV via `cv_upsert`, enqueue the confirmation email in `email_outbox`), set `app_session` cookie, redirect to step 2. The confirmation email ("קיבלנו את המועמדות שלך") contains the resume link, the resume code, and the response window.

### 2.4 Resume code — re-entry that does not depend on email
Immediately after step 1 the candidate sees a full-width card: **"קוד החזרה שלך: `K7M4-Q2XP`** — שמרו אותו. אם תסגרו את הדפדפן או תעברו למחשב אחר, תוכלו להמשיך מאותה נקודה ב-{APP_BASE_URL}/resume עם האימייל והקוד הזה." (copy button; also in the confirmation email). The code is 8 characters from an unambiguous alphabet (no 0/O/1/I), stored only as SHA-256. `/resume` = email + code → cookie re-issued → redirect to the current step (timers are unaffected: `served_at` is immutable). Fallback on the same screen: "אין לך את הקוד? שלחו לי קוד למייל" (OTP). Admins can also copy a signed 24-hour resume link from the candidate page for support cases. Email being down therefore never strands a candidate.

## 3. Step 2 — על התפקיד

Rendered from the job row: title, description (markdown), and a fixed **כרטיס תנאים** with the structured fields. Below, three checkboxes that must all be checked before "הבנתי, ממשיכים":

1. "הבנתי שהתפקיד משלב פיתוח תוכנה עם תפעול טכנולוגי, כולל חלק של תחזוקה ותמיכה טכנית פנימית."
2. "הבנתי את התנאים: 85 ₪ לשעה, כ-18 שעות שבועיות (כ-3 ימים × 6 שעות), התקשרות כנותן/ת שירותים עצמאי/ת, תחילת עבודה מיידית."
3. "הבנתי שהעבודה דורשת יכולת להגיע פיזית לאזור ראשון לציון (היברידי אפשרי, לא מרחוק בלבד)." — if the candidate answered **לא** in step 1, this line is followed by: "ציינת שזה לא מתאים לך כרגע. זה לא פוסל את המועמדות, אבל ייכלל בשיקולים — אפשר להמשיך."

Server writes `job_confirmed_at`. The checkbox texts are part of the job row (`confirmations_he jsonb`, default from the seed) so a future job can have its own.

### 3.1 Seeded job — candidate-facing text (verbatim for the seed)

**כותרת:** סטודנט/ית למשרה טכנולוגית — פיתוח ותפעול טכנולוגי (חלקית, ראשון לציון)

**תיאור:**

אנחנו מחפשים סטודנט/ית חזק/ה למדעי המחשב (או תחום קרוב) לתפקיד טכנולוגי רחב שמחולק בערך חצי-חצי:

**פיתוח תוכנה (~50%)** — כתיבת כלים פנימיים, אוטומציות, אינטגרציות בין מערכות, עבודה מול APIs, סקריפטים, שיפורים למערכות קיימות.

**תפעול טכנולוגי (~50%)** — תשתיות ו-Cloud, הרשאות ומערכות SaaS, נתונים ודוחות, כלי AI, Logs ותקלות, מערכות פנימיות ותחזוקה טכנולוגית שוטפת. חלק מזה הוא תמיכה טכנית פנימית לעובדים — זה קיים, ואנחנו אומרים את זה מראש. זו לא משרת Help Desk: המטרה הרחבה היא להפוך את הארגון למקום טכנולוגי, אוטומטי ויעיל הרבה יותר, ואת/ה תהיו חלק מרכזי בזה.

**מה מצפים ממך:** עצמאות גבוהה. לקבל בעיה לא לגמרי מוגדרת, לחקור, לבדוק, להחליט ולהתקדם — בלי לחכות שיגידו לך מה הצעד הבא. סקרנות טכנולוגית אמיתית ורוחב: תוכנה, APIs, Database, Cloud, הרשאות, אבטחה בסיסית, אוטומציה.

**מה מקבלים:** אחריות משמעותית, חשיפה טכנולוגית רחבה מאוד, ניסיון אמיתי מעולם ה-Production, ולמידה מהירה. בהמשך — לא מובטח, אבל אפשרי — הרחבה למשרה מלאה, יותר אחריות ושכר גבוה יותר.

**כרטיס תנאים** (rendered as a card):
- תעריף: 85 ₪ לשעה
- היקף: כ-18 שעות שבועיות · כ-3 ימים בשבוע · כ-6 שעות ביום
- מיקום: אזור ראשון לציון · היברידי אפשרי · לא מרחוק בלבד
- סוג התקשרות: קבלן/ית עצמאי/ת (נותן/ת שירותים), לא העסקה ישירה
- התחלה: מיידית

## 4. Step 3 — לפני המבחן

Content, in order:

1. **מה זה** — "מבחן קצר ואינטנסיבי, כ-30 דקות, 27 שאלות ב-4 חלקים: חימום מהיר, חשיבה, חקירה, אינסטינקט טכנולוגי. הוא בודק איך אתם חושבים ומתמודדים עם בעיות אמיתיות — לא מה שיננתם. לפני חלק החקירה יש תרגול קצר, לא מתוזמן ולא נחשב לציון, כדי להכיר את המסך."
2. **הכללים** — לכל שאלה זמן קצוב משלה; אין חזרה אחורה; אפשר לדלג (דילוג אף פעם לא גרוע מניחוש); רענון של הדף לא מאפס את השעון; אחרי שמתחילים — מסיימים באותו רצף (מגבלה כוללת של 75 דקות).
3. **מה לצפות** — "הזמנים נבנו כך שרוב הסטודנטים החזקים מסיימים כל שאלה עם זמן לרזרבה. לא צריך הכנה, חיפוש באינטרנט או כלי AI — השאלות בנויות כך שהם פשוט לא עוזרים בזמן הנתון. אין כל דבר שצריך לדעת בעל פה: כל מה שנדרש נמצא בשאלה עצמה."
4. **גילוי נאות על ניטור** (`ANTI_CHEATING.md` §2 text). Checkbox: "קראתי ואני מסכים/ה". Records `consents(assessment_monitoring_v1)`.
5. **בדיקת מכשיר** — viewport ≥ 900 px (else: "כדי להתחיל צריך מחשב עם מסך רחב"), JS on, cookie present, clock skew measured (`server_now` vs `Date.now()`), Fullscreen API available (informational).
6. Button **"מתחילים"** → `startAssessment` action → session created → runner mounts and requests fullscreen (explained: "המבחן ייפתח במסך מלא כדי לעזור לך להתרכז").

The briefing has an "איך זה עובד" collapsed panel with a 4-screenshot walkthrough of the runner UI (timer, skip, tabs in investigation items).

## 5. Assessment runner UX (summary; details in `ASSESSMENT_DESIGN.md`)
- Top bar: block name, item `k/N`, timer bar + mm:ss. Bottom bar: "דלג/י" (secondary), "שלח/י" (primary, disabled until an answer exists).
- Investigation items: tabs across the top of the artifact pane (RTL order), answers panel on the start side, artifact pane on the end side. Each tab click is logged.
- On answer: optimistic transition is **not** used; the next item comes from the answer response (≈ 50–120 ms from Israel). A 200 ms skeleton is shown only if the response takes longer.
- Network failure on submit: retry with backoff up to 15 s (idempotent by `item_id`); message "החיבור נקטע — מנסים שוב…". If the deadline passes during the outage, the server records the item as expired at its deadline; the candidate sees "הזמן לשאלה הזו נגמר בזמן שהחיבור נקטע" and continues. This is the one case where a candidate loses an item to the network; the integrity report shows it as a network event, not a candidate action.
- Timer expiry with a selected answer: auto-submit. With nothing selected: submit as expired.

## 6. Done page and closure
Nobody who invested 40 minutes should be left in indefinite silence. Closure is built in at three points, none of which requires personalized feedback:

1. **Done page**: "תודה, {first_name}! המבחן נשמר. **נחזור אליך עד {date}** (= today + `jobs.response_window_days`, default 14) במייל או בטלפון, בכל מקרה — גם אם לא נמשיך יחד הפעם. אם עבר התאריך ולא שמעת מאיתנו, אפשר לכתוב ל-{privacy_contact_email}." Plus a link to `/privacy` for data requests. No score is shown to candidates (avoids coaching future candidates and keeps the score an internal prioritization tool).
2. **"לא ממשיכים הפעם" email**: when an admin moves an application to `נדחה` (individually or in bulk), a short, non-personalized Hebrew email is queued — unless the admin unticks "שלח הודעת סיום" in the stage-change dialog, or the job has `send_rejection_email = false`. Text: "תודה שהקדשת זמן לתהליך אצלנו. הפעם החלטנו לא להמשיך, וזו לא אמירה על היכולות שלך — התחרות הייתה גבוהה. נשמח לראות אותך שוב במשרות עתידיות. לבקשות לגבי הפרטים שלך: {privacy_contact_email}." Recorded in `applications.rejection_email_sent_at`.
3. **Overdue reminder for the admin**: applications still in `המבחן הושלם`/`בבדיקה` past their response date show a "עבר מועד התשובה" chip in the admin list and count in the header, so the manager sees who is owed an answer. This is a promise the system keeps visible; it does not send anything automatically on the candidate's behalf.

## 7. Privacy notice (Hebrew, shown at step 1, stored as `privacy_v1`)

> **מה אנחנו אוספים ולמה.** הפרטים שמילאת (שם, תאריך לידה, טלפון, אימייל, מוסד לימודים, מסלול, שנה, ממוצע, זמינות לראשון לציון, וקישורים/קורות חיים אם בחרת לצרף) משמשים אך ורק לצורך בחינת המועמדות למשרה זו. במהלך המבחן נשמרות התשובות, זמני התגובה ואירועי דפדפן בסיסיים (למשל מעבר בין חלונות), כדי להעריך את התוצאות ואת אמינותן.
> **מה לא.** לא נעשה שימוש במצלמה או במיקרופון. לא נסיק מאפיינים רגישים (מגדר, מוצא, דת, בריאות וכד׳). תאריך הלידה משמש להצגה בלבד ואינו משפיע על הציון. הממוצע אינו פוסל מועמדות.
> **מי רואה.** צוות הגיוס בלבד. הנתונים מאוחסנים אצל ספקי ענן (Supabase באיחוד האירופי, Render) בהצפנה בתעבורה ובמנוחה.
> **כמה זמן.** כתובת ה-IP המלאה נמחקת אחרי 90 יום. נתוני ההתנהגות הגולמיים מהמבחן ותוכן השאלות נמחקים אחרי 12 חודשים (הציונים נשמרים). כל שאר הפרטים נמחקים אוטומטית 24 חודשים אחרי המועמדות האחרונה שלך, אלא אם התקבלת לעבודה או ביקשת שנשמור אותם למשרות עתידיות.
> **הזכויות שלך.** אפשר לבקש עיון, תיקון או מחיקה של הפרטים בכל עת בטופס ב-{APP_BASE_URL}/privacy או במייל ל-{privacy_contact_email}. בקשות מטופלות תוך 30 יום. מחיקה מוחקת גם את תוצאות המבחן וקובץ קורות החיים.

## 8. Error and edge states (all with Hebrew copy)
- Cookie missing on `/apply/*` → redirect to `/resume` with explanation ("הזינו אימייל וקוד חזרה").
- Server restart/outage while an item is live → the item's deadline is extended by the outage duration (`ARCHITECTURE.md` §5.2); the candidate sees "הייתה תקלה זמנית בצד שלנו — הזמן לשאלה הוארך בהתאם".
- Session abandoned (wall-clock exceeded) → done page variant: "המבחן נסגר כי חלף זמן המקסימום. מה שנענה נשמר."
- Job deactivated mid-flow → candidates already in flow may finish; new visits get the inactive page.
- Browser without Fullscreen API → proceed without it (logged as `fullscreen_unavailable`).
- Server error during answer → retry UI (§5); if unrecoverable, "משהו השתבש, רענן/י את הדף — ההתקדמות נשמרה".

## 9. Typography and RTL specifics
- Font `Heebo` for Hebrew/Latin UI text, `JetBrains Mono` for code/logs (with `Heebo` fallback for any Hebrew inside code blocks).
- Numbers and units stay LTR inside RTL sentences via `<bdi>`; "85 ₪" renders as `<bdi>85 ₪</bdi>`.
- Form inputs for phone/email/URL are `dir="ltr"`; placeholder text in those inputs is English (`name@example.com`).
- Lists of technical terms keep English (API, Cloud, Production, Logs, GitHub, Webhook, Database, Frontend, Backend, AI, SaaS) — no Hebrew transliteration.
