-- A3 PROOF — content-intern scope, WITH a probe user. SAFE BY CONSTRUCTION.
--
-- Owner batch 7, A3 (proposal only, no apply). This file proves what the role can and
-- cannot do BEFORE and AFTER removing edit_any_exam + edit_any_post, using two probe
-- users created inside the transaction.
--
-- Why it cannot leave a trace: the LAST statement is `raise exception`, which aborts the
-- whole transaction, so every write here (auth.users rows, user_profiles rows, the probe
-- exam, the two grant deletions, every no-op UPDATE) is rolled back. There is no COMMIT
-- anywhere in this file. Run it as ONE statement/paste; do not split it.
--
-- Reads (unchanged by this file, run them first if you want the baseline):
--   select array_agg(p.slug order by p.slug)
--     from roles r join role_permissions rp on rp.role_id = r.id
--     join permissions p on p.id = rp.permission_id
--    where r.slug = 'content-intern';                      -- 7 slugs today
--   select count(*) from user_profiles up
--     join roles r on r.id = up.role_id where r.slug = 'content-intern';   -- 0 today
--
-- The error text IS the report: lines are formatted `PHASE_measure=value`.

do $a3$
declare
  intern uuid := 'a3a3a3a3-0000-4000-8000-000000000001';
  other  uuid := 'a3a3a3a3-0000-4000-8000-000000000002';
  rid    uuid;
  reg    text;
  e_any  uuid;   -- a published exam whose created_by IS NULL (the real corpus)
  e_own  uuid;   -- the draft the intern creates inside this tx
  p_any  uuid;   -- content_posts row with created_by IS NULL
  v_any  uuid;   -- sarkari_naukri row with created_by IS NULL
  ed_any uuid;   -- an edition belonging to e_any
  n int; cnt int; ok boolean; perms text;
  out text := '';
