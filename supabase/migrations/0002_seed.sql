-- 0002_seed.sql
-- Seed data per docs/DATA_MODEL.md §7: one assessment config, one active
-- job. Candidate-facing text is copied verbatim from
-- docs/CANDIDATE_FLOW.md §3.1 (DATA_MODEL.md §7 points at
-- ASSESSMENT_DESIGN.md Appendix A for this text, but no such appendix
-- exists in the docs as delivered — CANDIDATE_FLOW.md §3.1 is explicitly
-- marked "verbatim for the seed" and is the actual source used here; see
-- IMPLEMENTATION_NOTES.md).
--
-- admin_users: intentionally NOT seeded here — created by
-- `pnpm admin:add --email ... --name ...` per DEPLOYMENT.md §8 step 3.

insert into assessment_configs (key, name_he, blueprint, is_locked)
values (
  'default_tech_student_v1',
  'ברירת מחדל — סטודנט טכנולוגי',
  '{
    "version": 1,
    "blocks": [
      {"key":"speed",        "pillar":"speed",        "count":10, "time_limit_s":20,  "pool":"speed.*"},
      {"key":"reasoning",    "pillar":"reasoning",    "count":6,  "time_limit_s":75,  "pool":"reasoning.*"},
      {"key":"tech",         "pillar":"tech",         "count":7,  "time_limit_s":60,  "pool":"tech.*"},
      {"key":"investigate",  "pillar":"independence", "count":4,  "time_limit_s":180, "pool":"investigate.*"}
    ],
    "weights": {"reasoning":0.30, "independence":0.30, "tech":0.25, "speed":0.15},
    "session_wall_clock_min": 75
  }'::jsonb,
  true
)
on conflict (key) do nothing;

insert into jobs (
  slug, title_he, summary_he, description_he, description_html,
  hourly_rate_ils, hours_per_week, days_per_week, hours_per_day,
  engagement_type_he, location_he, hybrid_he, start_he,
  requires_rishon, confirmations_he, response_window_days, send_rejection_email,
  is_active, assessment_config_id
)
select
  'student-tech-2026',
  'סטודנט/ית למשרה טכנולוגית — פיתוח ותפעול טכנולוגי (חלקית, ראשון לציון)',
  'סטודנט/ית למדעי המחשב (או תחום קרוב) — פיתוח תוכנה ותפעול טכנולוגי, חלקית, ראשון לציון',
  E'אנחנו מחפשים סטודנט/ית חזק/ה למדעי המחשב (או תחום קרוב) לתפקיד טכנולוגי רחב שמחולק בערך חצי-חצי:\n\n'
  '**פיתוח תוכנה (~50%)** — כתיבת כלים פנימיים, אוטומציות, אינטגרציות בין מערכות, עבודה מול APIs, סקריפטים, שיפורים למערכות קיימות.\n\n'
  '**תפעול טכנולוגי (~50%)** — תשתיות ו-Cloud, הרשאות ומערכות SaaS, נתונים ודוחות, כלי AI, Logs ותקלות, מערכות פנימיות ותחזוקה טכנולוגית שוטפת. חלק מזה הוא תמיכה טכנית פנימית לעובדים — זה קיים, ואנחנו אומרים את זה מראש. זו לא משרת Help Desk: המטרה הרחבה היא להפוך את הארגון למקום טכנולוגי, אוטומטי ויעיל הרבה יותר, ואת/ה תהיו חלק מרכזי בזה.\n\n'
  '**מה מצפים ממך:** עצמאות גבוהה. לקבל בעיה לא לגמרי מוגדרת, לחקור, לבדוק, להחליט ולהתקדם — בלי לחכות שיגידו לך מה הצעד הבא. סקרנות טכנולוגית אמיתית ורוחב: תוכנה, APIs, Database, Cloud, הרשאות, אבטחה בסיסית, אוטומציה.\n\n'
  '**מה מקבלים:** אחריות משמעותית, חשיפה טכנולוגית רחבה מאוד, ניסיון אמיתי מעולם ה-Production, ולמידה מהירה. בהמשך — לא מובטח, אבל אפשרי — הרחבה למשרה מלאה, יותר אחריות ושכר גבוה יותר.',
  E'<p>אנחנו מחפשים סטודנט/ית חזק/ה למדעי המחשב (או תחום קרוב) לתפקיד טכנולוגי רחב שמחולק בערך חצי-חצי:</p>'
  '<p><strong>פיתוח תוכנה (~50%)</strong> — כתיבת כלים פנימיים, אוטומציות, אינטגרציות בין מערכות, עבודה מול APIs, סקריפטים, שיפורים למערכות קיימות.</p>'
  '<p><strong>תפעול טכנולוגי (~50%)</strong> — תשתיות ו-Cloud, הרשאות ומערכות SaaS, נתונים ודוחות, כלי AI, Logs ותקלות, מערכות פנימיות ותחזוקה טכנולוגית שוטפת. חלק מזה הוא תמיכה טכנית פנימית לעובדים — זה קיים, ואנחנו אומרים את זה מראש. זו לא משרת Help Desk: המטרה הרחבה היא להפוך את הארגון למקום טכנולוגי, אוטומטי ויעיל הרבה יותר, ואת/ה תהיו חלק מרכזי בזה.</p>'
  '<p><strong>מה מצפים ממך:</strong> עצמאות גבוהה. לקבל בעיה לא לגמרי מוגדרת, לחקור, לבדוק, להחליט ולהתקדם — בלי לחכות שיגידו לך מה הצעד הבא. סקרנות טכנולוגית אמיתית ורוחב: תוכנה, APIs, Database, Cloud, הרשאות, אבטחה בסיסית, אוטומציה.</p>'
  '<p><strong>מה מקבלים:</strong> אחריות משמעותית, חשיפה טכנולוגית רחבה מאוד, ניסיון אמיתי מעולם ה-Production, ולמידה מהירה. בהמשך — לא מובטח, אבל אפשרי — הרחבה למשרה מלאה, יותר אחריות ושכר גבוה יותר.</p>',
  85.00, 18.0, 3.0, 6.0,
  'קבלן/ית עצמאי/ת (נותן/ת שירותים)',
  'אזור ראשון לציון',
  'היברידי אפשרי, לא מרחוק בלבד',
  'מיידית',
  true,
  '[
    "הבנתי שהתפקיד משלב פיתוח תוכנה עם תפעול טכנולוגי, כולל חלק של תחזוקה ותמיכה טכנית פנימית.",
    "הבנתי את התנאים: 85 ₪ לשעה, כ-18 שעות שבועיות (כ-3 ימים × 6 שעות), התקשרות כנותן/ת שירותים עצמאי/ת, תחילת עבודה מיידית.",
    "הבנתי שהעבודה דורשת יכולת להגיע פיזית לאזור ראשון לציון (היברידי אפשרי, לא מרחוק בלבד)."
  ]'::jsonb,
  14,
  true,
  true,
  (select id from assessment_configs where key = 'default_tech_student_v1')
where not exists (select 1 from jobs where slug = 'student-tech-2026');
