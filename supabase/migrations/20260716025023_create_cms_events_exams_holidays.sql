CREATE TABLE IF NOT EXISTS cms_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE, title TEXT NOT NULL, title_hindi TEXT,
  start_date TIMESTAMPTZ NOT NULL, end_date TIMESTAMPTZ,
  venue TEXT, venue_hindi TEXT,
  street TEXT, city TEXT, district TEXT, state TEXT, pincode TEXT,
  latitude DECIMAL(10,7), longitude DECIMAL(10,7),
  category TEXT, description TEXT, description_hindi TEXT,
  image_id UUID REFERENCES cms_media(id) ON DELETE SET NULL,
  gallery JSONB, ticket_price TEXT, registration_link TEXT,
  organizer TEXT, organizer_contact TEXT,
  is_featured BOOLEAN DEFAULT false, is_free BOOLEAN DEFAULT false,
  seo_title TEXT, seo_description TEXT,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft','pending_review','approved','published','archived')),
  published_at TIMESTAMPTZ, created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cms_exams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE, title TEXT NOT NULL, title_hindi TEXT,
  exam_date DATE NOT NULL, application_start_date DATE, application_end_date DATE,
  admit_card_date DATE, result_date DATE,
  organization TEXT NOT NULL, organization_hindi TEXT,
  category TEXT, subcategory TEXT,
  description TEXT, description_hindi TEXT, eligibility TEXT, eligibility_hindi TEXT,
  official_website TEXT, application_link TEXT,
  image_id UUID REFERENCES cms_media(id) ON DELETE SET NULL,
  exam_status TEXT, application_status TEXT, admit_card_status TEXT, result_status TEXT,
  is_popular BOOLEAN DEFAULT false, is_featured BOOLEAN DEFAULT false,
  is_new BOOLEAN DEFAULT false, is_live BOOLEAN DEFAULT false,
  total_posts INT, seo_title TEXT, seo_description TEXT,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft','pending_review','approved','published','archived')),
  published_at TIMESTAMPTZ, created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cms_holidays (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE, name TEXT NOT NULL, name_hindi TEXT NOT NULL,
  date DATE NOT NULL,
  type TEXT CHECK (type IN ('national','state','religious','optional','bank')),
  religion TEXT CHECK (religion IN ('hindu','muslim','christian','sikh','buddhist','jain','secular')),
  description TEXT, description_hindi TEXT,
  image_id UUID REFERENCES cms_media(id) ON DELETE SET NULL,
  is_gazetted BOOLEAN DEFAULT false, is_restricted BOOLEAN DEFAULT false,
  applicable_states JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);;
