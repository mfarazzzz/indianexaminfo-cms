
insert into roles (slug, name, description, is_system) values
  ('super-admin', 'Super Admin',   'Full access to all features',     true),
  ('admin',       'Admin',         'Manages content and users',       true),
  ('editor',      'Editor',        'Can publish content',             true),
  ('writer',      'Writer',        'Can create and edit own content', true),
  ('ad-manager',  'Ad Manager',    'Manages advertising campaigns',   true),
  ('viewer',      'Viewer',        'Read-only access to CMS',         true)
on conflict (slug) do nothing;

insert into permissions (slug, label, "group") values
  ('create_post','Create Post','content'), ('edit_any_post','Edit Any Post','content'),
  ('edit_own_post','Edit Own Post','content'), ('delete_post','Delete Post','content'),
  ('publish_post','Publish Post','content'), ('create_exam','Create Exam','content'),
  ('edit_any_exam','Edit Any Exam','content'), ('delete_exam','Delete Exam','content'),
  ('publish_exam','Publish Exam','content'), ('manage_categories','Manage Categories','structure'),
  ('manage_menus','Manage Menus','structure'), ('manage_pages','Manage Pages','structure'),
  ('upload_media','Upload Media','media'), ('delete_media','Delete Media','media'),
  ('manage_ads','Manage Ads','ads'), ('view_own_ads','View Own Ads','ads'),
  ('manage_ad_zones','Manage Ad Zones','ads'), ('manage_users','Manage Users','users'),
  ('manage_roles','Manage Roles','users'), ('manage_settings','Manage Settings','system'),
  ('view_analytics','View Analytics','system'), ('view_audit_log','View Audit Log','system')
on conflict (slug) do nothing;

insert into role_permissions (role_id, permission_id)
select r.id, p.id from roles r, permissions p where r.slug = 'super-admin'
on conflict do nothing;

insert into role_permissions (role_id, permission_id)
select r.id, p.id from roles r, permissions p where r.slug = 'admin' and p.slug != 'manage_roles'
on conflict do nothing;

insert into role_permissions (role_id, permission_id)
select r.id, p.id from roles r, permissions p
where r.slug = 'editor' and p.slug in ('create_post','edit_any_post','edit_own_post','delete_post','publish_post','create_exam','edit_any_exam','publish_exam','manage_categories','manage_menus','manage_pages','upload_media','view_analytics')
on conflict do nothing;

insert into role_permissions (role_id, permission_id)
select r.id, p.id from roles r, permissions p
where r.slug = 'writer' and p.slug in ('create_post','edit_own_post','upload_media')
on conflict do nothing;

insert into role_permissions (role_id, permission_id)
select r.id, p.id from roles r, permissions p
where r.slug = 'ad-manager' and p.slug in ('manage_ads','view_own_ads','manage_ad_zones','view_analytics')
on conflict do nothing;

insert into settings (key, value, "group", label, is_sensitive) values
  ('site_name','"IndianExamInfo"','general','Site Name',false),
  ('site_tagline','"Latest Exam Updates"','general','Site Tagline',false),
  ('site_url','"https://www.indianexaminfo.com"','general','Frontend URL',false),
  ('posts_per_page','20','general','Posts Per Page',false),
  ('primary_color','"#1A3C6E"','appearance','Primary Color',false),
  ('accent_color','"#D0342C"','appearance','Accent Color',false),
  ('editorial_color','"#E8630A"','appearance','Editorial Color',false),
  ('ai_enabled','true','ai','Enable AI Features',false),
  ('ai_auto_seo','true','ai','Auto-generate SEO',false),
  ('ai_auto_faq','true','ai','Auto-generate FAQs',false),
  ('ai_language','"en"','ai','Content Language',false),
  ('ai_tone','"informative"','ai','Writing Tone',false),
  ('gemini_model','"gemini-1.5-flash"','ai','Gemini Model',false),
  ('gemini_api_key','null','ai','Gemini API Key',true),
  ('adsense_enabled','false','ads','Enable AdSense Fallback',false),
  ('direct_ads_enabled','true','ads','Enable Direct Ad Manager',false),
  ('notify_on_publish','true','notifications','Notify on Publish',false),
  ('notify_on_result','true','notifications','Notify on Result',false),
  ('revalidate_on_publish','true','integrations','Auto-Revalidate on Publish',false),
  ('db_status','"connected"','database','DB Connection Status',false)
on conflict (key) do nothing;

insert into ad_zones (slug, name, size, position, page_placement, description) values
  ('header-banner','Header Banner','728x90','top','all','Leaderboard banner in site header'),
  ('sidebar-right','Sidebar Right','300x250','right','content','Right sidebar medium rectangle'),
  ('in-content-top','In-Content Top','728x90','in-content','content','Above article content'),
  ('in-content-bottom','In-Content Bottom','728x90','in-content','content','Below article content'),
  ('mobile-sticky-footer','Mobile Sticky Footer','320x50','bottom','mobile','Sticky bottom banner on mobile'),
  ('exam-page-top','Exam Page Top','970x250','top','exam','Billboard above exam details')
on conflict (slug) do nothing;

insert into categories (slug, name, short_name, pillar, order_index) values
  ('central-government-jobs','Central Government Jobs','Central Govt','sarkari-naukri',1),
  ('state-government-jobs','State Government Jobs','State Govt','sarkari-naukri',2),
  ('banking','Banking & Finance','Banking','sarkari-naukri',3),
  ('railways','Railways','Railways','sarkari-naukri',4),
  ('defence','Defence & Police','Defence','sarkari-naukri',5),
  ('teaching','Teaching & Education','Teaching','sarkari-naukri',6),
  ('engineering','Engineering Entrance','Engineering','entrance-exam',1),
  ('medical','Medical Entrance','Medical','entrance-exam',2),
  ('management','Management Entrance','Management','entrance-exam',3),
  ('law','Law Entrance','Law','entrance-exam',4),
  ('civil-services','Civil Services','UPSC/IAS','entrance-exam',5),
  ('cbse','CBSE Board','CBSE','board-university',1),
  ('state-boards','State Boards','State Board','board-university',2),
  ('university-exams','University Exams','University','board-university',3)
on conflict (slug) do nothing;

insert into pages (slug, title, is_system, status, order_index) values
  ('about','About Us',true,'draft',1),('contact','Contact Us',true,'draft',2),
  ('privacy','Privacy Policy',true,'draft',3),('terms','Terms of Use',true,'draft',4),
  ('disclaimer','Disclaimer',true,'draft',5)
on conflict (slug) do nothing;
;
