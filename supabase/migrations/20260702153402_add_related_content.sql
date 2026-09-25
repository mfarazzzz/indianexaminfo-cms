
-- Structured related content — lightweight join table
-- Supports exam↔exam, blog↔exam, content↔content cross-links
-- Backward compatible: existing related_exam_slugs[] on blog_posts still works

create table if not exists related_content (
  id            uuid primary key default gen_random_uuid(),
  source_type   text not null check (source_type in ('exam','content_post','blog_post')),
  source_id     uuid not null,
  target_type   text not null check (target_type in ('exam','content_post','blog_post')),
  target_id     uuid not null,
  relation_type text not null default 'related'
    check (relation_type in ('related','prerequisite','series_next','series_prev','see_also')),
  order_index   integer not null default 0,
  created_at    timestamptz not null default now(),
  unique (source_type, source_id, target_type, target_id)
);

create index if not exists related_content_source_idx on related_content(source_type, source_id);

alter table related_content enable row level security;

create policy "public_read_related_content"
  on related_content for select using (true);

create policy "editor_manage_related_content"
  on related_content for all
  using (current_user_role() in ('super-admin','admin','editor'));
;
