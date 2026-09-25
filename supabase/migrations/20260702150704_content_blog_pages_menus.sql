
create table if not exists content_posts (
  id               uuid primary key default gen_random_uuid(),
  slug             text not null unique,
  title            text not null,
  excerpt          text,
  content          text,
  exam_id          uuid references exams(id) on delete set null,
  exam_entity_name text not null default '',
  pillar           pillar_type not null,
  content_type     content_type not null,
  quick_links      jsonb not null default '[]'::jsonb,
  important_dates  jsonb not null default '[]'::jsonb,
  faqs             jsonb not null default '[]'::jsonb,
  featured_image   text,
  tags             text[] not null default '{}',
  seo_title        text,
  seo_description  text,
  status           post_status not null default 'draft',
  is_featured      boolean not null default false,
  views            integer not null default 0,
  published_at     timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  created_by       uuid references auth.users(id) on delete set null,
  updated_by       uuid references auth.users(id) on delete set null
);
create index if not exists content_posts_exam_id_idx      on content_posts(exam_id);
create index if not exists content_posts_content_type_idx on content_posts(content_type);
create index if not exists content_posts_pillar_idx       on content_posts(pillar);
create index if not exists content_posts_status_idx       on content_posts(status);
create index if not exists content_posts_slug_idx         on content_posts(slug);
create index if not exists content_posts_tags_idx         on content_posts using gin(tags);
create index if not exists content_posts_published_at_idx on content_posts(published_at desc);

create table if not exists blog_authors (
  id             uuid primary key default gen_random_uuid(),
  slug           text not null unique,
  name           text not null,
  designation    text,
  avatar         text,
  bio            text,
  total_posts    integer not null default 0,
  specialization text[] not null default '{}',
  social_links   jsonb not null default '{}'::jsonb,
  is_active      boolean not null default true,
  created_at     timestamptz not null default now()
);

create table if not exists blog_posts (
  id                     uuid primary key default gen_random_uuid(),
  slug                   text not null unique,
  title                  text not null,
  excerpt                text,
  content                text,
  section                blog_section not null,
  post_type              post_type,
  author_id              uuid references blog_authors(id) on delete set null,
  featured_image         text,
  featured_image_caption text,
  reading_time           integer,
  word_count             integer,
  views                  integer not null default 0,
  shares                 integer not null default 0,
  tags                   text[] not null default '{}',
  related_exam_slugs     text[] not null default '{}',
  table_of_contents      jsonb not null default '[]'::jsonb,
  faqs                   jsonb not null default '[]'::jsonb,
  seo_title              text,
  seo_description        text,
  canonical_url          text,
  status                 post_status not null default 'draft',
  is_featured            boolean not null default false,
  is_breaking            boolean not null default false,
  is_pinned              boolean not null default false,
  published_at           timestamptz,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  created_by             uuid references auth.users(id) on delete set null,
  updated_by             uuid references auth.users(id) on delete set null
);
create index if not exists blog_posts_section_idx      on blog_posts(section);
create index if not exists blog_posts_author_id_idx    on blog_posts(author_id);
create index if not exists blog_posts_status_idx       on blog_posts(status);
create index if not exists blog_posts_slug_idx         on blog_posts(slug);
create index if not exists blog_posts_tags_idx         on blog_posts using gin(tags);
create index if not exists blog_posts_published_at_idx on blog_posts(published_at desc);

create table if not exists pages (
  id               uuid primary key default gen_random_uuid(),
  slug             text not null unique,
  title            text not null,
  content          text,
  meta_title       text,
  meta_description text,
  is_system        boolean not null default false,
  status           page_status not null default 'draft',
  order_index      integer not null default 0,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  updated_by       uuid references auth.users(id) on delete set null
);

create table if not exists menus (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique,
  name        text not null,
  description text,
  updated_at  timestamptz not null default now(),
  updated_by  uuid references auth.users(id) on delete set null
);

create table if not exists menu_items (
  id               uuid primary key default gen_random_uuid(),
  menu_id          uuid not null references menus(id) on delete cascade,
  parent_id        uuid references menu_items(id) on delete cascade,
  label            text not null,
  url              text,
  opens_in_new_tab boolean not null default false,
  icon             text,
  badge            text,
  badge_color      text,
  order_index      integer not null default 0,
  is_active        boolean not null default true,
  exam_id          uuid references exams(id) on delete set null,
  category_id      uuid references categories(id) on delete set null,
  created_at       timestamptz not null default now()
);
create index if not exists menu_items_menu_id_idx   on menu_items(menu_id);
create index if not exists menu_items_parent_id_idx on menu_items(parent_id);
;
