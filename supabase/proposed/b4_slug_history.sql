-- ══════════════════════════════════════════════════════════════════════════════
-- PROPOSED — NOT APPLIED. Design doc §2 (B4).
-- Slug/category history so renaming a PUBLISHED record's slug (or a category slug)
-- never orphans its old URL. The frontend reads this to issue a ONE-HOP 301/308 to the
-- current canonical URL on a not-found slug. One hop only — never a redirect chain.
-- ══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS entity_slug_history (
  id           uuid primary key default gen_random_uuid(),
  entity_type  text NOT NULL,                    -- 'exam' | 'category' (reader-safe, no FK)
  entity_id    uuid,                             -- exam id or category id
  old_slug     text NOT NULL,
  new_slug     text NOT NULL,
  route_pillar text,                             -- url segment, to disambiguate same slug across pillars
  changed_at   timestamptz NOT NULL default now()
);
-- Fast "was this slug ever renamed?" lookup on the request path.
CREATE INDEX IF NOT EXISTS slug_history_old_idx ON entity_slug_history(old_slug, route_pillar);

-- Capture trigger (draft): on UPDATE of exams.slug / categories.slug, when the record is
-- published, remember the old→new pair. Kept here as intent; final SQL filled on approval.
-- CREATE OR REPLACE FUNCTION public.capture_slug_history() RETURNS trigger ... 
--   IF NEW.slug <> OLD.slug THEN INSERT INTO entity_slug_history(entity_type,entity_id,old_slug,new_slug) VALUES (...);