begin
  ------------------------------------------------------------- pre-flight (fail loudly)
  select id into rid from public.roles where slug = 'content-intern';
  if rid is null then raise exception 'A3-PRECHECK: role content-intern not found'; end if;
  select count(*) into n from auth.users u where u.id in (intern, other);
  if n > 0 then raise exception 'A3-PRECHECK: probe uuid already present, aborting'; end if;
  select count(*) into n from public.exams where slug = 'zz-a3-probe-intern-exam';
  if n > 0 then raise exception 'A3-PRECHECK: probe exam slug already used'; end if;

  select slug into reg from public.regions order by slug limit 1;
  select id into e_any from public.exams
    where created_by is null and workflow_status = 'published' order by updated_at limit 1;
  select id into p_any from public.content_posts where created_by is null order by updated_at limit 1;
  select id into v_any from public.sarkari_naukri where created_by is null order by updated_at limit 1;
  select id into ed_any from public.exam_editions where exam_id = e_any order by year limit 1;

  -- two probe principals, both holding content-intern (role_id is the only mapping;
  -- there is no user_roles table)
  -- the auth.users insert auto-creates a user_profiles row (handle_new_user trigger), so
  -- the profile is UPSERTed - and role_id MUST end up as content-intern, because
  -- current_user_has_permission() reads user_profiles.role_id via auth.uid().
  insert into auth.users (id, email) values (intern, 'a3-probe-intern@example.invalid'),
                                           (other , 'a3-probe-other@example.invalid');
  insert into public.user_profiles (id, name, role_id, is_active)
    values (intern, 'A3 Probe Intern', rid, true), (other, 'A3 Probe Other', rid, true)
    on conflict (id) do update
      set name = excluded.name, role_id = excluded.role_id, is_active = true;

  ---------------------------- PHASE 1 = the role AS IT STANDS (edit_any_* granted) ----
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims',
                     json_build_object('sub', intern::text, 'role', 'authenticated')::text, true);

  -- sanity: the probe user really resolves to the role under test
  out := out || 'P1_uid_ok=' || (auth.uid() = intern)
                || ' P1_has_edit_any_exam=' || public.current_user_has_permission('edit_any_exam')
                || ' P1_has_create_exam='   || public.current_user_has_permission('create_exam')
                || ' P1_role=' || coalesce(public.current_user_role(), '(null)') || ' |';

  ok := true;
  begin
    -- pillar/entity_type must agree (CHECK exams_pillar_entity_type_valid):
    -- government-exam -> recruitment, entrance-exam -> exam, board-exam -> board, ...
    insert into public.exams (slug, name, short_name, pillar, entity_type, conducting_body, region,
                              workflow_status, is_published, created_by)
      values ('zz-a3-probe-intern-exam', 'A3 Probe Intern Exam', 'A3PROBE', 'government-exam',
              'recruitment', 'UPSC', reg, 'draft', false, intern)
      returning id into e_own;
  exception when others then ok := false; out := out || ' (insert err: ' || sqlerrm || ')'; end;
  out := out || 'P1_create_own_exam=' || ok;

  -- Can a DIFFERENT intern see the draft?  With edit_any_exam: yes (staff_read policy).
  perform set_config('request.jwt.claims',
                     json_build_object('sub', other::text, 'role', 'authenticated')::text, true);
  select count(*) into cnt from public.exams where slug = 'zz-a3-probe-intern-exam';
  out := out || ' P1_other_sees_foreign_draft=' || cnt;
  select count(*) into cnt from public.exams;
  out := out || ' P1_other_visible_total=' || cnt;

  perform set_config('request.jwt.claims',
                     json_build_object('sub', intern::text, 'role', 'authenticated')::text, true);
  begin update public.exams set is_featured = is_featured where id = e_any;
        get diagnostics n = row_count;
  exception when others then n := -1; out := out || ' (err: ' || sqlerrm || ')'; end;
  out := out || ' P1_edit_foreign_exam=' || n;

  begin update public.exams set is_featured = is_featured where id = e_own;
        get diagnostics n = row_count;
  exception when others then n := -1; end;
  out := out || ' P1_edit_own_exam=' || n;

  -- editions gate on create_exam OR edit_any_exam, so they must stay =1 in BOTH phases
  begin update public.exam_editions set is_current = is_current where id = ed_any;
        get diagnostics n = row_count;
  exception when others then n := -1; end;
  out := out || ' P1_edit_edition=' || n;

  begin update public.content_posts set slug = slug where id = p_any;
        get diagnostics n = row_count;
  exception when others then n := -1; end;
  out := out || ' P1_edit_foreign_post=' || n;

  begin update public.sarkari_naukri set slug = slug where id = v_any;
        get diagnostics n = row_count;
  exception when others then n := -1; end;
  out := out || ' P1_edit_vacancy=' || n;

  select string_agg(slug, ' ' order by slug) into perms
    from (select p.slug from role_permissions rp join permissions p on p.id = rp.permission_id
           where rp.role_id = rid) s;
  out := out || ' P1_perms=[' || perms || ']';

  ---------------------------- THE CHANGE UNDER TEST (identical to the proposal) -------
  reset role;
  delete from public.role_permissions rp
    using permissions p
   where rp.permission_id = p.id
     and rp.role_id = rid
     and p.slug in ('edit_any_exam', 'edit_any_post');

  ----------------------- PHASE 2 = the role AFTER the removal -------------------------
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims',
                     json_build_object('sub', intern::text, 'role', 'authenticated')::text, true);

  -- sanity: the removal is really visible to the RLS predicate path
  out := out || ' | P2_has_edit_any_exam=' || public.current_user_has_permission('edit_any_exam')
                || ' P2_has_edit_any_post=' || public.current_user_has_permission('edit_any_post')
                || ' P2_has_create_exam=' || public.current_user_has_permission('create_exam')
                || ' P2_has_edit_own_post=' || public.current_user_has_permission('edit_own_post')
                || ' P2_has_upload_media=' || public.current_user_has_permission('upload_media');

  select count(*) into cnt from public.exams;
  out := out || ' | P2_own_visible_total=' || cnt;
  begin
    insert into public.exams (slug, name, short_name, pillar, entity_type, conducting_body, region,
                              workflow_status, is_published, created_by)
      values ('zz-a3-probe-intern-exam2', 'A3 Probe Intern Exam 2', 'A3PROBE2', 'government-exam',
              'recruitment', 'UPSC', reg, 'draft', false, intern);
    ok := true;
  exception when others then ok := false; end;
  out := out || ' P2_create_own_exam=' || ok;

  begin update public.exams set is_featured = is_featured where id = e_any;
        get diagnostics n = row_count;
  exception when others then n := -1; end;
  out := out || ' P2_edit_foreign_exam=' || n;

  begin update public.exams set is_featured = is_featured where id = e_own;
        get diagnostics n = row_count;
  exception when others then n := -1; end;
  out := out || ' P2_edit_own_exam=' || n;

  begin update public.exam_editions set is_current = is_current where id = ed_any;
        get diagnostics n = row_count;
  exception when others then n := -1; end;
  out := out || ' P2_edit_edition=' || n;

  begin update public.content_posts set slug = slug where id = p_any;
        get diagnostics n = row_count;
  exception when others then n := -1; end;
  out := out || ' P2_edit_foreign_post=' || n;

  begin update public.sarkari_naukri set slug = slug where id = v_any;
        get diagnostics n = row_count;
  exception when others then n := -1; end;
  out := out || ' P2_edit_vacancy=' || n;

  select count(*) into cnt from public.media where 1 = 0;   -- reads still allowed
  out := out || ' P2_media_select_ok=' || (cnt >= 0);

  perform set_config('request.jwt.claims',
                     json_build_object('sub', other::text, 'role', 'authenticated')::text, true);
  select count(*) into cnt from public.exams where slug = 'zz-a3-probe-intern-exam';
  out := out || ' P2_other_sees_foreign_draft=' || cnt;
  select count(*) into cnt from public.exams;
  out := out || ' P2_other_visible_total=' || cnt;

  --------------------------------------------------------------------------------------
  raise exception 'IEI-A3-PROBE (transaction aborted on purpose, nothing persisted): %', out;
