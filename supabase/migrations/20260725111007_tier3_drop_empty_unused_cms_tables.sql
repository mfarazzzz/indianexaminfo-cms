
-- T3-2: Drop cms_exams (0 rows, 0 code references, 0 frontend references)
DROP TABLE IF EXISTS public.cms_exams;

-- T3-3: Drop cms_content_versions (0 rows, 0 code references)
DROP TABLE IF EXISTS public.cms_content_versions;

-- T3-4: Drop cms_audit_log (0 rows, 0 code references)
DROP TABLE IF EXISTS public.cms_audit_log;

-- T3-5: Drop cms_webhook_log (0 rows, 0 code references)
DROP TABLE IF EXISTS public.cms_webhook_log;

-- T3-11 (partial): Drop confirmed-unused empty cms_* tables
DROP TABLE IF EXISTS public.cms_pages;

-- cms_categories has inbound FK from cms_articles, cms_editorials
-- cms_articles has 0 rows and references cms_categories
-- Drop in dependency order
DROP TABLE IF EXISTS public.cms_editorial_articles;
DROP TABLE IF EXISTS public.cms_article_categories;
DROP TABLE IF EXISTS public.cms_article_tags;
DROP TABLE IF EXISTS public.cms_editorials;
DROP TABLE IF EXISTS public.cms_articles;
DROP TABLE IF EXISTS public.cms_categories;
;
