CREATE TABLE IF NOT EXISTS cms_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  title_hindi TEXT NOT NULL,
  title_english TEXT NOT NULL,
  description TEXT,
  description_hindi TEXT,
  path TEXT,
  parent_id UUID REFERENCES cms_categories(id) ON DELETE SET NULL,
  "order" INT DEFAULT 0,
  seo_title TEXT,
  seo_description TEXT,
  seo_keywords TEXT[],
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_cms_categories_slug ON cms_categories(slug);
CREATE INDEX IF NOT EXISTS idx_cms_categories_parent_id ON cms_categories(parent_id);;
