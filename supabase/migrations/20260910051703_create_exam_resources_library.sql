
-- exam_resources — the ACCUMULATED LIBRARY (level 3): year-tagged materials that grow
-- across cycles (previous papers, study material, mock tests, sample papers, syllabus PDFs).
-- Attached to the EXAM identity (not an edition): year is a free integer, NOT an edition FK,
-- so a 2019 paper can exist on an exam whose oldest edition is 2026.

create table if not exists exam_resources (
  id                  uuid primary key default gen_random_uuid(),
  exam_id             uuid not null references exams(id) on delete cascade,
  kind                text not null check (kind in (
                        'previous-paper', 'study-material', 'mock-test', 'sample-paper', 'syllabus-pdf'
                      )),
  year                integer,                 -- free int, nullable; NOT an edition FK
  stage_label         text,                    -- e.g. "Tier I", "Prelims"
  title               text not null,
  url                 text not null,           -- normalized on write (service layer)
  description         text,
  language            text,                    -- Hindi / English / etc.
  paper_type          text,                    -- e.g. paper vs answer-key pairing
  file_size_kb        integer,
  related_resource_id uuid references exam_resources(id) on delete set null,  -- self-FK (paper↔key)
  source_url          text,                    -- provenance (where the file came from)
  is_published        boolean not null default true,
  display_order       integer not null default 0,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  created_by          uuid references user_profiles(id) on delete set null,
  deleted_at          timestamptz
);

create index if not exists exam_resources_exam_id_idx     on exam_resources (exam_id);
create index if not exists exam_resources_exam_kind_year_idx on exam_resources (exam_id, kind, year desc);
create index if not exists exam_resources_published_idx    on exam_resources (exam_id) where is_published = true and deleted_at is null;

alter table exam_resources enable row level security;

-- Public read: only for published exams, only published, non-deleted rows (Q2 enforced here too).
create policy public_read_exam_resources on exam_resources
  for select using (
    is_published = true and deleted_at is null
    and exists (select 1 from exams where exams.id = exam_resources.exam_id and exams.is_published = true)
  );

-- Staff (any authenticated user) can insert/update; admins can delete — mirrors exam_editions.
create policy staff_write_exam_resources on exam_resources
  for insert with check (auth.uid() is not null);

create policy staff_update_exam_resources on exam_resources
  for update using (auth.uid() is not null);

create policy admin_delete_exam_resources on exam_resources
  for delete using (
    exists (
      select 1 from user_profiles up join roles r on r.id = up.role_id
      where up.id = auth.uid() and r.slug = any (array['super-admin','admin'])
    )
  );
;
