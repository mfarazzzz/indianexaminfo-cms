
-- ELMS-008: Revision snapshots, activity log, reusable components

-- Full revision snapshots (created on every publish)
CREATE TABLE IF NOT EXISTS entity_revision (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id      uuid NOT NULL REFERENCES entity(id) ON DELETE CASCADE,
  version_number integer NOT NULL,
  snapshot       jsonb NOT NULL DEFAULT '{}',
  comment        text,
  created_by     uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_revision_version UNIQUE (entity_id, version_number)
);
CREATE INDEX IF NOT EXISTS idx_revision_entity ON entity_revision(entity_id, version_number DESC);

-- Granular activity log
CREATE TABLE IF NOT EXISTS entity_activity_log (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id   uuid REFERENCES entity(id) ON DELETE SET NULL,
  module_id   uuid REFERENCES entity_module(id) ON DELETE SET NULL,
  actor_id    uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action      text NOT NULL,
  target_type text,
  target_id   uuid,
  changes     jsonb,
  ip_address  inet,
  user_agent  text,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_activity_entity ON entity_activity_log(entity_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_actor  ON entity_activity_log(actor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_action ON entity_activity_log(action, created_at DESC);

-- Reusable components
CREATE TABLE IF NOT EXISTS reusable_component (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL UNIQUE,
  description text,
  block_type  text NOT NULL,
  content     jsonb NOT NULL DEFAULT '{}',
  tags        text[] DEFAULT '{}',
  created_by  uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  deleted_at  timestamptz
);

-- Junction: module_blocks that reference a reusable component
CREATE TABLE IF NOT EXISTS module_block_component_ref (
  module_block_id       uuid NOT NULL REFERENCES module_block(id) ON DELETE CASCADE,
  reusable_component_id uuid NOT NULL REFERENCES reusable_component(id) ON DELETE RESTRICT,
  PRIMARY KEY (module_block_id, reusable_component_id)
);

-- Broken links tracking
CREATE TABLE IF NOT EXISTS entity_broken_link (
  entity_id    uuid NOT NULL REFERENCES entity(id) ON DELETE CASCADE,
  url          text NOT NULL,
  source_type  text NOT NULL DEFAULT 'link',
  http_status  integer,
  detected_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (entity_id, url)
);
CREATE INDEX IF NOT EXISTS idx_broken_link_entity ON entity_broken_link(entity_id);
;
