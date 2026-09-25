
-- ═══════════════════════════════════════════════════════════════════
-- Navigation Mega Menu Redesign - Task 1: Database Schema
-- ═══════════════════════════════════════════════════════════════════

-- Add new pillar enum values
ALTER TYPE pillar_type ADD VALUE IF NOT EXISTS 'government-exam';
ALTER TYPE pillar_type ADD VALUE IF NOT EXISTS 'news';

-- Core taxonomy table (hierarchical navigation tree)
CREATE TABLE taxonomy_nodes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL CHECK (slug ~ '^[a-z0-9][a-z0-9-]*[a-z0-9]$' AND length(slug) BETWEEN 2 AND 128),
  label TEXT NOT NULL CHECK (length(label) BETWEEN 1 AND 256),
  pillar pillar_type NOT NULL,
  parent_id UUID REFERENCES taxonomy_nodes(id) ON DELETE CASCADE,
  path TEXT NOT NULL,
  depth INTEGER NOT NULL DEFAULT 0 CHECK (depth >= 0 AND depth <= 10),
  display_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_pinned BOOLEAN NOT NULL DEFAULT false,
  
  -- Display
  icon TEXT CHECK (icon IS NULL OR length(icon) <= 64),
  badge TEXT CHECK (badge IS NULL OR badge IN ('popular', 'new', 'updated', 'trending', 'urgent')),
  description TEXT CHECK (description IS NULL OR length(description) <= 500),
  item_count INTEGER NOT NULL DEFAULT 0,
  
  -- SEO
  seo_title TEXT CHECK (seo_title IS NULL OR length(seo_title) <= 70),
  seo_description TEXT CHECK (seo_description IS NULL OR length(seo_description) <= 160),
  og_image TEXT,
  
  -- References to existing data
  category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  exam_id UUID REFERENCES exams(id) ON DELETE SET NULL,
  
  -- Navigation config
  max_items INTEGER NOT NULL DEFAULT 15,
  show_item_count BOOLEAN NOT NULL DEFAULT true,
  featured_item_ids UUID[] DEFAULT '{}',
  custom_url TEXT,
  metadata JSONB DEFAULT '{}' CHECK (octet_length(metadata::text) <= 4096),
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Unique slug within same parent scope
  UNIQUE (pillar, slug, parent_id)
);

-- Indexes for fast queries
CREATE INDEX idx_taxonomy_pillar_active ON taxonomy_nodes(pillar, is_active) WHERE is_active = true;
CREATE INDEX idx_taxonomy_parent ON taxonomy_nodes(parent_id) WHERE parent_id IS NOT NULL;
CREATE INDEX idx_taxonomy_path ON taxonomy_nodes USING gin (path gin_trgm_ops);
CREATE INDEX idx_taxonomy_depth_order ON taxonomy_nodes(pillar, depth, display_order);
CREATE INDEX idx_taxonomy_category ON taxonomy_nodes(category_id) WHERE category_id IS NOT NULL;
CREATE INDEX idx_taxonomy_exam ON taxonomy_nodes(exam_id) WHERE exam_id IS NOT NULL;

-- Discovery facets (many-to-many cross-domain tagging)
CREATE TABLE taxonomy_facets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  node_id UUID NOT NULL REFERENCES taxonomy_nodes(id) ON DELETE CASCADE,
  facet TEXT NOT NULL CHECK (facet IN (
    'state', 'qualification', 'stream', 'degree', 'department',
    'organisation', 'university', 'board', 'course',
    'selection-process', 'admission-mode', 'exam-mode', 'frequency', 'status'
  )),
  value TEXT NOT NULL CHECK (length(value) BETWEEN 1 AND 256),
  slug TEXT NOT NULL CHECK (slug ~ '^[a-z0-9][a-z0-9-]*[a-z0-9]$'),
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  UNIQUE (node_id, facet, value)
);

CREATE INDEX idx_facets_facet_value ON taxonomy_facets(facet, slug);
CREATE INDEX idx_facets_node ON taxonomy_facets(node_id);

-- Navigation revisions for version control and rollback
CREATE TABLE navigation_revisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pillar pillar_type NOT NULL,
  snapshot JSONB NOT NULL,
  version INTEGER NOT NULL,
  published_by UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  published_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  comment TEXT,
  is_current BOOLEAN NOT NULL DEFAULT false,
  
  UNIQUE (pillar, version)
);

CREATE INDEX idx_nav_revisions_pillar ON navigation_revisions(pillar, version DESC);
CREATE INDEX idx_nav_revisions_current ON navigation_revisions(pillar) WHERE is_current = true;

-- URL redirects for moved/renamed taxonomy nodes
CREATE TABLE taxonomy_redirects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  old_path TEXT NOT NULL UNIQUE,
  new_path TEXT NOT NULL,
  node_id UUID REFERENCES taxonomy_nodes(id) ON DELETE SET NULL,
  redirect_type INTEGER NOT NULL DEFAULT 301 CHECK (redirect_type IN (301, 302)),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_redirects_old_path ON taxonomy_redirects(old_path);

-- Auto-update updated_at trigger
CREATE OR REPLACE FUNCTION update_taxonomy_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_taxonomy_updated_at
  BEFORE UPDATE ON taxonomy_nodes
  FOR EACH ROW
  EXECUTE FUNCTION update_taxonomy_updated_at();

-- RLS Policies
ALTER TABLE taxonomy_nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE taxonomy_facets ENABLE ROW LEVEL SECURITY;
ALTER TABLE navigation_revisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE taxonomy_redirects ENABLE ROW LEVEL SECURITY;

-- Read access for authenticated users
CREATE POLICY "taxonomy_nodes_read" ON taxonomy_nodes FOR SELECT TO authenticated USING (true);
CREATE POLICY "taxonomy_facets_read" ON taxonomy_facets FOR SELECT TO authenticated USING (true);
CREATE POLICY "navigation_revisions_read" ON navigation_revisions FOR SELECT TO authenticated USING (true);
CREATE POLICY "taxonomy_redirects_read" ON taxonomy_redirects FOR SELECT TO authenticated USING (true);

-- Write access for authenticated users (admin check in app layer)
CREATE POLICY "taxonomy_nodes_write" ON taxonomy_nodes FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "taxonomy_facets_write" ON taxonomy_facets FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "navigation_revisions_write" ON navigation_revisions FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "taxonomy_redirects_write" ON taxonomy_redirects FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Public read access for anonymous (frontend)
CREATE POLICY "taxonomy_nodes_anon_read" ON taxonomy_nodes FOR SELECT TO anon USING (is_active = true);
CREATE POLICY "taxonomy_facets_anon_read" ON taxonomy_facets FOR SELECT TO anon USING (true);
CREATE POLICY "taxonomy_redirects_anon_read" ON taxonomy_redirects FOR SELECT TO anon USING (true);
;
