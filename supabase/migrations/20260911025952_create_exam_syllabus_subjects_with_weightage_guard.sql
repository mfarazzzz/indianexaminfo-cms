
-- Structured, identity-level syllabus (Option A): subjects with topics + typed weightage.
-- Relational (not jsonb) so a real CHECK constraint + trigger enforce the weightage shape
-- across ALL write paths (CMS form, Excel import, AI Fill, any future bulk tool) — not just
-- the service layer. This is the first guard that covers every writer, not one path.

-- Per-exam weightage unit lives on exams; each subject's numeric weightage is validated
-- against it. Values are numeric + comparable (the SEO win eligibility lacked).
alter table exams
  add column if not exists syllabus_weightage_type text
  check (syllabus_weightage_type in ('marks','questions','percent'));

create table if not exists exam_syllabus_subjects (
  id              uuid primary key default gen_random_uuid(),
  exam_id         uuid not null references exams(id) on delete cascade,
  subject         text not null,
  topics          text,                      -- freeform key topics
  weightage_value numeric,                    -- number in the exam's unit; nullable (unenriched)
  display_order   integer not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists exam_syllabus_subjects_exam_idx
  on exam_syllabus_subjects (exam_id, display_order);

-- ── Trigger guard: a subject can only carry a weightage_value if its exam has declared a
-- weightage_type. Prevents an orphaned number with no unit (the "45" that means nothing) —
-- enforced at the DB, so ANY writer is covered.
create or replace function enforce_syllabus_weightage_unit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  ex_type text;
begin
  if new.weightage_value is not null then
    select syllabus_weightage_type into ex_type from exams where id = new.exam_id;
    if ex_type is null then
      raise exception 'exam_syllabus_subjects.weightage_value set (%) but exam % has no syllabus_weightage_type — set the exam unit first', new.weightage_value, new.exam_id;
    end if;
    if new.weightage_value < 0 then
      raise exception 'weightage_value must be >= 0';
    end if;
  end if;
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_syllabus_weightage_unit
  before insert or update on exam_syllabus_subjects
  for each row execute function enforce_syllabus_weightage_unit();

alter table exam_syllabus_subjects enable row level security;

-- Mirror exams RLS: public reads (only for published exams), staff read-all, staff write, admin delete.
create policy public_read_exam_syllabus_subjects on exam_syllabus_subjects
  for select using (
    exists (select 1 from exams where exams.id = exam_syllabus_subjects.exam_id and exams.is_published = true)
  );
create policy staff_read_all_exam_syllabus_subjects on exam_syllabus_subjects
  for select using (auth.uid() is not null);
create policy staff_write_exam_syllabus_subjects on exam_syllabus_subjects
  for insert with check (auth.uid() is not null);
create policy staff_update_exam_syllabus_subjects on exam_syllabus_subjects
  for update using (auth.uid() is not null);
create policy admin_delete_exam_syllabus_subjects on exam_syllabus_subjects
  for delete using (
    exists (select 1 from user_profiles up join roles r on r.id = up.role_id
            where up.id = auth.uid() and r.slug = any (array['super-admin','admin']))
  );
;
