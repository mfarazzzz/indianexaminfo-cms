-- =====================================================================================
-- A3 PROPOSAL — content-intern: remove edit_any_exam and edit_any_post  (NOT APPLIED)
-- Owner batch 7, phase A3. Waits for the owner's exact word: "APPLY INTERN ROLE".
-- =====================================================================================
--
-- WHY IT IS ALMOST FREE TODAY: 0 users hold this role.
--   select count(*) from user_profiles up join roles r on r.id = up.role_id
--    where r.slug = 'content-intern';                                   -- => 0
--
-- WHAT THE TWO SLUGS ACTUALLY GOVERN (measured from pg_policies, live DB):
--
--   OWN vs ANY on exams — there is no edit_own_exam permission at all:
--     exams_update (USING and WITH CHECK):
--       current_user_has_permission('edit_any_exam')
--         OR (created_by = auth.uid() AND current_user_has_permission('create_exam'))
--     => editing YOUR OWN exam is gated by create_exam, which the intern keeps.
--   OWN vs ANY on posts / news / blog / vacancies:
--     content_posts_update, blog_posts_update, cms_education_news_update,
--     sarkari_naukri staff_update_sarkari (all USING and WITH CHECK):
--       current_user_has_permission('edit_any_post')
--         OR (created_by = auth.uid() AND current_user_has_permission('edit_own_post'))
--     => the own path needs edit_own_post, which the intern keeps.
--
--   Visibility on exams:
--     staff_read_exams_rbac (SELECT): edit_any_exam OR created_by = auth.uid()
--     public_read_published_exams (SELECT): is_published = true   [permissive OR]
--     => removing edit_any_exam does NOT hide any published exam. All 404 exam rows are
--        published (select count(*) from exams where is_published = false; => 0), so the
--        intern still sees 404 rows either way — measured, see PROOF below.
--
-- WHAT THE INTERN KEEPS (5 grants): create_exam, create_post, edit_own_post,
--   handle_messages, upload_media.
--   - create exams as drafts:            exams_insert WITH CHECK = create_exam AND
--                                        (workflow_status <> 'published' OR publish_exam)
--   - edit the exams they created:        own path above (create_exam)
--   - create/edit their own posts:        edit_own_post
--   - create vacancies (sarkari_naukri):  staff_insert_sarkari = create_post
--   - upload media:                       upload_media permission, and staff_upload_media
--                                        only requires auth.uid() IS NOT NULL
--   - read everything published:          public_read_* policies
--
-- WHAT THEY LOSE — measured, this is the reason the owner must decide, not the agent:
--   398 of 404 exams have created_by IS NULL, 112 of 141 content_posts, and ALL 361
--   sarkari_naukri vacancy rows (select count(*) filter (where created_by is null) ...).
--   Those rows were seeded, so the own-row path can never match them. After this change
--   the intern can only edit rows they personally created. This is exactly the intended
--   restriction, but it also means the intern CANNOT do the Phase C vacancy bulk fill:
--   the 361 rows stay admin/editor-only until created_by is backfilled.
--
-- TWO THINGS THIS CHANGE DOES *NOT* RESTRICT (flagged, not fixed here):
--   1. exam_editions / exam_resources / exam_syllabus / exam_syllabus_subjects gate on
--      create_exam OR edit_any_exam with NO created_by test, so the intern can still
--      insert/update an edition, resource or syllabus row for ANY exam. Measured:
--      P1_edit_edition=1 and P2_edit_edition=1 (unchanged by this proposal). Tightening
--      those four policies to the own-row path is a separate, owner-gated change.
--   2. staff_read_all_exam_editions also stays (create_exam OR edit_any_exam) => all
--      editions remain readable.
--
-- ONE PRECONDITION FOR THE CREATE PATH (measured, see PROOF file):
--   The CMS always creates exams with created_by set
--   (src/pages/exams/ExamEditorPage.tsx:292 `createdBy: user?.id`; posts at
--   ContentEditPage.tsx:321, blog at BlogEditPage.tsx:118, vacancies at
--   SarkariNaukriEditPage.tsx:97), and PostgREST always sends `.select()` = INSERT ...
--   RETURNING. Under RLS an INSERT ... RETURNING whose new row is invisible to the
--   INSERTING role fails with 42501 — measured: plain insert OK, same insert with
--   RETURNING and created_by NULL FAILS, same insert with created_by = self OK. So with
--   edit_any_exam gone, a create path that left created_by NULL would break loudly (not
--   silently). Keep createdBy wired in any new create path.

