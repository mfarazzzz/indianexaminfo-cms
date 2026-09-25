
-- Publishing scheduler: scheduled_at column on content tables
-- When scheduled_at is set and status='review', a cron job or edge function
-- can flip status to 'published' at the scheduled time.
-- Backward compatible — column is nullable; existing rows unaffected.

alter table content_posts add column if not exists scheduled_at timestamptz;
alter table blog_posts     add column if not exists scheduled_at timestamptz;
alter table exams          add column if not exists scheduled_at timestamptz;

create index if not exists content_posts_scheduled_idx on content_posts(scheduled_at)
  where scheduled_at is not null;
create index if not exists blog_posts_scheduled_idx on blog_posts(scheduled_at)
  where scheduled_at is not null;

-- Content locking: prevents two editors editing the same row simultaneously
-- locked_by = uuid of the editor holding the lock
-- locked_at = when the lock was acquired (auto-expires after 15 min via app logic)

alter table content_posts add column if not exists locked_by  uuid references auth.users(id) on delete set null;
alter table content_posts add column if not exists locked_at  timestamptz;
alter table blog_posts    add column if not exists locked_by  uuid references auth.users(id) on delete set null;
alter table blog_posts    add column if not exists locked_at  timestamptz;
alter table exams         add column if not exists locked_by  uuid references auth.users(id) on delete set null;
alter table exams         add column if not exists locked_at  timestamptz;

-- Function: acquire a lock (returns true on success, false if locked by someone else)
create or replace function acquire_content_lock(
  p_table     text,
  p_id        uuid,
  p_user_id   uuid,
  p_ttl_mins  integer default 15
)
returns boolean language plpgsql security definer
set search_path = public, pg_catalog as $$
declare
  v_locked_by uuid;
  v_locked_at timestamptz;
  v_sql       text;
begin
  v_sql := format('select locked_by, locked_at from %I where id = $1', p_table);
  execute v_sql into v_locked_by, v_locked_at using p_id;

  -- Lock is free, expired, or held by same user
  if v_locked_by is null
     or v_locked_at < now() - (p_ttl_mins || ' minutes')::interval
     or v_locked_by = p_user_id
  then
    execute format(
      'update %I set locked_by = $1, locked_at = now() where id = $2',
      p_table
    ) using p_user_id, p_id;
    return true;
  end if;

  return false; -- locked by someone else
end;
$$;

-- Function: release a lock
create or replace function release_content_lock(
  p_table    text,
  p_id       uuid,
  p_user_id  uuid
)
returns void language plpgsql security definer
set search_path = public, pg_catalog as $$
begin
  execute format(
    'update %I set locked_by = null, locked_at = null where id = $1 and locked_by = $2',
    p_table
  ) using p_id, p_user_id;
end;
$$;
;
