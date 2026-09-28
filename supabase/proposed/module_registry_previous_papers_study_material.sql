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
