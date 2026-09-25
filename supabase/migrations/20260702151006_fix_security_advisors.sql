
-- Fix 1: Add RLS policies for ad_creatives
create policy "staff_read_ad_creatives"  on ad_creatives for select using (auth.uid() is not null);
create policy "admin_manage_ad_creatives" on ad_creatives for all using (current_user_role() in ('super-admin','admin','ad-manager'));

-- Fix 2: Add RLS policies for role_permissions
create policy "public_read_role_permissions" on role_permissions for select using (true);
create policy "admin_manage_role_permissions" on role_permissions for all using (current_user_role() in ('super-admin','admin'));

-- Fix 3: Pin search_path on all functions
create or replace function current_user_role()
returns text language sql stable security definer
set search_path = public, pg_catalog
as $$
  select r.slug
  from user_profiles up
  join roles r on r.id = up.role_id
  where up.id = auth.uid()
  limit 1;
$$;

create or replace function set_updated_at()
returns trigger language plpgsql
set search_path = public, pg_catalog
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function handle_new_user()
returns trigger language plpgsql security definer
set search_path = public, pg_catalog
as $$
begin
  insert into user_profiles (id, name)
  values (new.id, coalesce(new.raw_user_meta_data->>'name', new.email));
  return new;
end;
$$;

-- Fix 4: Revoke EXECUTE on SECURITY DEFINER functions from anon/authenticated
-- current_user_role is legitimately used by RLS — keep it but revoke direct API access
revoke execute on function public.current_user_role() from anon;
-- handle_new_user is a trigger — anon/authenticated should not call it directly
revoke execute on function public.handle_new_user() from anon;
revoke execute on function public.handle_new_user() from authenticated;
;
