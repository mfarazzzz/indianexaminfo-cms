
-- updated_at trigger
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$ declare t text;
begin
  foreach t in array array['settings','categories','exams','content_posts','blog_posts','pages','menus','ad_campaigns'] loop
    execute format('drop trigger if exists set_updated_at on %I; create trigger set_updated_at before update on %I for each row execute function set_updated_at();', t, t);
  end loop;
end $$;

-- RLS
alter table settings         enable row level security;
alter table categories       enable row level security;
alter table exams             enable row level security;
alter table content_posts    enable row level security;
alter table blog_authors     enable row level security;
alter table blog_posts       enable row level security;
alter table pages            enable row level security;
alter table menus            enable row level security;
alter table menu_items       enable row level security;
alter table media            enable row level security;
alter table advertisers      enable row level security;
alter table ad_zones         enable row level security;
alter table ad_campaigns     enable row level security;
alter table ad_creatives     enable row level security;
alter table ad_reports       enable row level security;
alter table audit_log        enable row level security;
alter table user_profiles    enable row level security;
alter table roles            enable row level security;
alter table permissions      enable row level security;
alter table role_permissions enable row level security;

-- Public read policies
create policy "public_read_categories"   on categories    for select using (is_active = true);
create policy "public_read_exams"        on exams          for select using (true);
create policy "public_read_content"      on content_posts  for select using (status = 'published');
create policy "public_read_blog_authors" on blog_authors   for select using (is_active = true);
create policy "public_read_blog_posts"   on blog_posts     for select using (status = 'published');
create policy "public_read_pages"        on pages          for select using (status = 'published');
create policy "public_read_menus"        on menus          for select using (true);
create policy "public_read_menu_items"   on menu_items     for select using (is_active = true);
create policy "public_read_ad_zones"     on ad_zones       for select using (is_active = true);
create policy "public_read_settings"     on settings       for select using (is_sensitive = false);
create policy "public_read_roles"        on roles          for select using (true);
create policy "public_read_permissions"  on permissions    for select using (true);

-- Auth user policies
create policy "users_read_own_profile"   on user_profiles for select using (id = auth.uid() or current_user_role() in ('super-admin','admin'));
create policy "users_update_own_profile" on user_profiles for update using (id = auth.uid());
create policy "admin_manage_users"       on user_profiles for all    using (current_user_role() in ('super-admin','admin'));

create policy "staff_read_all_exams"     on exams for select using (auth.uid() is not null);
create policy "staff_write_exams"        on exams for insert with check (auth.uid() is not null);
create policy "staff_update_exams"       on exams for update using (auth.uid() is not null);
create policy "admin_delete_exams"       on exams for delete using (current_user_role() in ('super-admin','admin'));

create policy "staff_read_all_content"   on content_posts for select using (auth.uid() is not null);
create policy "staff_write_content"      on content_posts for insert with check (auth.uid() is not null);
create policy "staff_update_content"     on content_posts for update using (auth.uid() is not null);
create policy "admin_delete_content"     on content_posts for delete using (current_user_role() in ('super-admin','admin'));

create policy "staff_read_all_blog"      on blog_posts for select using (auth.uid() is not null);
create policy "staff_write_blog"         on blog_posts for insert with check (auth.uid() is not null);
create policy "staff_update_blog"        on blog_posts for update using (auth.uid() is not null);
create policy "admin_delete_blog"        on blog_posts for delete using (current_user_role() in ('super-admin','admin'));

create policy "staff_read_media"         on media for select using (auth.uid() is not null);
create policy "staff_upload_media"       on media for insert with check (auth.uid() is not null);
create policy "admin_delete_media"       on media for delete using (current_user_role() in ('super-admin','admin'));

create policy "admin_read_all_settings"  on settings for select using (auth.uid() is not null);
create policy "admin_write_settings"     on settings for all   using (current_user_role() in ('super-admin','admin'));

create policy "staff_insert_audit"       on audit_log for insert with check (auth.uid() is not null);
create policy "admin_read_audit"         on audit_log for select using (current_user_role() in ('super-admin','admin'));

create policy "staff_read_ads"           on ad_campaigns for select using (auth.uid() is not null);
create policy "staff_read_advertisers"   on advertisers  for select using (auth.uid() is not null);
create policy "staff_read_ad_reports"    on ad_reports   for select using (auth.uid() is not null);
create policy "admin_manage_ads"         on ad_campaigns for all   using (current_user_role() in ('super-admin','admin','ad-manager'));
create policy "admin_manage_advertisers" on advertisers  for all   using (current_user_role() in ('super-admin','admin','ad-manager'));
;
