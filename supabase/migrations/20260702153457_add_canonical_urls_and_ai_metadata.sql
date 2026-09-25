
-- Canonical URL on exams and content_posts (blog_posts already has it)
-- Backward compatible — nullable columns, existing code unaffected

alter table exams         add column if not exists canonical_url text;
alter table content_posts add column if not exists canonical_url text;
alter table pages         add column if not exists canonical_url text;

-- AI metadata — stores generation context per-row for traceability
-- Does not replace settings table; stores per-content AI provenance
-- {generated_at: iso, model: string, prompt_key: string, word_count: int}

alter table exams         add column if not exists ai_metadata jsonb default '{}'::jsonb;
alter table content_posts add column if not exists ai_metadata jsonb default '{}'::jsonb;
alter table blog_posts    add column if not exists ai_metadata jsonb default '{}'::jsonb;
;
