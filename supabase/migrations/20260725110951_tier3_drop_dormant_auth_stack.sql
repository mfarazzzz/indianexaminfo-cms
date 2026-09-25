
-- T3-9: Drop dormant cms auth stack
-- View first (depends on cms_users and cms_permissions), then tables
-- Backup note: these tables have been verified at all layers (RLS, functions, triggers, auth hooks, app code) with zero references.

-- Drop the view (the one structural dependent)
DROP VIEW IF EXISTS public.v_cms_user_permissions;

-- Drop tables in FK-dependency order
-- cms_ai_permissions references cms_users
-- cms_ai_config references cms_users  
-- cms_ai_usage references cms_users (user_id column)
DROP TABLE IF EXISTS public.cms_ai_permissions;
DROP TABLE IF EXISTS public.cms_ai_config;
DROP TABLE IF EXISTS public.cms_ai_usage;

-- cms_users references cms_authors (author_id FK) — drop cms_users, not cms_authors
DROP TABLE IF EXISTS public.cms_users CASCADE;

-- cms_roles has no inbound FKs (cms_users.cms_role is a text check, not FK)
DROP TABLE IF EXISTS public.cms_roles;

-- cms_permissions has no inbound FKs
DROP TABLE IF EXISTS public.cms_permissions;
;
