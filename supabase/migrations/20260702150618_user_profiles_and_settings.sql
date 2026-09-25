
create table if not exists user_profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  name       text not null,
  avatar     text,
  role_id    uuid references roles(id) on delete set null,
  is_active  boolean not null default true,
  last_login timestamptz,
  created_at timestamptz not null default now()
);

create or replace function handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into user_profiles (id, name)
  values (new.id, coalesce(new.raw_user_meta_data->>'name', new.email));
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

create or replace function current_user_role()
returns text language sql stable security definer as $$
  select r.slug
  from user_profiles up
  join roles r on r.id = up.role_id
  where up.id = auth.uid()
  limit 1;
$$;

create table if not exists settings (
  id           uuid primary key default gen_random_uuid(),
  key          text not null unique,
  value        jsonb not null default 'null'::jsonb,
  "group"      text not null default 'general',
  label        text not null,
  description  text,
  is_sensitive boolean not null default false,
  updated_at   timestamptz not null default now(),
  updated_by   uuid references auth.users(id) on delete set null
);

create index if not exists settings_group_idx on settings("group");
;
