-- 0014_blueprint_v3_knowledge_block.sql
-- Client feedback: "I prefer more short questions than long ones", plus an
-- explicit ask for technology-knowledge questions ("what is www and more tech
-- knowledge"), naming the IP-validity and bracket-balance items as the shape
-- they liked. See DECISIONS_LOG.md #25.
--
-- What changes from v2:
--
--   block        v2                  v3                  block time
--   speed        10 x 15 s           10 x 15 s           2:30  (unchanged)
--   knowledge    --                  10 x 15 s           2:30  (new)
--   reasoning     8 x 30 s            6 x 30 s           4:00 -> 3:00
--   tech          8 x 30 s            8 x 30 s           4:00  (unchanged)
--   investigate   4 x 150 s           3 x 150 s         10:00 -> 7:30
--   total        30 items, 20:30     37 items, 19:30
--
-- Seven more questions, one minute shorter. The weight moves from the two
-- long blocks to short ones, which is exactly what was asked for.
--
-- The knowledge block scores into the **tech** pillar rather than getting a
-- pillar of its own. That keeps one technology number in front of the hiring
-- manager instead of two, and avoids adding a score column, a weight and an
-- admin surface for a distinction they have not asked to see. The cost is
-- that "אינסטינקט טכנולוגי" is now roughly half recall — the pillar's
-- candidate-facing and admin labels say so.
--
-- 15 s, not the 20-25 s the client suggested, and that is deliberate: recall
-- questions are the single thing a phone LLM answers best and fastest, so the
-- clock is their *only* defense. Someone who knows what DNS is answers in ~3 s;
-- the photo round trip needs 11-12 s at its absolute fastest
-- (ASSESSMENT_DESIGN.md §2.2). At 20 s the loop fits comfortably; at 15 s it
-- does not. Raising this number gives the block away.
--
-- Investigation drops 4 scenes -> 3. It stays the highest-weighted pillar and
-- the most photo-resistant block, but 3 scenes still gives 9 scored judgements
-- plus process telemetry, and the 2:30 buys 10 short questions.

insert into assessment_configs (key, name_he, blueprint, is_locked)
values (
  'default_tech_student_v3',
  'ברירת מחדל — סטודנט טכנולוגי (שאלות קצרות + ידע)',
  '{
    "version": 3,
    "blocks": [
      {"key":"speed",        "pillar":"speed",        "count":10, "time_limit_s":15,  "pool":"speed.*"},
      {"key":"knowledge",    "pillar":"tech",         "count":10, "time_limit_s":15,  "pool":"knowledge.*"},
      {"key":"reasoning",    "pillar":"reasoning",    "count":6,  "time_limit_s":30,  "pool":"reasoning.*"},
      {"key":"tech",         "pillar":"tech",         "count":8,  "time_limit_s":30,  "pool":"tech.*"},
      {"key":"investigate",  "pillar":"independence", "count":3,  "time_limit_s":150, "pool":"investigate.*"}
    ],
    "weights": {"reasoning":0.30, "independence":0.30, "tech":0.25, "speed":0.15},
    "session_wall_clock_min": 75
  }'::jsonb,
  true
)
on conflict (key) do nothing;

-- Point every job still on v1 or v2 at v3. Sessions already started keep their
-- own `assessment_sessions.config_id`, so in-flight candidates are unaffected.
update jobs
set assessment_config_id = (select id from assessment_configs where key = 'default_tech_student_v3')
where assessment_config_id in (
  select id from assessment_configs where key in ('default_tech_student_v1', 'default_tech_student_v2')
);