-- ------------------------------------------------------------------ PRE-FLIGHT (read only)
-- Run these first; every one must match the number in the comment before applying.
--   select count(*) from user_profiles up join roles r on r.id = up.role_id
--     where r.slug = 'content-intern';                                    -- 0
--   select array_agg(p.slug order by p.slug)                       -- the 7 slugs below
--     from roles r join role_permissions rp on rp.role_id = r.id
--     join permissions p on p.id = rp.permission_id where r.slug = 'content-intern';
--   -- expected: create_exam, create_post, edit_any_exam, edit_any_post,
--   --           edit_own_post, handle_messages, upload_media

-- ----------------------------------------------------------------------------- THE CHANGE
BEGIN;

DELETE FROM public.role_permissions rp
  USING public.permissions p
  JOIN public.roles r ON r.id = rp.role_id
 WHERE r.slug = 'content-intern'
   AND p.slug IN ('edit_any_exam', 'edit_any_post');

-- ------------------------------------------------------------------------- VERIFY (in tx)
-- Must return exactly 5 rows: create_exam, create_post, edit_own_post, handle_messages,
-- upload_media.
SELECT array_agg(p.slug ORDER BY p.slug) AS content_intern_perms_after
  FROM public.roles r
  JOIN public.role_permissions rp ON rp.role_id = r.id
  JOIN public.permissions p ON p.id = rp.permission_id
 WHERE r.slug = 'content-intern';

-- Spot-check the predicates the role now depends on (all must be true/false as labelled).
--   select public.current_user_has_permission('create_exam');     -- true  (own path)
--   select public.current_user_has_permission('edit_any_exam');   -- false
--   select public.current_user_has_permission('edit_own_post');   -- true
--   select public.current_user_has_permission('upload_media');    -- true

COMMIT;

-- ------------------------------------------------------------------------------ ROLLBACK
-- Restores exactly what migrations 20260919132540 and 20260919140714 granted.
-- BEGIN;
-- INSERT INTO public.role_permissions (role_id, permission_id)
-- SELECT r.id, p.id FROM public.roles r JOIN public.permissions p
--   ON p.slug IN ('edit_any_exam', 'edit_any_post')
--  WHERE r.slug = 'content-intern'
-- ON CONFLICT (role_id, permission_id) DO NOTHING;
-- COMMIT;

-- -------------------------------------------------------------------------------- PROOF
-- supabase/proposed/20261201_content_intern_scope_PROBE.sql runs the before/after matrix
-- with two probe users inside transactions that abort themselves. Measured on the live
-- DB, 2026-11-06 (verbatim, abridged to the decisive lines):
--
--   P1_uid_ok=true P1_role=content-intern P1_has_edit_any_exam=true P1_has_create_exam=true
--   P1_other_visible_total=404   P1_edit_foreign_exam=1   P1_edit_edition=1
--   P1_edit_foreign_post=1       P1_edit_vacancy=1
--   P1_perms=[create_exam create_post edit_any_exam edit_any_post edit_own_post
--             handle_messages upload_media]
--   P2_has_edit_any_exam=false P2_has_edit_any_post=false P2_has_create_exam=true
--   P2_has_edit_own_post=true P2_has_upload_media=true
--   P2_own_visible_total=404     P2_other_visible_total=404   P2_edit_edition=1
--   P2_edit_foreign_exam=0  P2_edit_foreign_post=0  P2_edit_vacancy=0
--   P2_media_select_count=0      (the media TABLE holds 0 rows today; uploads go to the
--                                 storage bucket, whose policy only needs auth.uid())
--
--   Own-row path, after the removal (separate run, entity_type corrected to 'recruitment'
--   for pillar government-exam, created_by = the probe user):
--     own_create=OK own_edit_after_removal=1 own_real_field_edit=1 own_visible_to_self=1
--   Direct publish, before the removal:
--     P1_direct_publish_refused=true  (insert with workflow_status='published' fails 42501
--     because the intern has no publish_exam: the gate stays at publish, not at edit)
--   Seeded corpus, after the removal:
--     foreign_post_edit_after_removal=0   posts_visible=141   vacancies_visible=361
--     (so writes are locked while READS stay complete, for exams, posts AND vacancies)
--
-- NOT measured by the probe (stated so it is not mistaken for a proof): an own-POST
-- create round trip. The probe insert failed on content_posts' own NOT NULL columns
-- (content_type, then a column that does not exist), not on RLS. The own-post edit path
-- itself is proven by the policy text plus the own-exam round trip above.
