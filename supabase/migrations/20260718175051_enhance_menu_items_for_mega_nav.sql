
-- ============================================================================
-- PHASE 1: Enhance menu_items table for mega menu architecture
-- Adds columns for item types, descriptions, images, and metadata
-- ============================================================================

ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS item_type text DEFAULT 'link';
-- item_type: 'link' | 'heading' | 'divider' | 'featured' | 'dynamic'

ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS image_url text;
ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS css_class text;
ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS column_index int DEFAULT 0;
ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}';
-- metadata examples:
--   { "dynamic_source": "recent_jobs", "count": 5 }
--   { "featured": true, "highlight_color": "blue" }
--   { "qualification": "10th-pass" }
;
