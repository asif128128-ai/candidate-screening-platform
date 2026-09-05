-- DEV-ONLY seed data for local manual testing of the admin UI.
-- NOT part of supabase/migrations/ — run directly against a local Postgres
-- created by ./scripts/local-pg-setup.sh, as the connecting superuser
-- (bypasses RLS, unlike app_user). Gives the admin-ui engineer real-ish
-- data to click through: several stages, integrity levels, a duplicate
-- phone, an overdue reply, a hired+kept candidate, alerts, notes, a second
-- admin (multi-admin proof), and one candidate with a full item/response/
-- integrity-event trail for the detail-page tabs.
--
-- Usage: psql -d screening_dev -f scripts/dev-seed.sql

begin;

-- Two admins, to prove "who changed this" is never hardcoded to one person.
insert into admin_users (id, email, display_name)
values
  ('00000000-0000-0000-0000-000000000001', 'admin@example.co.il', 'רותם לוי'),
  ('00000000-0000-0000-0000-000000000002', 'reviewer@example.co.il', 'דנה גיא')
on conflict (email) do nothing;

-- The one seeded job.
-- (id fetched below via subselect so this works regardless of the seed's uuid)

do $$
declare
  v_job_id uuid;
  v_config_id uuid;
  v_admin1 uuid := '00000000-0000-0000-0000-000000000001';
  v_admin2 uuid := '00000000-0000-0000-0000-000000000002';

  v_yael_c uuid; v_yael_a uuid; v_yael_s uuid;
  v_noa_c uuid; v_noa_a uuid;
  v_itay_c uuid; v_itay_a uuid;
  v_omer_c uuid; v_omer_a uuid;
  v_maya_c uuid; v_maya_a uuid;
  v_ron_c uuid; v_ron_a uuid;
  v_shira_c uuid; v_shira_a uuid;
  v_eyal_c uuid; v_eyal_a uuid;
  v_tamar_c uuid; v_tamar_a uuid;
  v_dana_c uuid; v_dana_a uuid;

  v_item1 uuid; v_item2 uuid; v_item3 uuid; v_item4 uuid;
  v_item5 uuid; v_item6 uuid; v_item7 uuid; v_item8 uuid;
begin
  select id into v_job_id from jobs where slug = 'student-tech-2026';
  select id into v_config_id from assessment_configs where key = 'default_tech_student_v1';

  -- 1. Yael Cohen — top candidate, low integrity risk, full item trail.
  insert into candidates (id, email, phone_e164, first_name, last_name, date_of_birth,
    institution, degree_program, study_year, academic_average, linkedin_url, github_url)
  values (gen_random_uuid(), 'yael.cohen@example.co.il', '+972501234567', 'יעל', 'כהן',
    '2001-03-14', 'אוניברסיטת תל אביב', 'מדעי המחשב', 2, 92.4,
    'https://linkedin.com/in/yaelcohen', 'https://github.com/yaelcohen')
  returning id into v_yael_c;

  insert into applications (id, candidate_id, job_id, stage, stage_changed_at, can_work_rishon,
    job_confirmed_at, briefing_seen_at, resume_code_hash, created_at)
  values (gen_random_uuid(), v_yael_c, v_job_id, 'assessment_completed', now() - interval '2 days', true,
    now() - interval '3 days', now() - interval '3 days', digest('YAEL0001', 'sha256'), now() - interval '3 days')
  returning id into v_yael_a;

  insert into cv_files (application_id, object_path, original_name, mime_type, size_bytes, sha256)
  values (v_yael_a, v_yael_a || '/cv.pdf', 'kורות_חיים_יעל.pdf', 'application/pdf', 182_300, digest('cv-yael', 'sha256'));

  insert into assessment_sessions (id, application_id, config_id, config_version, seed, status,
    current_position, total_items, started_at, expires_at, completed_at, user_agent, timezone)
  values (gen_random_uuid(), v_yael_a, v_config_id, 1, 987654321, 'completed',
    27, 27, now() - interval '2 days 1 hour', now() - interval '2 days' + interval '75 minutes',
    now() - interval '2 days', 'Mozilla/5.0 (Macintosh)', 'Asia/Jerusalem')
  returning id into v_yael_s;

  -- A handful of representative items (not all 27) across the four blocks.
  insert into assessment_items (id, session_id, position, block_key, pillar, template_id, template_version,
    variant_seed, kind, difficulty, time_limit_s, content, answer_key, status, served_at, deadline_at, finalized_at)
  values
    (gen_random_uuid(), v_yael_s, 1, 'speed', 'speed', 'speed.bracket_balance', 1, 1, 'single_choice', 1, 20,
     '{"he":"האם הסוגריים מאוזנים: ([{}])?","options":["כן","לא"]}', '{"correct":"כן"}',
     'answered', now() - interval '2 days 1 hour', now() - interval '2 days 1 hour' + interval '20 seconds', now() - interval '2 days 1 hour' + interval '8 seconds')
  returning id into v_item1;

  insert into assessment_items (id, session_id, position, block_key, pillar, template_id, template_version,
    variant_seed, kind, difficulty, time_limit_s, content, answer_key, status, served_at, deadline_at, finalized_at)
  values
    (gen_random_uuid(), v_yael_s, 6, 'reasoning', 'reasoning', 'reasoning.seq_arith_v1', 1, 2, 'single_choice', 2, 75,
     '{"he":"מהו האיבר הבא ברצף 2,4,8,16?","options":["24","32","30","20"]}', '{"correct":"32"}',
     'answered', now() - interval '2 days' - interval '50 minutes', now() - interval '2 days' - interval '48 minutes 45 seconds', now() - interval '2 days' - interval '49 minutes')
  returning id into v_item2;

  insert into assessment_items (id, session_id, position, block_key, pillar, template_id, template_version,
    variant_seed, kind, difficulty, time_limit_s, content, answer_key, status, served_at, deadline_at, finalized_at)
  values
    (gen_random_uuid(), v_yael_s, 12, 'tech', 'tech', 'tech.http_status_next', 1, 3, 'single_choice', 2, 60,
     '{"he":"השרת החזיר 429 עם Retry-After: 30. מה הצעד הבא הנכון?","options":["לנסות מיד שוב","להמתין 30 שניות ואז לנסות","לוותר","לשלוח פי 10 בקשות"]}',
     '{"correct":"להמתין 30 שניות ואז לנסות"}',
     'answered', now() - interval '2 days' - interval '35 minutes', now() - interval '2 days' - interval '34 minutes', now() - interval '2 days' - interval '34 minutes 30 seconds')
  returning id into v_item3;

  insert into assessment_items (id, session_id, position, block_key, pillar, template_id, template_version,
    variant_seed, kind, difficulty, time_limit_s, content, answer_key, status, served_at, deadline_at, finalized_at)
  values
    (gen_random_uuid(), v_yael_s, 24, 'investigate', 'independence', 'investigate.email_undelivered', 1, 4, 'investigation', 3, 180,
     '{"he":"מייל ללקוח לא נשלח. מהי הסיבה השורשית?","artifacts":["לוג שרת","מסך אימות ספק","תיעוד API"]}',
     '{"correct":"תעודת השולח לא אומתה"}',
     'answered', now() - interval '2 days' - interval '10 minutes', now() - interval '2 days' - interval '7 minutes', now() - interval '2 days' - interval '8 minutes')
  returning id into v_item4;

  insert into assessment_responses (item_id, session_id, answer, is_correct, partial_credit, response_ms,
    first_interaction_ms, answer_changes, artifacts_opened)
  values
    (v_item1, v_yael_s, '{"choice":"כן"}', true, 1.0, 8200, 1100, 0, null),
    (v_item2, v_yael_s, '{"choice":"32"}', true, 1.0, 75000, 4200, 1, null),
    (v_item3, v_yael_s, '{"choice":"להמתין 30 שניות ואז לנסות"}', true, 1.0, 29800, 3100, 0, null),
    (v_item4, v_yael_s, '{"choice":"תעודת השולח לא אומתה"}', true, 1.0, 172000, 2500, 2,
     '[{"key":"לוג שרת","t":1200},{"key":"מסך אימות ספק","t":8300}]');

  insert into integrity_events (session_id, item_id, kind, at, duration_ms, meta)
  values
    (v_yael_s, v_item2, 'tab_hidden', now() - interval '2 days' - interval '49 minutes 30 seconds', 1800, '{}'),
    (v_yael_s, null, 'instance_new', now() - interval '2 days 1 hour', null, '{}');

  insert into assessment_results (session_id, application_id, job_id, scoring_version,
    score_reasoning, score_independence, score_tech, score_speed, score_overall, confidence,
    items_answered, items_expired, items_correct, median_response_ms,
    integrity_risk, integrity_score, integrity_reasons, breakdown)
  values (v_yael_s, v_yael_a, v_job_id, 1,
    88.0, 91.5, 85.0, 79.0, 87.2, 1.0,
    27, 0, 24, 32000,
    'low', 8.0,
    '[{"code":"tab_hidden_short","he":"מעבר קצר בין חלונות פעם אחת — בטווח הרגיל","weight":8,"evidence":{"count":1,"max_duration_ms":1800}}]',
    '{"blocks":{"speed":{"correct":9,"total":10},"reasoning":{"correct":5,"total":6},"tech":{"correct":6,"total":7},"investigate":{"correct":4,"total":4}}}')
  ;

  insert into admin_notes (application_id, author_id, kind, body)
  values (v_yael_a, v_admin1, 'note', 'רושם מצוין, לתאם ראיון טכני בשבוע הבא.');

  insert into application_stage_history (application_id, from_stage, to_stage, changed_by, note)
  values
    (v_yael_a, 'applied', 'assessment_started', null, null),
    (v_yael_a, 'assessment_started', 'assessment_completed', null, null),
    (v_yael_a, 'assessment_completed', 'assessment_completed', v_admin1, 'נבדק ידנית');

  -- 2. Noa Levi — under review, medium integrity risk, not yet reviewed.
  insert into candidates (id, email, phone_e164, first_name, last_name, date_of_birth,
    institution, degree_program, study_year, academic_average)
  values (gen_random_uuid(), 'noa.levi@example.co.il', '+972502223344', 'נועה', 'לוי', '2000-07-01',
    'האוניברסיטה העברית', 'הנדסת תוכנה', 3, 85.0)
  returning id into v_noa_c;

  insert into applications (id, candidate_id, job_id, stage, stage_changed_at, can_work_rishon,
    job_confirmed_at, briefing_seen_at, resume_code_hash, created_at)
  values (gen_random_uuid(), v_noa_c, v_job_id, 'under_review', now() - interval '1 day', true,
    now() - interval '5 days', now() - interval '5 days', digest('NOA00002', 'sha256'), now() - interval '5 days')
  returning id into v_noa_a;

  insert into assessment_sessions (application_id, config_id, config_version, seed, status,
    current_position, total_items, started_at, expires_at, completed_at)
  values (v_noa_a, v_config_id, 1, 111222333, 'completed', 27, 27,
    now() - interval '4 days', now() - interval '4 days' + interval '75 minutes', now() - interval '4 days');

  insert into assessment_results (session_id, application_id, job_id, scoring_version,
    score_reasoning, score_independence, score_tech, score_speed, score_overall, confidence,
    items_answered, items_expired, items_correct, median_response_ms,
    integrity_risk, integrity_score, integrity_reasons, breakdown)
  select s.id, v_noa_a, v_job_id, 1, 62.0, 58.0, 65.0, 70.0, 62.8, 0.93,
    25, 2, 17, 41000, 'medium', 42.0,
    '[{"code":"tab_hidden_multi","he":"שלוש חטיפות פוקוס ארוכות בזמן פריטי חשיבה","weight":22,"evidence":{"count":3,"max_duration_ms":14500}},
      {"code":"copy_paste","he":"זוהתה פעולת הדבקה בשדה תשובה חופשית","weight":20,"evidence":{"item_position":9}}]',
    '{"blocks":{"speed":{"correct":6,"total":10},"reasoning":{"correct":4,"total":6},"tech":{"correct":4,"total":7},"investigate":{"correct":3,"total":4}}}'
  from assessment_sessions s where s.application_id = v_noa_a;

  -- 3. Itay Mizrahi — interview stage, low risk, has CV+GitHub+LinkedIn.
  insert into candidates (id, email, phone_e164, first_name, last_name, date_of_birth,
    institution, degree_program, study_year, academic_average, linkedin_url, github_url)
  values (gen_random_uuid(), 'itay.mizrahi@example.co.il', '+972503334455', 'איתי', 'מזרחי', '1999-11-20',
    'הטכניון', 'מדעי המחשב', 4, 89.0, 'https://linkedin.com/in/itaym', 'https://github.com/itaym')
  returning id into v_itay_c;

  insert into applications (id, candidate_id, job_id, stage, stage_changed_at, can_work_rishon,
    job_confirmed_at, briefing_seen_at, resume_code_hash, created_at)
  values (gen_random_uuid(), v_itay_c, v_job_id, 'interview', now() - interval '3 days', true,
    now() - interval '10 days', now() - interval '10 days', digest('ITAY0003', 'sha256'), now() - interval '10 days')
  returning id into v_itay_a;

  insert into cv_files (application_id, object_path, original_name, mime_type, size_bytes, sha256)
  values (v_itay_a, v_itay_a || '/cv.pdf', 'cv_itay.pdf', 'application/pdf', 210_000, digest('cv-itay', 'sha256'));

  insert into assessment_sessions (application_id, config_id, config_version, seed, status,
    current_position, total_items, started_at, expires_at, completed_at)
  values (v_itay_a, v_config_id, 1, 555666777, 'completed', 27, 27,
    now() - interval '9 days', now() - interval '9 days' + interval '75 minutes', now() - interval '9 days');

  insert into assessment_results (session_id, application_id, job_id, scoring_version,
    score_reasoning, score_independence, score_tech, score_speed, score_overall, confidence,
    items_answered, items_expired, items_correct, median_response_ms,
    integrity_risk, integrity_score, integrity_reasons, breakdown)
  select s.id, v_itay_a, v_job_id, 1, 80.0, 76.0, 90.0, 60.0, 78.5, 1.0,
    27, 0, 22, 38000, 'low', 5.0, '[]',
    '{"blocks":{"speed":{"correct":7,"total":10},"reasoning":{"correct":5,"total":6},"tech":{"correct":6,"total":7},"investigate":{"correct":3,"total":4}}}'
  from assessment_sessions s where s.application_id = v_itay_a;

  insert into application_stage_history (application_id, from_stage, to_stage, changed_by, note)
  values (v_itay_a, 'under_review', 'interview', v_admin2, 'תיאום ראיון ליום שלישי');

  -- 4. Omer Shapiro — assessment_completed, applied 20 days ago (overdue reply),
  --    high integrity risk (telemetry-empty floor).
  insert into candidates (id, email, phone_e164, first_name, last_name, date_of_birth,
    institution, degree_program, study_year, academic_average)
  values (gen_random_uuid(), 'omer.shapiro@example.co.il', '+972504445566', 'עומר', 'שפירא', '2002-01-05',
    'אוניברסיטת בן גוריון', 'מדעי המחשב', 1, 74.0)
  returning id into v_omer_c;

  insert into applications (id, candidate_id, job_id, stage, stage_changed_at, can_work_rishon,
    job_confirmed_at, briefing_seen_at, resume_code_hash, created_at)
  values (gen_random_uuid(), v_omer_c, v_job_id, 'assessment_completed', now() - interval '19 days', true,
    now() - interval '20 days', now() - interval '20 days', digest('OMER0004', 'sha256'), now() - interval '20 days')
  returning id into v_omer_a;

  insert into assessment_sessions (application_id, config_id, config_version, seed, status,
    current_position, total_items, started_at, expires_at, completed_at)
  values (v_omer_a, v_config_id, 1, 999888777, 'completed', 27, 27,
    now() - interval '19 days', now() - interval '19 days' + interval '75 minutes', now() - interval '19 days');

  insert into assessment_results (session_id, application_id, job_id, scoring_version,
    score_reasoning, score_independence, score_tech, score_speed, score_overall, confidence,
    items_answered, items_expired, items_correct, median_response_ms,
    integrity_risk, integrity_score, integrity_reasons, breakdown)
  select s.id, v_omer_a, v_job_id, 1, 91.0, 88.0, 93.0, 95.0, 91.5, 1.0,
    27, 0, 26, 9000, 'high', 78.0,
    '[{"code":"telemetry_gap","he":"רוב הפריטים נענו ללא כל אירוע טלמטריה בצד הלקוח — ייתכן שימוש בסקריפט אוטומטי","weight":45,"evidence":{"empty_item_ratio":0.85}},
      {"code":"implausible_timing","he":"זמני תגובה קבועים וקצרים מהנורמה האנושית בכל הפריטים","weight":33,"evidence":{"median_response_ms":9000}}]',
    '{"blocks":{"speed":{"correct":10,"total":10},"reasoning":{"correct":6,"total":6},"tech":{"correct":6,"total":7},"investigate":{"correct":4,"total":4}}}'
  from assessment_sessions s where s.application_id = v_omer_a;

  -- 5. Maya Peretz — applied only, hasn't started the assessment.
  insert into candidates (id, email, phone_e164, first_name, last_name, date_of_birth,
    institution, degree_program, study_year, academic_average)
  values (gen_random_uuid(), 'maya.peretz@example.co.il', '+972505556677', 'מאיה', 'פרץ', '2003-05-30',
    'המכללה האקדמית תל אביב-יפו', 'מדעי המחשב', 1, 88.0)
  returning id into v_maya_c;

  insert into applications (id, candidate_id, job_id, stage, stage_changed_at, can_work_rishon,
    resume_code_hash, created_at)
  values (gen_random_uuid(), v_maya_c, v_job_id, 'applied', now() - interval '5 hours', true,
    digest('MAYA0005', 'sha256'), now() - interval '5 hours')
  returning id into v_maya_a;

  -- 6. Ron Azulay — assessment_started (mid-flow, abandoned).
  insert into candidates (id, email, phone_e164, first_name, last_name, date_of_birth,
    institution, degree_program, study_year, academic_average)
  values (gen_random_uuid(), 'ron.azulay@example.co.il', '+972506667788', 'רון', 'אזולאי', '2001-09-09',
    'אוניברסיטת חיפה', 'מדעי המחשב', 2, 79.5)
  returning id into v_ron_c;

  insert into applications (id, candidate_id, job_id, stage, stage_changed_at, can_work_rishon,
    job_confirmed_at, briefing_seen_at, resume_code_hash, created_at)
  values (gen_random_uuid(), v_ron_c, v_job_id, 'assessment_started', now() - interval '2 hours', true,
    now() - interval '2 hours 10 minutes', now() - interval '2 hours 5 minutes', digest('RON00006', 'sha256'), now() - interval '2 hours 10 minutes')
  returning id into v_ron_a;

  insert into assessment_sessions (application_id, config_id, config_version, seed, status,
    current_position, total_items, started_at, expires_at)
  values (v_ron_a, v_config_id, 1, 222333444, 'in_progress', 9, 27,
    now() - interval '2 hours', now() + interval '5 minutes');

  -- 7. Shira Katz — hired, keep_indefinitely, applied long ago (retention exempt).
  insert into candidates (id, email, phone_e164, first_name, last_name, date_of_birth,
    institution, degree_program, study_year, academic_average)
  values (gen_random_uuid(), 'shira.katz@example.co.il', '+972507778899', 'שירה', 'כץ', '2000-02-18',
    'אוניברסיטת תל אביב', 'מדעי המחשב', 3, 95.0)
  returning id into v_shira_c;

  insert into applications (id, candidate_id, job_id, stage, stage_changed_at, can_work_rishon,
    job_confirmed_at, briefing_seen_at, resume_code_hash, keep_indefinitely, created_at)
  values (gen_random_uuid(), v_shira_c, v_job_id, 'hired', now() - interval '200 days', true,
    now() - interval '210 days', now() - interval '210 days', digest('SHIRA007', 'sha256'), true, now() - interval '210 days')
  returning id into v_shira_a;

  insert into assessment_sessions (application_id, config_id, config_version, seed, status,
    current_position, total_items, started_at, expires_at, completed_at)
  values (v_shira_a, v_config_id, 1, 121212121, 'completed', 27, 27,
    now() - interval '209 days', now() - interval '209 days' + interval '75 minutes', now() - interval '209 days');

  insert into assessment_results (session_id, application_id, job_id, scoring_version,
    score_reasoning, score_independence, score_tech, score_speed, score_overall, confidence,
    items_answered, items_expired, items_correct, median_response_ms,
    integrity_risk, integrity_score, integrity_reasons, breakdown)
  select s.id, v_shira_a, v_job_id, 1, 94.0, 96.0, 92.0, 88.0, 93.5, 1.0,
    27, 0, 27, 30000, 'low', 2.0, '[]',
    '{"blocks":{"speed":{"correct":9,"total":10},"reasoning":{"correct":6,"total":6},"tech":{"correct":7,"total":7},"investigate":{"correct":4,"total":4}}}'
  from assessment_sessions s where s.application_id = v_shira_a;

  -- 8. Eyal Ben-David — duplicate phone of Yael Cohen.
  insert into candidates (id, email, phone_e164, first_name, last_name, date_of_birth,
    institution, degree_program, study_year, academic_average)
  values (gen_random_uuid(), 'eyal.bendavid@example.co.il', '+972501234567', 'אייל', 'בן-דוד', '2001-12-01',
    'המכללה למינהל', 'מערכות מידע', 2, 81.0)
  returning id into v_eyal_c;

  insert into applications (id, candidate_id, job_id, stage, stage_changed_at, can_work_rishon,
    duplicate_phone_of, resume_code_hash, created_at)
  values (gen_random_uuid(), v_eyal_c, v_job_id, 'applied', now() - interval '1 hour', true,
    v_yael_c, digest('EYAL0008', 'sha256'), now() - interval '1 hour')
  returning id into v_eyal_a;

  -- 9. Tamar Golan — cannot work in Rishon (badge demo).
  insert into candidates (id, email, phone_e164, first_name, last_name, date_of_birth,
    institution, degree_program, study_year, academic_average)
  values (gen_random_uuid(), 'tamar.golan@example.co.il', '+972508889900', 'תמר', 'גולן', '2002-08-22',
    'אוניברסיטת בר-אילן', 'מדעי המחשב', 2, 83.0)
  returning id into v_tamar_c;

  insert into applications (id, candidate_id, job_id, stage, stage_changed_at, can_work_rishon,
    job_confirmed_at, briefing_seen_at, resume_code_hash, created_at)
  values (gen_random_uuid(), v_tamar_c, v_job_id, 'assessment_completed', now() - interval '6 hours', false,
    now() - interval '1 day', now() - interval '1 day', digest('TAMAR009', 'sha256'), now() - interval '1 day')
  returning id into v_tamar_a;

  insert into assessment_sessions (application_id, config_id, config_version, seed, status,
    current_position, total_items, started_at, expires_at, completed_at)
  values (v_tamar_a, v_config_id, 1, 333444555, 'completed', 27, 27,
    now() - interval '7 hours', now() - interval '7 hours' + interval '75 minutes', now() - interval '6 hours');

  insert into assessment_results (session_id, application_id, job_id, scoring_version,
    score_reasoning, score_independence, score_tech, score_speed, score_overall, confidence,
    items_answered, items_expired, items_correct, median_response_ms,
    integrity_risk, integrity_score, integrity_reasons, breakdown)
  select s.id, v_tamar_a, v_job_id, 1, 70.0, 68.0, 72.0, 65.0, 69.5, 0.96,
    26, 1, 18, 45000, 'low', 6.0, '[]',
    '{"blocks":{"speed":{"correct":6,"total":10},"reasoning":{"correct":4,"total":6},"tech":{"correct":5,"total":7},"investigate":{"correct":3,"total":4}}}'
  from assessment_sessions s where s.application_id = v_tamar_a;

  -- 10. Dana Barak — already rejected (closure sent), for the "not overdue
  --     once decided" contrast.
  insert into candidates (id, email, phone_e164, first_name, last_name, date_of_birth,
    institution, degree_program, study_year, academic_average)
  values (gen_random_uuid(), 'dana.barak@example.co.il', '+972509990011', 'דנה', 'ברק', '2000-04-11',
    'האוניברסיטה הפתוחה', 'מדעי המחשב', 4, 77.0)
  returning id into v_dana_c;

  insert into applications (id, candidate_id, job_id, stage, stage_changed_at, can_work_rishon,
    job_confirmed_at, briefing_seen_at, resume_code_hash, rejection_email_sent_at, created_at)
  values (gen_random_uuid(), v_dana_c, v_job_id, 'rejected', now() - interval '1 day', true,
    now() - interval '25 days', now() - interval '25 days', digest('DANA0010', 'sha256'),
    now() - interval '1 day', now() - interval '25 days')
  returning id into v_dana_a;

  insert into assessment_sessions (application_id, config_id, config_version, seed, status,
    current_position, total_items, started_at, expires_at, completed_at)
  values (v_dana_a, v_config_id, 1, 444555666, 'completed', 27, 27,
    now() - interval '24 days', now() - interval '24 days' + interval '75 minutes', now() - interval '24 days');

  insert into assessment_results (session_id, application_id, job_id, scoring_version,
    score_reasoning, score_independence, score_tech, score_speed, score_overall, confidence,
    items_answered, items_expired, items_correct, median_response_ms,
    integrity_risk, integrity_score, integrity_reasons, breakdown)
  select s.id, v_dana_a, v_job_id, 1, 40.0, 38.0, 45.0, 50.0, 42.0, 1.0,
    27, 0, 11, 55000, 'low', 4.0, '[]',
    '{"blocks":{"speed":{"correct":4,"total":10},"reasoning":{"correct":2,"total":6},"tech":{"correct":3,"total":7},"investigate":{"correct":2,"total":4}}}'
  from assessment_sessions s where s.application_id = v_dana_a;

  insert into application_stage_history (application_id, from_stage, to_stage, changed_by, note)
  values (v_dana_a, 'under_review', 'rejected', v_admin1, 'לא מתאים לתפקיד כרגע');

  -- Admin operational surfaces: alerts, privacy requests, email outbox.
  insert into admin_alerts (code, severity, message_he, meta)
  values
    ('template_accuracy', 'warning',
     'משפחת שאלות tech.sql_outcome: דיוק 4% ב-50 ההגשות האחרונות — ייתכן שהתשובה שגויה',
     jsonb_build_object('key', 'tech.sql_outcome', 'accuracy', 0.04)),
    ('outage_credit', 'info',
     'אתמול הייתה תקלת שרת של 3 דקות — 4 מועמדים קיבלו זמן נוסף',
     jsonb_build_object('key', 'outage_' || (current_date - 1)::text, 'credited_sessions', 4));

  insert into admin_alerts (code, severity, message_he, meta, dismissed_by, dismissed_at)
  values ('scenario_drift', 'warning',
     'תרחיש "אימייל לא נשלח" זינק מ-30% ל-68% דיוק — ייתכן דליפת תוכן',
     jsonb_build_object('key', 'investigate.email_undelivered'), v_admin1, now() - interval '1 day');

  insert into privacy_requests (email, kind, status, due_at, note)
  values
    ('old.applicant@example.co.il', 'delete', 'open', now() - interval '2 days', 'בקשת מחיקה מועמד ישן'),
    ('access.request@example.co.il', 'access', 'open', now() + interval '20 days', 'בקשת עיון במידע');

  insert into email_outbox (to_email, template, payload, application_id, attempts, sent_at)
  values
    ('yael.cohen@example.co.il', 'application_received', '{}', v_yael_a, 1, now() - interval '3 days'),
    ('broken.inbox@example.co.il', 'resume_otp', '{}', null, 4, null);

end $$;

commit;
