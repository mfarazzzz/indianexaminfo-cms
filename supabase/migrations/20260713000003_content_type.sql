-- Migration: 003_content_type
-- Task: M1-T3
-- Requirements: REQ-002, REQ-007
-- Design: Section 2.2

create table if not exists content_type (
  id                      uuid        primary key default gen_random_uuid(),
  pillar_id               uuid        not null references pillar(id) on delete restrict,
  slug                    text        not null unique,
  label                   text        not null,
  url_pattern             text        not null,
  default_schema_org_type text        not null default 'Article',
  is_active               boolean     not null default true,
  display_order           integer     not null default 0,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  deleted_at              timestamptz
);

create index if not exists idx_content_type_pillar
  on content_type(pillar_id)
  where is_active = true and deleted_at is null;

alter table content_type enable row level security;

create policy "ct_select" on content_type
  for select to authenticated
  using (deleted_at is null);

create policy "ct_write" on content_type
  for all to authenticated
  using (has_permission('manage_structural_taxonomy'))
  with check (has_permission('manage_structural_taxonomy'));

-- Seed content types per pillar
-- Recruitment pillar
insert into content_type (pillar_id, slug, label, url_pattern, default_schema_org_type, display_order)
select p.id, ct.slug, ct.label, ct.url_pattern, ct.schema_org, ct.ord
from pillar p, (values
  ('notification',     'Notification',     '/{slug}/notification',  'JobPosting',  1),
  ('result',           'Result',           '/{slug}/result',        'JobPosting',  2),
  ('admit-card',       'Admit Card',       '/{slug}/admit-card',    'JobPosting',  3),
  ('answer-key',       'Answer Key',       '/{slug}/answer-key',    'Article',     4),
  ('cutoff',           'Cutoff',           '/{slug}/cutoff',        'Article',     5),
  ('vacancy-details',  'Vacancy Details',  '/{slug}/vacancy',       'JobPosting',  6)
) as ct(slug, label, url_pattern, schema_org, ord)
where p.slug = 'recruitment'
on conflict (slug) do nothing;

-- Entrance Exams pillar
insert into content_type (pillar_id, slug, label, url_pattern, default_schema_org_type, display_order)
select p.id, ct.slug, ct.label, ct.url_pattern, ct.schema_org, ct.ord
from pillar p, (values
  ('entrance-notification','Notification',   '/{slug}/notification','Article', 1),
  ('entrance-result',      'Result',         '/{slug}/result',      'Article', 2),
  ('entrance-admit-card',  'Admit Card',     '/{slug}/admit-card',  'Article', 3),
  ('entrance-counselling', 'Counselling',    '/{slug}/counselling', 'Article', 4)
) as ct(slug, label, url_pattern, schema_org, ord)
where p.slug = 'entrance-exam'
on conflict (slug) do nothing;

-- University / Board pillar
insert into content_type (pillar_id, slug, label, url_pattern, default_schema_org_type, display_order)
select p.id, ct.slug, ct.label, ct.url_pattern, ct.schema_org, ct.ord
from pillar p, (values
  ('exam-schedule', 'Exam Schedule', '/{slug}/schedule', 'Course', 1),
  ('hall-ticket',   'Hall Ticket',   '/{slug}/hall-ticket','Course',2),
  ('board-result',  'Result',        '/{slug}/result',   'Course', 3)
) as ct(slug, label, url_pattern, schema_org, ord)
where p.slug = 'board-university'
on conflict (slug) do nothing;

-- News & Editorial pillar
insert into content_type (pillar_id, slug, label, url_pattern, default_schema_org_type, display_order)
select p.id, ct.slug, ct.label, ct.url_pattern, ct.schema_org, ct.ord
from pillar p, (values
  ('news',      'News',     '/news/{slug}',      'NewsArticle', 1),
  ('blog-post', 'Blog',     '/blog/{slug}',      'BlogPosting', 2),
  ('editorial', 'Editorial','/{slug}',           'Article',     3),
  ('guide',     'Guide',    '/guide/{slug}',     'HowTo',       4),
  ('analysis',  'Analysis', '/analysis/{slug}',  'Article',     5),
  ('faq',       'FAQ',      '/faq/{slug}',       'FAQPage',     6)
) as ct(slug, label, url_pattern, schema_org, ord)
where p.slug = 'news-editorial'
on conflict (slug) do nothing;
