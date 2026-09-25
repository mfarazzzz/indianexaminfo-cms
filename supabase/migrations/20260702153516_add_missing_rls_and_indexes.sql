
-- Fix: blog_authors has no staff-write/update policies (CMS can't save new authors)
create policy "staff_write_blog_authors"
  on blog_authors for insert
  with check (auth.uid() is not null);

create policy "staff_update_blog_authors"
  on blog_authors for update
  using (auth.uid() is not null);

create policy "admin_delete_blog_authors"
  on blog_authors for delete
  using (current_user_role() in ('super-admin','admin'));

-- Fix: pages has no staff-write/update policies
create policy "staff_write_pages"
  on pages for insert
  with check (auth.uid() is not null);

create policy "staff_update_pages"
  on pages for update
  using (auth.uid() is not null);

create policy "admin_delete_pages"
  on pages for delete
  using (current_user_role() in ('super-admin','admin'));

-- Fix: menus/menu_items have no staff-write policies
create policy "staff_write_menus"
  on menus for insert
  with check (auth.uid() is not null);

create policy "staff_update_menus"
  on menus for update
  using (auth.uid() is not null);

create policy "staff_write_menu_items"
  on menu_items for insert
  with check (auth.uid() is not null);

create policy "staff_update_menu_items"
  on menu_items for update
  using (auth.uid() is not null);

create policy "admin_delete_menu_items"
  on menu_items for delete
  using (current_user_role() in ('super-admin','admin'));

-- Fix: categories has no staff-write policies
create policy "staff_write_categories"
  on categories for insert
  with check (auth.uid() is not null);

create policy "staff_update_categories"
  on categories for update
  using (auth.uid() is not null);

create policy "admin_delete_categories"
  on categories for delete
  using (current_user_role() in ('super-admin','admin'));

-- Performance: composite index for the most common frontend query pattern
-- (pillar + status + is_featured — used on homepage and pillar pages)
create index if not exists exams_pillar_status_featured_idx
  on exams(pillar, status, is_featured desc);

-- Performance: ad_reports missing date index
create index if not exists ad_reports_date_idx on ad_reports(date desc);
create index if not exists ad_campaigns_advertiser_id_idx
  on ad_campaigns(advertiser_id) where status != 'rejected';

-- Performance: content_posts composite for exam page tabs
create index if not exists content_posts_exam_type_status_idx
  on content_posts(exam_id, content_type, status);
;
