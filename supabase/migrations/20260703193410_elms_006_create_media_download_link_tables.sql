
-- ELMS-007: media_library, entity_media, entity_download, entity_link

-- Global media library (reusable across all entities)
CREATE TABLE IF NOT EXISTS media_library (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  filename     text NOT NULL,
  storage_path text NOT NULL UNIQUE,
  public_url   text NOT NULL,
  mime_type    text NOT NULL,
  size_bytes   bigint NOT NULL DEFAULT 0,
  width        integer,
  height       integer,
  alt_text     text,
  caption      text,
  folder       text NOT NULL DEFAULT '/',
  tags         text[] DEFAULT '{}',
  variants     jsonb DEFAULT '{}',
  usage_count  integer NOT NULL DEFAULT 0,
  uploaded_by  uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  deleted_at   timestamptz
);

CREATE INDEX IF NOT EXISTS idx_media_folder  ON media_library(folder) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_media_mime    ON media_library(mime_type) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_media_fts     ON media_library
  USING gin(to_tsvector('english', filename || ' ' || coalesce(alt_text, '')));

-- Entity media slot assignments
CREATE TABLE IF NOT EXISTS entity_media (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id     uuid NOT NULL REFERENCES entity(id) ON DELETE CASCADE,
  media_id      uuid NOT NULL REFERENCES media_library(id) ON DELETE RESTRICT,
  slot          text NOT NULL DEFAULT 'gallery',
  display_order integer NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now(),
  deleted_at    timestamptz
);
CREATE INDEX IF NOT EXISTS idx_entity_media_slot ON entity_media(entity_id, slot) WHERE deleted_at IS NULL;

-- Downloads
CREATE TABLE IF NOT EXISTS entity_download (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id         uuid NOT NULL REFERENCES entity(id) ON DELETE CASCADE,
  download_name     text NOT NULL,
  category          text,
  media_id          uuid REFERENCES media_library(id) ON DELETE SET NULL,
  external_url      text,
  file_type         text,
  version           text,
  description       text,
  language          text DEFAULT 'en',
  is_visible        boolean NOT NULL DEFAULT true,
  button_text       text DEFAULT 'Download',
  display_order     integer NOT NULL DEFAULT 0,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  deleted_at        timestamptz
);
CREATE INDEX IF NOT EXISTS idx_download_entity ON entity_download(entity_id) WHERE deleted_at IS NULL;

-- Official links
CREATE TABLE IF NOT EXISTS entity_link (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id     uuid NOT NULL REFERENCES entity(id) ON DELETE CASCADE,
  label         text NOT NULL,
  url           text NOT NULL,
  icon          text,
  button_style  text DEFAULT 'primary',
  status        text NOT NULL DEFAULT 'active',
  display_order integer NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now(),
  deleted_at    timestamptz
);
CREATE INDEX IF NOT EXISTS idx_link_entity ON entity_link(entity_id) WHERE deleted_at IS NULL;
;
