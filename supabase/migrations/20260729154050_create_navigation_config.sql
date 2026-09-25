
-- =============================================================================
-- NAVIGATION CONFIG — thin overlay on categories for mega menu display control
-- =============================================================================

CREATE TABLE IF NOT EXISTS navigation_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID NOT NULL REFERENCES categories(id) ON DELETE CASCADE UNIQUE,
  display_order INTEGER NOT NULL DEFAULT 0,
  is_visible BOOLEAN NOT NULL DEFAULT true,
  badge TEXT CHECK (badge IN ('popular', 'new', 'updated')),
  custom_label TEXT,
  custom_icon TEXT,
  featured_exam_ids UUID[] DEFAULT '{}',
  max_items INTEGER NOT NULL DEFAULT 15,
  show_exam_count BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_nav_config_category ON navigation_config(category_id);

-- RLS
ALTER TABLE navigation_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public_read_nav_config" ON navigation_config FOR SELECT USING (true);
CREATE POLICY "staff_write_nav_config" ON navigation_config FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "staff_update_nav_config" ON navigation_config FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY "admin_delete_nav_config" ON navigation_config FOR DELETE USING (current_user_role() IN ('super-admin', 'admin'));

-- Auto-update updated_at
CREATE TRIGGER set_updated_at BEFORE UPDATE ON navigation_config
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Performance index for exam navigation queries
CREATE INDEX IF NOT EXISTS idx_exams_nav_query
  ON exams(category_id, is_published, is_featured, name)
  WHERE is_published = true;

-- =============================================================================
-- SEED: Create default navigation_config rows for all active top-level categories
-- =============================================================================

INSERT INTO navigation_config (category_id, display_order)
SELECT id, order_index
FROM categories
WHERE is_active = true AND parent_id IS NULL
ON CONFLICT (category_id) DO NOTHING;
;
