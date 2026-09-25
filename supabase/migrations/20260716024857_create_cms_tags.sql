CREATE TABLE IF NOT EXISTS cms_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  name_hindi TEXT,
  slug TEXT NOT NULL UNIQUE,
  article_count INT DEFAULT 0,
  noindex BOOLEAN DEFAULT true,
  canonical_tag_id UUID REFERENCES cms_tags(id) ON DELETE SET NULL,
  tag_type TEXT DEFAULT 'primary' CHECK (tag_type IN ('primary', 'secondary', 'derived')),
  score INT DEFAULT 50,
  recent_article_count INT DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_cms_tags_slug ON cms_tags(slug);;
