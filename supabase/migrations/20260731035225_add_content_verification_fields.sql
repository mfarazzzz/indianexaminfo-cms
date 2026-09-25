
-- Add verification fields to exams (YMYL compliance)
ALTER TABLE public.exams ADD COLUMN IF NOT EXISTS is_verified boolean DEFAULT false;
ALTER TABLE public.exams ADD COLUMN IF NOT EXISTS verified_at timestamptz;
ALTER TABLE public.exams ADD COLUMN IF NOT EXISTS verified_by uuid REFERENCES auth.users(id);
ALTER TABLE public.exams ADD COLUMN IF NOT EXISTS content_source text DEFAULT 'manual'
  CHECK (content_source IN ('manual', 'ai-assisted', 'ai-generated', 'imported'));

-- Add verification fields to sarkari_naukri
ALTER TABLE public.sarkari_naukri ADD COLUMN IF NOT EXISTS is_verified boolean DEFAULT false;
ALTER TABLE public.sarkari_naukri ADD COLUMN IF NOT EXISTS verified_at timestamptz;
ALTER TABLE public.sarkari_naukri ADD COLUMN IF NOT EXISTS verified_by uuid REFERENCES auth.users(id);
ALTER TABLE public.sarkari_naukri ADD COLUMN IF NOT EXISTS content_source text DEFAULT 'manual'
  CHECK (content_source IN ('manual', 'ai-assisted', 'ai-generated', 'imported'));

-- Add verification to content_posts
ALTER TABLE public.content_posts ADD COLUMN IF NOT EXISTS is_verified boolean DEFAULT false;
ALTER TABLE public.content_posts ADD COLUMN IF NOT EXISTS verified_at timestamptz;
ALTER TABLE public.content_posts ADD COLUMN IF NOT EXISTS content_source text DEFAULT 'manual'
  CHECK (content_source IN ('manual', 'ai-assisted', 'ai-generated', 'imported'));
;
