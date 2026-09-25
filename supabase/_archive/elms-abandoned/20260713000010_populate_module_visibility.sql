-- Migration: 010_populate_module_visibility
-- Fix: NEEDS-INVESTIGATION-001 — template seed moduleVisibility was '{}' for all templates.
-- Per design Section 4.2, moduleVisibility is DERIVED from featureFlags at version creation.
-- This migration applies that derivation retroactively to all existing template versions.
--
-- moduleVisibility entry per flag:
--   true  → { enabled: true,  required: false, displayOrder: N }
--   false → { enabled: false, required: false, displayOrder: 0 }
--
-- Required modules (required: true) per template type are set here:
--   general  → always required (displayOrder 1)
--   seo      → always required (displayOrder 14)
-- All others follow featureFlags.

do $$
declare
  v record;
  flags jsonb;
  vis   jsonb;
  ord   int;
  -- Ordered list of module keys matching featureFlag names → tab keys
  module_flag_map jsonb := '[
    {"flag":"supports_eligibility",      "tab":"eligibility",       "order":4},
    {"flag":"supports_vacancy",          "tab":"vacancy",           "order":5},
    {"flag":"supports_fee",              "tab":"fee",               "order":6},
    {"flag":"supports_exam_pattern",     "tab":"exam_pattern",      "order":7},
    {"flag":"supports_selection_process","tab":"selection_process", "order":8},
    {"flag":"supports_syllabus",         "tab":"syllabus",          "order":9},
    {"flag":"supports_admit_card",       "tab":"admit_card",        "order":10},
    {"flag":"supports_answer_key",       "tab":"answer_key",        "order":11},
    {"flag":"supports_result",           "tab":"result",            "order":12},
    {"flag":"supports_cutoff",           "tab":"cutoff",            "order":13},
    {"flag":"supports_books",            "tab":"books",             "order":15},
    {"flag":"supports_counselling",      "tab":"counselling",       "order":16},
    {"flag":"supports_mock_test",        "tab":"mock_test",         "order":17},
    {"flag":"supports_previous_papers",  "tab":"previous_papers",   "order":18},
    {"flag":"supports_downloads",        "tab":"downloads",         "order":19},
    {"flag":"supports_links",            "tab":"links",             "order":20},
    {"flag":"supports_syllabus",         "tab":"modules",           "order":21}
  ]'::jsonb;
  entry jsonb;
  i     int;
begin
  for v in
    select id, configuration
    from lifecycle_template_version
    where (configuration->>'moduleVisibility') = '{}'
       or configuration->'moduleVisibility' is null
  loop
    flags := v.configuration->'featureFlags';
    if flags is null then
      continue;
    end if;

    -- Start with always-enabled tabs
    vis := jsonb_build_object(
      'general', jsonb_build_object('enabled', true,  'required', true,  'displayOrder', 1),
      'overview',jsonb_build_object('enabled', true,  'required', false, 'displayOrder', 2),
      'timeline',jsonb_build_object('enabled', true,  'required', false, 'displayOrder', 3),
      'seo',     jsonb_build_object('enabled', true,  'required', true,  'displayOrder', 14),
      'publishing',jsonb_build_object('enabled', true, 'required', false, 'displayOrder', 22),
      'relationships',jsonb_build_object('enabled', true,'required',false,'displayOrder', 23),
      'amendments',jsonb_build_object('enabled', true, 'required', false, 'displayOrder', 24),
      'media',   jsonb_build_object('enabled', true,  'required', false, 'displayOrder', 25)
    );

    -- Add feature-flag-driven tabs
    for i in 0 .. jsonb_array_length(module_flag_map) - 1
    loop
      entry := module_flag_map->i;
      declare
        flag_name text := entry->>'flag';
        tab_key   text := entry->>'tab';
        disp_ord  int  := (entry->>'order')::int;
        is_enabled boolean;
      begin
        is_enabled := coalesce((flags->>flag_name)::boolean, false);
        vis := vis || jsonb_build_object(
          tab_key,
          jsonb_build_object('enabled', is_enabled, 'required', false, 'displayOrder', disp_ord)
        );
      end;
    end loop;

    update lifecycle_template_version
    set configuration = configuration || jsonb_build_object('moduleVisibility', vis)
    where id = v.id;

  end loop;
end $$;
