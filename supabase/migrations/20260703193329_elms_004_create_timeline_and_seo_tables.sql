
-- ELMS-004: entity_timeline_event — replaces important_dates JSON array
CREATE TABLE IF NOT EXISTS entity_timeline_event (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id      uuid NOT NULL REFERENCES entity(id) ON DELETE CASCADE,
  title          text NOT NULL,
  event_type     text NOT NULL DEFAULT 'other',
  event_date     date NOT NULL,
  event_time     time,
  description    text,
  status         text NOT NULL DEFAULT 'upcoming',
  badge_color    text NOT NULL DEFAULT 'blue',
  is_highlighted boolean NOT NULL DEFAULT false,
  is_featured    boolean NOT NULL DEFAULT false,
  official_link  text,
  pdf_link       text,
  image_url      text,
  visibility     text NOT NULL DEFAULT 'public',
  display_order  integer NOT NULL DEFAULT 0,
  publish_at     timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  created_by     uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  deleted_at     timestamptz
);

CREATE INDEX IF NOT EXISTS idx_timeline_entity ON entity_timeline_event(entity_id, event_date) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_timeline_status ON entity_timeline_event(entity_id, status)     WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_timeline_order  ON entity_timeline_event(entity_id, display_order) WHERE deleted_at IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_entity_timeline_event_updated_at') THEN
    CREATE TRIGGER set_entity_timeline_event_updated_at
      BEFORE UPDATE ON entity_timeline_event
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
END $$;

-- ELMS-005: entity_seo — one row per entity
CREATE TABLE IF NOT EXISTS entity_seo (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id            uuid NOT NULL UNIQUE REFERENCES entity(id) ON DELETE CASCADE,
  seo_title            text,
  meta_description     text,
  focus_keywords       text[] DEFAULT '{}',
  canonical_url        text,
  robots               text DEFAULT 'index',
  og_title             text,
  og_description       text,
  og_image             text,
  twitter_card         text DEFAULT 'summary_large_image',
  twitter_title        text,
  twitter_description  text,
  twitter_image        text,
  faq_schema           jsonb,
  breadcrumb_schema    jsonb,
  custom_json_ld       text,
  seo_score            integer,
  updated_at           timestamptz NOT NULL DEFAULT now(),
  updated_by           uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_entity_seo_entity ON entity_seo(entity_id);
;
