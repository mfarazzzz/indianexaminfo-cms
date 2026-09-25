CREATE TABLE IF NOT EXISTS cms_institutions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE, name TEXT NOT NULL, name_hindi TEXT,
  type TEXT, street TEXT, city TEXT, district TEXT, state TEXT, pincode TEXT,
  latitude DECIMAL(10,7), longitude DECIMAL(10,7),
  phone TEXT, email TEXT, website TEXT, established_year INT,
  affiliation TEXT, affiliation_hindi TEXT,
  courses JSONB, courses_hindi JSONB, fees TEXT,
  admission_process TEXT, admission_process_hindi TEXT,
  exams_accepted JSONB, facilities JSONB, facilities_hindi JSONB,
  image_id UUID REFERENCES cms_media(id) ON DELETE SET NULL, gallery JSONB,
  rating DECIMAL(2,1) CHECK (rating >= 0 AND rating <= 5), review_count INT DEFAULT 0,
  description TEXT NOT NULL, description_hindi TEXT, about TEXT, about_hindi TEXT,
  is_verified BOOLEAN DEFAULT false, is_featured BOOLEAN DEFAULT false,
  contact_person TEXT, contact_person_hindi TEXT,
  seo_title TEXT, seo_description TEXT,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft','pending_review','approved','published','archived')),
  published_at TIMESTAMPTZ, created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cms_places (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE, name TEXT NOT NULL, name_hindi TEXT,
  type TEXT, street TEXT, city TEXT, district TEXT, state TEXT, pincode TEXT,
  latitude DECIMAL(10,7), longitude DECIMAL(10,7),
  description TEXT, description_hindi TEXT, history TEXT, history_hindi TEXT,
  image_id UUID REFERENCES cms_media(id) ON DELETE SET NULL, gallery JSONB,
  timings TEXT, entry_fee TEXT,
  rating DECIMAL(2,1) CHECK (rating >= 0 AND rating <= 5), review_count INT DEFAULT 0,
  nearby_attractions JSONB, is_featured BOOLEAN DEFAULT false,
  seo_title TEXT, seo_description TEXT,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft','pending_review','approved','published','archived')),
  published_at TIMESTAMPTZ, created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cms_restaurants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE, name TEXT NOT NULL, name_hindi TEXT,
  street TEXT, city TEXT, district TEXT, state TEXT, pincode TEXT,
  latitude DECIMAL(10,7), longitude DECIMAL(10,7),
  phone TEXT, email TEXT, website TEXT,
  cuisine JSONB, price_range TEXT CHECK (price_range IN ('budget','moderate','premium','luxury')),
  rating DECIMAL(2,1) CHECK (rating >= 0 AND rating <= 5), review_count INT DEFAULT 0,
  description TEXT, description_hindi TEXT,
  image_id UUID REFERENCES cms_media(id) ON DELETE SET NULL, gallery JSONB,
  opening_hours JSONB, features JSONB,
  is_verified BOOLEAN DEFAULT false, is_featured BOOLEAN DEFAULT false,
  seo_title TEXT, seo_description TEXT,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft','pending_review','approved','published','archived')),
  published_at TIMESTAMPTZ, created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);;
