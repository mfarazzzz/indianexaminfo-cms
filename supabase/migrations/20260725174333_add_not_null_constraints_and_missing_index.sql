-- T2.9: Add NOT NULL where a default implies required.
-- Pre-verified: 0 NULL values in all these columns.

ALTER TABLE sarkari_naukri
  ALTER COLUMN workflow_status SET NOT NULL,
  ALTER COLUMN status SET NOT NULL,
  ALTER COLUMN is_featured SET NOT NULL,
  ALTER COLUMN is_new SET NOT NULL,
  ALTER COLUMN is_urgent SET NOT NULL,
  ALTER COLUMN tags SET NOT NULL,
  ALTER COLUMN search_keywords SET NOT NULL;

ALTER TABLE cms_education_news
  ALTER COLUMN status SET NOT NULL,
  ALTER COLUMN is_breaking SET NOT NULL,
  ALTER COLUMN is_featured SET NOT NULL,
  ALTER COLUMN is_important SET NOT NULL;

ALTER TABLE menu_items
  ALTER COLUMN item_type SET NOT NULL,
  ALTER COLUMN column_index SET NOT NULL;

-- T2.10: Add composite index matching the frontend access pattern for menus.
CREATE INDEX IF NOT EXISTS idx_menu_items_active_order
  ON menu_items (menu_id, is_active, column_index, order_index)
  WHERE is_active = true;

-- Drop redundant btree that duplicates the UNIQUE constraint on entity_revision.
DROP INDEX IF EXISTS idx_revision_entity;;
