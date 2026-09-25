
create table if not exists categories (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique,
  name        text not null,
  short_name  text,
  pillar      pillar_type not null,
  parent_id   uuid references categories(id) on delete set null,
  description text,
  icon        text,
  color       text,
  order_index integer not null default 0,
  is_active   boolean not null default true,
  exam_count  integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists categories_pillar_idx    on categories(pillar);
create index if not exists categories_parent_id_idx on categories(parent_id);
create index if not exists categories_slug_idx      on categories(slug);

create table if not exists exams (
  id                   uuid primary key default gen_random_uuid(),
  slug                 text not null unique,
  name                 text not null,
  short_name           text not null,
  pillar               pillar_type not null,
  category_id          uuid references categories(id) on delete set null,
  subcategory_id       uuid references categories(id) on delete set null,
  entity_type          entity_type not null default 'exam',
  conducting_body      text not null,
  official_website     text,
  status               exam_status not null default 'upcoming',
  has_admit_card       boolean not null default false,
  has_result           boolean not null default false,
  has_answer_key       boolean not null default false,
  has_syllabus         boolean not null default false,
  has_date_sheet       boolean not null default false,
  has_mock_test        boolean not null default false,
  has_previous_papers  boolean not null default false,
  has_study_material   boolean not null default false,
  has_application      boolean not null default false,
  has_notification     boolean not null default false,
  has_cutoff           boolean not null default false,
  vacancy              integer,
  academic_year        text,
  semester             text,
  admission_to         text,
  eligibility          jsonb not null default '{}'::jsonb,
  application_fee      jsonb not null default '{}'::jsonb,
  important_dates      jsonb not null default '[]'::jsonb,
  faqs                 jsonb not null default '[]'::jsonb,
  selection_process    text[] not null default '{}',
  syllabus_highlights  text[] not null default '{}',
  tags                 text[] not null default '{}',
  search_keywords      text[] not null default '{}',
  seo_title            text,
  seo_description      text,
  is_featured          boolean not null default false,
  last_updated         date not null default current_date,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  created_by           uuid references auth.users(id) on delete set null
);
create index if not exists exams_pillar_idx      on exams(pillar);
create index if not exists exams_category_id_idx on exams(category_id);
create index if not exists exams_status_idx      on exams(status);
create index if not exists exams_is_featured_idx on exams(is_featured);
create index if not exists exams_slug_idx        on exams(slug);
create index if not exists exams_tags_idx        on exams using gin(tags);
create index if not exists exams_keywords_idx    on exams using gin(search_keywords);
;
