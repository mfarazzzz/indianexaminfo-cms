CREATE TABLE IF NOT EXISTS cms_media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  filename TEXT NOT NULL,
  original_filename TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size_bytes BIGINT NOT NULL,
  width INT,
  height INT,
  alt_text TEXT,
  caption TEXT,
  storage_path TEXT NOT NULL,
  url TEXT NOT NULL,
  uploaded_by UUID,
  variant_status TEXT DEFAULT 'pending' CHECK (variant_status IN ('pending', 'completed', 'failed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cms_media_variants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  media_id UUID NOT NULL REFERENCES cms_media(id) ON DELETE CASCADE,
  variant_type TEXT NOT NULL CHECK (variant_type IN ('thumbnail', 'medium', 'large')),
  width INT NOT NULL,
  height INT NOT NULL,
  size_bytes BIGINT NOT NULL,
  storage_path TEXT NOT NULL,
  url TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(media_id, variant_type)
);;
