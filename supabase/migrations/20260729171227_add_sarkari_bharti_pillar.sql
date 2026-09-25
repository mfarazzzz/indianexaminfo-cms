
-- Add sarkari-bharti to the pillar_type enum
ALTER TYPE pillar_type ADD VALUE IF NOT EXISTS 'sarkari-bharti';

-- Add categories for Sarkari Bharti
INSERT INTO categories (slug, name, pillar, order_index, is_active) VALUES
  ('police-recruitment', 'Police Recruitment', 'sarkari-bharti', 1, true),
  ('teaching-recruitment', 'Teaching Recruitment', 'sarkari-bharti', 2, true),
  ('health-recruitment', 'Health & Medical', 'sarkari-bharti', 3, true),
  ('revenue-recruitment', 'Revenue Department', 'sarkari-bharti', 4, true),
  ('forest-recruitment', 'Forest Department', 'sarkari-bharti', 5, true),
  ('municipal-recruitment', 'Municipal & Urban', 'sarkari-bharti', 6, true),
  ('judiciary-recruitment', 'Judiciary', 'sarkari-bharti', 7, true),
  ('anganwadi-recruitment', 'Anganwadi', 'sarkari-bharti', 8, true)
ON CONFLICT (slug) DO NOTHING;

-- Seed navigation_config for new categories
INSERT INTO navigation_config (category_id, display_order)
SELECT id, order_index FROM categories WHERE pillar = 'sarkari-bharti' AND is_active = true
ON CONFLICT (category_id) DO NOTHING;
;
