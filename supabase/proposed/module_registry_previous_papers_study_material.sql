-- ─────────────────────────────────────────────────────────────────────────────
-- PROPOSED — DO NOT move into supabase/migrations/ without the owner's approval.
-- When promoted, the version prefix is assigned AT PROMOTION TIME (UTC time of
-- the move), never a placeholder/future date.
--
-- N2/Q1b: restore the editor vocabulary for previous-papers + study-material.
--
-- The site's rule (frontend lib/sectionRegistry.ts) is the truth: answer key and
-- previous papers exist as features wherever content exists. previous-papers and
-- study-material were retired from the CMS mirror, and their module_registry rows
-- are missing from the live table (22 rows today, neither present). This re-adds
-- them so editors can author the content the presence rule reads.
--
-- Field shapes mirror the frontend editorial rule and the existing sample-papers
-- module (a `repeater` of items + a `notes` richtext):
--   previous-papers : { papers: [{title, year, downloadLink}], notes }
--   study-material  : { materials: [{title, type, downloadLink}], notes }
-- applicable_pillars matches the registry appliesTo for both sections.
--
-- Idempotent: WHERE NOT EXISTS on slug, so a re-run never duplicates or clobbers.
-- ─────────────────────────────────────────────────────────────────────────────
--
-- ─── OWNER BATCH 7, A5: THIS FILE WAS RE-PROVED AND THE PREMISE IS WRONG ───────────
-- Measured on the live database 2026-11-06, inside a transaction that aborted itself
-- (nothing persisted). Verbatim results:
--
--   registry 22->24 (expected +2=t); active_for_government_exam 14->16; idempotent_recheck=t
--   new_rows=[previous-papers/231/active:true/pillars:government-exam+govt-vacancy+entrance-exam
--             , study-material/241/active:true/pillars:government-exam+govt-vacancy+entrance-exam]
--
-- So the INSERTs themselves apply cleanly and idempotently. But the payoff claim
-- ("so editors can author the content the presence rule reads") DOES NOT HOLD:
--
--   planted on one real published government-exam edition and re-read through
--   public.exam_content_types_with_data (the view the sitemap consumes):
--     control_news_items=true  prev_items=false  prev_body=false  prev_papers=false
--     study_items=false        final=[admit-card,application,news,notification,result]
--
-- The SAME jsonb shape that lights up 'news' left previous-papers and study-material
-- unflagged WHEN READ THROUGH THE VIEW inside the same transaction:
--   planted on the chosen exam's CURRENT edition (aiims-norcet-11th-nursing-officier-
--   recruitment-2026): content_modules gained
--   "previous-papers": {"papers":[{"title":"2024 Paper"}]}
--   read back in the same tx: stored jsonb DOES contain it, yet
--     exam_content_types_with_data.content_types stayed
--     [admit-card,application,notification,result]  (reproduced twice, before and after
--     registering the module)
--   and the same was true for {"materials":[…]}, {"notes":"…"}, {"papers":[{title,year,
--   downloadLink}]}.
--
-- BUT THE FUNCTION ITSELF DISAGREES WITH THAT READING, and this is the part that matters:
-- calling the deployed evaluator with the contract's own payloads (a fresh statement, no
-- in-flight writes) returns TRUE —
--   content_has_data('{pillar:government-exam, contentModules:{previous-papers:{papers:[{title:"2024 Paper"}]}}}', 'previous-papers') = true
--   content_has_data('{… previous-papers:{notes:"Revise basics"}}', 'previous-papers')                                                    = true
--   content_has_data('{… study-material:{materials:[{title:"Notes"}]}}', 'study-material')                                               = true
--   control  content_has_data('{… news:{items:[{title:x}]}}', 'news')                                                                    = true
--   control  content_has_data(… same payload …, 'sample-papers')                                                                         = false
-- So the presence rule and the contract fixtures (contract/content-has-data.fixtures.json
-- lines 36-44 carry 9 section cases for exactly these two sections and lines 60-62 three
-- contentType cases, all expecting true for the papers/materials/notes shapes) are intact.
-- The parity is NOT broken.
--
-- ==> The most likely explanation for the view reading false is MY OWN MEASUREMENT: the
--     view's CTE chain was evaluated in the same transaction that had just written the
--     edition, and I did not isolate that. UNRESOLVED in this batch — I am recording it
--     rather than dressing it up, because it is exactly the case the owner must not be
--     sold a conclusion on.
--
-- WHAT THAT MEANS FOR THE DECISION: the registry rows are genuinely absent (22 today,
-- neither slug), the INSERTs are clean and idempotent, the editor modules and the
-- presence rule agree on the same shape, and 0 of 392 view rows currently carry either
-- content type simply because no edition has that content. Applying this is coherent.
-- The one thing owed AFTER applying (and the reason A5 is not simply "done") is the
-- payoff re-measured from a fresh connection the way batch 5 re-proved the triggers after
-- the REVOKEs:
--   1. author previous-papers content on one real edition in the CMS UI;
--   2. select content_types from public.exam_content_types_with_data where exam_id = …;
--   3. confirm the frontend's own gate agrees (lib/sectionRegistry.ts:302-307), and that
--      the sitemap then offers the /previous-papers sub-page for that exam.
-- If step 2 still shows the flag missing while step 3 shows the tab live, the divergence
-- is real and in the view, and this file is then NOT the whole fix.
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO public.module_registry (slug, name, type, icon, description, display_order, fields, is_active, applicable_pillars)
SELECT 'previous-papers', 'Previous Papers', 'built-in', 'file-text',
       'Solved previous-year question papers (year-tagged downloads) and preparation notes.',
       231,
       '[
         {
           "key": "papers",
           "type": "repeater",
           "label": "Papers",
           "required": false,
           "subFields": [
             { "key": "title",        "type": "text", "label": "Paper Title",   "required": true },
             { "key": "year",         "type": "text", "label": "Year",          "required": false },
             { "key": "downloadLink", "type": "url",  "label": "Download Link", "required": false }
           ]
         },
         {
           "key": "notes",
           "type": "richtext",
           "label": "Preparation Tips",
           "required": false
         }
       ]'::jsonb,
       true,
       ARRAY['government-exam','govt-vacancy','entrance-exam']::text[]
WHERE NOT EXISTS (SELECT 1 FROM public.module_registry WHERE slug = 'previous-papers');

INSERT INTO public.module_registry (slug, name, type, icon, description, display_order, fields, is_active, applicable_pillars)
SELECT 'study-material', 'Study Material', 'built-in', 'book-open',
       'Curated study resources (notes, videos, books) with preparation guidance.',
       241,
       '[
         {
           "key": "materials",
           "type": "repeater",
           "label": "Materials",
           "required": false,
           "subFields": [
             { "key": "title",        "type": "text", "label": "Title",         "required": true },
             { "key": "type",         "type": "text", "label": "Type",          "required": false },
             { "key": "downloadLink", "type": "url",  "label": "Link",          "required": false }
           ]
         },
         {
           "key": "notes",
           "type": "richtext",
           "label": "Preparation Notes",
           "required": false
         }
       ]'::jsonb,
       true,
       ARRAY['government-exam','govt-vacancy','entrance-exam']::text[]
WHERE NOT EXISTS (SELECT 1 FROM public.module_registry WHERE slug = 'study-material');
