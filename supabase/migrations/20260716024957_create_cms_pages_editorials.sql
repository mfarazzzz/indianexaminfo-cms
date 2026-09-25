CREATE TABLE IF NOT EXISTS cms_pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  path TEXT,
  title_english TEXT NOT NULL,
  title_hindi TEXT,
  excerpt TEXT,
  excerpt_hindi TEXT,
  content TEXT,
  content_hindi TEXT,
  "order" INT DEFAULT 0,
  is_published BOOLEAN DEFAULT true,
  seo_title TEXT,
  seo_description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cms_editorials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  title_hindi TEXT,
  excerpt TEXT,
  excerpt_hindi TEXT,
  content TEXT,
  content_hindi TEXT,
  featured_image_id UUID REFERENCES cms_media(id) ON DELETE SET NULL,
  editorial_type TEXT DEFAULT 'editorial' CHECK (editorial_type IN ('editorial', 'opinion', 'review', 'interview', 'special-report')),
  author_id UUID REFERENCES cms_authors(id) ON DELETE SET NULL,
  category_id UUID REFERENCES cms_categories(id) ON DELETE SET NULL,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'pending_review', 'approved', 'published', 'archived')),
  seo_title TEXT,
  seo_description TEXT,
  canonical_url TEXT,
  read_time INT,
  views BIGINT DEFAULT 0,
  is_featured BOOLEAN DEFAULT false,
  is_editors_pick BOOLEAN DEFAULT false,
  hero_priority INT DEFAULT 0,
  scheduled_at TIMESTAMPTZ,
  published_at TIMESTAMPTZ,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cms_editorial_articles (
  editorial_id UUID NOT NULL REFERENCES cms_editorials(id) ON DELETE CASCADE,
  article_id UUID NOT NULL REFERENCES cms_articles(id) ON DELETE CASCADE,
  PRIMARY KEY (editorial_id, article_id)
);;
