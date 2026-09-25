
-- Editorial comments — internal review thread attached to any content entity
-- Supports threaded replies via parent_id
-- Visible only to authenticated CMS users (never public)

create table if not exists editorial_comments (
  id           uuid primary key default gen_random_uuid(),
  entity_type  text not null check (entity_type in ('exam','content_post','blog_post','page')),
  entity_id    uuid not null,
  parent_id    uuid references editorial_comments(id) on delete cascade,
  author_id    uuid not null references auth.users(id) on delete cascade,
  body         text not null,
  is_resolved  boolean not null default false,
  resolved_by  uuid references auth.users(id) on delete set null,
  resolved_at  timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists editorial_comments_entity_idx
  on editorial_comments(entity_type, entity_id);
create index if not exists editorial_comments_parent_idx
  on editorial_comments(parent_id);

create trigger set_updated_at
  before update on editorial_comments
  for each row execute function set_updated_at();

alter table editorial_comments enable row level security;

-- Staff can read all comments on entities they can access
create policy "staff_read_editorial_comments"
  on editorial_comments for select
  using (auth.uid() is not null);

-- Any authenticated user can post a comment
create policy "staff_insert_editorial_comments"
  on editorial_comments for insert
  with check (auth.uid() is not null and author_id = auth.uid());

-- Authors can edit their own comments; admins can edit any
create policy "author_update_own_comment"
  on editorial_comments for update
  using (
    author_id = auth.uid()
    or current_user_role() in ('super-admin','admin','editor')
  );

-- Only admins can delete comments
create policy "admin_delete_editorial_comments"
  on editorial_comments for delete
  using (current_user_role() in ('super-admin','admin'));
;
