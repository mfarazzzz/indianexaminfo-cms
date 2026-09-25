
-- T1-4: Create the missing entity_snapshot table
-- Referenced by snapshotService.ts, healthService.ts, entityService.ts
-- Columns inferred from code: entity_id (UUID FK), snapshot (JSONB)
CREATE TABLE IF NOT EXISTS public.entity_snapshot (
  entity_id UUID PRIMARY KEY REFERENCES public.entity(id) ON DELETE CASCADE,
  snapshot  JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS (consistent with entity system)
ALTER TABLE public.entity_snapshot ENABLE ROW LEVEL SECURITY;

-- Same access pattern as entity system
CREATE POLICY "entity_snapshot_select" ON public.entity_snapshot
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "entity_snapshot_write" ON public.entity_snapshot
  FOR ALL TO authenticated USING (can_write_entity());

-- Also create the missing lifecycle_template table
-- Referenced by templateService.ts
CREATE TABLE IF NOT EXISTS public.lifecycle_template (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pillar_id                 TEXT NOT NULL,
  name                      TEXT NOT NULL,
  slug                      TEXT NOT NULL UNIQUE,
  description               TEXT,
  default_modules           TEXT[] NOT NULL DEFAULT '{}',
  default_timeline_stages   JSONB NOT NULL DEFAULT '[]'::jsonb,
  default_validation_rules  JSONB NOT NULL DEFAULT '{}'::jsonb,
  default_schema_org_type   TEXT NOT NULL DEFAULT 'Article',
  lifecycle_rules           JSONB NOT NULL DEFAULT '[]'::jsonb,
  frontend_layout           TEXT NOT NULL DEFAULT 'default_layout',
  is_active                 BOOLEAN NOT NULL DEFAULT true,
  display_order             INTEGER NOT NULL DEFAULT 0,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at                TIMESTAMPTZ
);

ALTER TABLE public.lifecycle_template ENABLE ROW LEVEL SECURITY;

CREATE POLICY "lifecycle_template_select" ON public.lifecycle_template
  FOR SELECT TO authenticated USING (deleted_at IS NULL);

CREATE POLICY "lifecycle_template_write" ON public.lifecycle_template
  FOR ALL TO authenticated USING (can_write_entity());

-- Create lifecycle_template_version table
-- Referenced by templateService.ts and snapshotService.ts
CREATE TABLE IF NOT EXISTS public.lifecycle_template_version (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id     UUID NOT NULL REFERENCES public.lifecycle_template(id) ON DELETE CASCADE,
  version_number  INTEGER NOT NULL,
  configuration   JSONB NOT NULL DEFAULT '{}'::jsonb,
  change_summary  TEXT,
  is_active       BOOLEAN NOT NULL DEFAULT false,
  created_by      UUID REFERENCES auth.users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (template_id, version_number)
);

ALTER TABLE public.lifecycle_template_version ENABLE ROW LEVEL SECURITY;

CREATE POLICY "lifecycle_template_version_select" ON public.lifecycle_template_version
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "lifecycle_template_version_write" ON public.lifecycle_template_version
  FOR ALL TO authenticated USING (can_write_entity());

-- Index for common lookups
CREATE INDEX idx_template_version_active ON public.lifecycle_template_version(template_id, is_active)
  WHERE is_active = true;
;
