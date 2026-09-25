
-- Redirects table — manages 301/302 URL redirects sitewide
-- Used by Next.js middleware or a /api/redirect handler to serve redirects dynamically

create table if not exists redirects (
  id          uuid primary key default gen_random_uuid(),
  from_path   text not null unique,
  to_path     text not null,
  type        smallint not null default 301 check (type in (301, 302)),
  is_active   boolean not null default true,
  hits        integer not null default 0,
  note        text,
  created_at  timestamptz not null default now(),
  created_by  uuid references auth.users(id) on delete set null
);

create index if not exists redirects_from_path_idx on redirects(from_path);
create index if not exists redirects_is_active_idx  on redirects(is_active);

alter table redirects enable row level security;

create policy "public_read_redirects"
  on redirects for select
  using (is_active = true);

create policy "admin_manage_redirects"
  on redirects for all
  using (current_user_role() in ('super-admin','admin'));
;
