-- 0013_blueprint_v2_fast_items.sql
-- Round 3 anti-externalization retiming (ASSESSMENT_DESIGN.md §2.2).
--
-- Why: every per-item time limit in `default_tech_student_v1` was chosen
-- against a *transcription* threat model — "how long does it take to retype
-- this item into an LLM and read the answer back". That model is obsolete. A
-- candidate with a phone camera and a multimodal assistant transcribes
-- nothing: raise phone, photograph, send, read, click. Measured honestly that
-- loop is ~11-12 s at its fastest and ~20 s typically, which means:
--
--   * at 75 s (reasoning) and 60 s (tech), EVERY single-screen item in the
--     bank was beatable with time to spare;
--   * the "grids are SVG, so they resist externalization" argument (old
--     §2.4) is a transcription-era argument and is simply false against a
--     camera — a photo captures the grid and all six option tiles at once;
--   * likewise the א/ב/ג/ד option-label argument: the labels are in the photo.
--
-- What changes: limits drop to (or below) the loop's own floor wherever a
-- strong candidate can honestly work that fast, and the two blocks that
-- cannot go that low (reasoning, investigate) lean instead on item count,
-- transfer cost, telemetry and the open declaration to candidates.
--
--   block        v1                 v2                  block time
--   speed        10 x 20 s          10 x 15 s           3:20 -> 2:30
--   reasoning     6 x 75 s           8 x 30 s           7:30 -> 4:00
--   tech          7 x 60 s           8 x 30 s           7:00 -> 4:00
--   investigate   4 x 180 s          4 x 150 s         12:00 -> 10:00
--   total        27 items, 29:50    30 items, 20:30
--
-- Item count rises 27 -> 30 deliberately: with per-item limits this tight,
-- more short items is what keeps each pillar's measurement stable, and it
-- makes any single externalized item worth proportionally less.
--
-- Investigate keeps the longest limit on purpose. It is the most
-- photo-resistant block in the bank — one photo does not capture evidence
-- spread across tabs the candidate has not opened yet — so its limit is set
-- by what a candidate genuinely needs (measured artifact sizes: ~70-110 s),
-- not by the loop. It is NOT cut below 150 s before the non-native-reader
-- pilot in TEST_STRATEGY.md §9.
--
-- Seeded as a NEW config rather than an update: `assessment_configs` rows are
-- immutable-by-convention (`is_locked`), and sessions already generated
-- against v1 must keep scoring against the blueprint they were built from.

insert into assessment_configs (key, name_he, blueprint, is_locked)
values (
  'default_tech_student_v2',
  'ברירת מחדל — סטודנט טכנולוגי (שאלות מהירות)',
  '{
    "version": 2,
    "blocks": [
      {"key":"speed",        "pillar":"speed",        "count":10, "time_limit_s":15,  "pool":"speed.*"},
      {"key":"reasoning",    "pillar":"reasoning",    "count":8,  "time_limit_s":30,  "pool":"reasoning.*"},
      {"key":"tech",         "pillar":"tech",         "count":8,  "time_limit_s":30,  "pool":"tech.*"},
      {"key":"investigate",  "pillar":"independence", "count":4,  "time_limit_s":150, "pool":"investigate.*"}
    ],
    "weights": {"reasoning":0.30, "independence":0.30, "tech":0.25, "speed":0.15},
    "session_wall_clock_min": 75
  }'::jsonb,
  true
)
on conflict (key) do nothing;

-- Point every job that still uses v1 at v2. Sessions already started keep
-- their own `assessment_config_id`, so in-flight candidates are unaffected.
update jobs
set assessment_config_id = (select id from assessment_configs where key = 'default_tech_student_v2')
where assessment_config_id = (select id from assessment_configs where key = 'default_tech_student_v1');
