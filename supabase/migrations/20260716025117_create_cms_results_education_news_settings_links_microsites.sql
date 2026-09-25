CREATE TABLE IF NOT EXISTS cms_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE, title TEXT NOT NULL, title_hindi TEXT,
  result_date DATE NOT NULL, expected_date DATE,
  organization TEXT NOT NULL, organization_hindi TEXT,
  category TEXT, description TEXT, description_hindi TEXT,
  result_link TEXT, alternate_links JSONB,
  image_id UUID REFERENCES cms_media(id) ON DELETE SET NULL,
  total_candidates INT, pass_percentage DECIMAL(5,2), cutoff_marks TEXT,
  result_status TEXT, is_new BOOLEAN DEFAULT false, is_featured BOOLEAN DEFAULT false,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft','pending_review','approved','published','archived')),
  published_at TIMESTAMPTZ, created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cms_education_news (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE, title TEXT NOT NULL, title_hindi TEXT,
  category TEXT NOT NULL, excerpt TEXT, excerpt_hindi TEXT,
  content TEXT, content_hindi TEXT,
  image_id UUID REFERENCES cms_media(id) ON DELETE SET NULL,
  source TEXT, source_link TEXT, author TEXT,
  is_breaking BOOLEAN DEFAULT false, is_important BOOLEAN DEFAULT false, is_featured BOOLEAN DEFAULT false,
  related_exams JSONB, related_results JSONB, tags JSONB,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft','pending_review','approved','published','archived')),
  published_at TIMESTAMPTZ, created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cms_site_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_name TEXT, site_name_hindi TEXT, tagline TEXT, tagline_hindi TEXT,
  logo_url TEXT, favicon_url TEXT, social_links JSONB DEFAULT '{}',
  contact_email TEXT, contact_phone TEXT, address JSONB DEFAULT '{}',
  default_author_role TEXT DEFAULT 'author',
  google_analytics_id TEXT, google_adsense_id TEXT,
  footer_text TEXT, footer_text_hindi TEXT,
  gsc_property_url TEXT, gsc_export_url TEXT, backlink_report_url TEXT,
  referring_domains JSONB, backlink_notes TEXT, last_backlink_sync TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cms_internal_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  keyword TEXT NOT NULL UNIQUE, url TEXT NOT NULL,
  enabled BOOLEAN DEFAULT true, priority INT DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cms_microsite_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL, slug TEXT UNIQUE,
  title TEXT, title_hindi TEXT, name TEXT, name_hindi TEXT,
  category TEXT, subcategory TEXT, status TEXT,
  city TEXT, district TEXT, date TIMESTAMPTZ, end_date TIMESTAMPTZ,
  featured BOOLEAN DEFAULT false, popular BOOLEAN DEFAULT false,
  image TEXT, "order" INT, payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);;
