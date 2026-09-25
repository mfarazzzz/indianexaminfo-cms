CREATE TABLE IF NOT EXISTS cms_articles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  short_headline TEXT,
  excerpt TEXT,
  content TEXT,
  featured_image_id UUID REFERENCES cms_media(id) ON DELETE SET NULL,
  category_id UUID REFERENCES cms_categories(id) ON DELETE SET NULL,
  author_id UUID REFERENCES cms_authors(id) ON DELETE SET NULL,
  news_category TEXT,
  location TEXT,
  focus_keyword TEXT,
  content_type TEXT DEFAULT 'article',
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'pending_review', 'approved', 'published', 'archived')),
  workflow_note TEXT,
  seo_title TEXT,
  seo_description TEXT,
  seo_keywords TEXT[],
  og_title TEXT,
  og_description TEXT,
  canonical_url TEXT,
  schema_json JSONB,
  is_breaking BOOLEAN DEFAULT false,
  is_featured BOOLEAN DEFAULT false,
  is_editors_pick BOOLEAN DEFAULT false,
  discover_eligible BOOLEAN DEFAULT true,
  hero_priority INT DEFAULT 0,
  video_url TEXT,
  video_type TEXT,
  video_duration INT,
  read_time INT,
  views BIGINT DEFAULT 0,
  shares INT DEFAULT 0,
  published_at TIMESTAMPTZ,
  scheduled_at TIMESTAMPTZ,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_cms_articles_slug ON cms_articles(slug);
CREATE INDEX IF NOT EXISTS idx_cms_articles_status ON cms_articles(status);
CREATE INDEX IF NOT EXISTS idx_cms_articles_published_at ON cms_articles(published_at DESC);

CREATE TABLE IF NOT EXISTS cms_article_tags (
  article_id UUID NOT NULL REFERENCES cms_articles(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES cms_tags(id) ON DELETE CASCADE,
  PRIMARY KEY (article_id, tag_id)
);

CREATE TABLE IF NOT EXISTS cms_article_categories (
  article_id UUID NOT NULL REFERENCES cms_articles(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES cms_categories(id) ON DELETE CASCADE,
  PRIMARY KEY (article_id, category_id)
);;