end
$a3$;

-- ---------------------------------------------------------------------------------------
-- SECOND BLOCK — why a create path must keep setting created_by. Same rollback trick.
-- Measured on the live DB 2026-11-06:
--   A_plain_insert=OK
--   B_returning_insert=FAIL(42501:new row violates row-level security poli)
--   C_returning_insert_own=OK(id=..., self_visible_rows=1)
-- PostgREST always issues INSERT ... RETURNING (`.select()`), so an exam row that the
-- inserting role cannot see yet fails loudly once edit_any_exam is gone. The CMS does set
-- created_by (src/pages/exams/ExamEditorPage.tsx:292), which is case C.
-- ---------------------------------------------------------------------------------------

do $a3d$
declare
  intern uuid := 'a3a3a3a3-0000-4000-8000-000000000001';
  rid uuid; reg text; e1 uuid; e2 uuid; n int; a text := ''; b text := ''; c text := '';
begin
  select id into rid from public.roles where slug = 'content-intern';
  select slug into reg from public.regions order by slug limit 1;
  insert into auth.users (id, email) values (intern, 'a3-probe-intern@example.invalid')
    on conflict (id) do nothing;
  insert into public.user_profiles (id, name, role_id, is_active)
    values (intern, 'A3 Probe Intern', rid, true)
    on conflict (id) do update set role_id = excluded.role_id, is_active = true;

  reset role;
  delete from public.role_permissions rp using permissions p
    where rp.permission_id = p.id and rp.role_id = rid
      and p.slug in ('edit_any_exam', 'edit_any_post');

  execute 'set local role authenticated';
  perform set_config('request.jwt.claims',
                     json_build_object('sub', intern::text, 'role', 'authenticated')::text, true);

  begin
    insert into public.exams (slug, name, short_name, pillar, entity_type, conducting_body,
                              region, workflow_status)
      values ('zz-a3-ab-noreturn', 'A3 AB NoReturn', 'A3ABNR', 'government-exam', 'recruitment',
              'UPSC', reg, 'draft');
    a := 'A_plain_insert=OK';
  exception when others then a := 'A_plain_insert=FAIL(' || sqlstate || ':' || left(sqlerrm, 40) || ')';
  end;

  begin
    insert into public.exams (slug, name, short_name, pillar, entity_type, conducting_body,
                              region, workflow_status)
      values ('zz-a3-ab-return', 'A3 AB Return', 'A3ABR', 'government-exam', 'recruitment',
              'UPSC', reg, 'draft')
      returning id into e1;
    b := 'B_returning_insert=OK';
  exception when others then b := 'B_returning_insert=FAIL(' || sqlstate || ':' || left(sqlerrm, 40) || ')';
  end;

  begin
    insert into public.exams (slug, name, short_name, pillar, entity_type, conducting_body,
                              region, workflow_status, created_by)
      values ('zz-a3-ab-return-cb', 'A3 AB Return CB', 'A3ABRCB', 'government-exam', 'recruitment',
              'UPSC', reg, 'draft', intern)
      returning id into e2;
    select count(*) into n from public.exams where id = e2;
    c := 'C_returning_insert_own=OK(self_visible_rows=' || n || ')';
  exception when others then c := 'C_returning_insert_own=FAIL(' || sqlerrm || ')';
  end;

  raise exception 'IEI-A3-AB % || % || %', a, b, c;
end
$a3d$;
