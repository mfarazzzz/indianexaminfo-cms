
-- ============================================================
-- CRITICAL FIX S1: Encrypt AI API keys
-- ============================================================
-- Enable pgcrypto for encryption
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Add encrypted column
ALTER TABLE public.ai_providers ADD COLUMN IF NOT EXISTS api_key_encrypted bytea;

-- Encrypt existing keys (using a server-side passphrase from settings)
-- Note: In production, use Supabase Vault or an env-based secret
UPDATE public.ai_providers 
SET api_key_encrypted = pgp_sym_encrypt(api_key, current_setting('app.settings.jwt_secret', true))
WHERE api_key IS NOT NULL AND api_key != '';

-- ============================================================
-- CRITICAL FIX S2: Restrict DELETE on sarkari_naukri to admin roles only
-- ============================================================
-- Drop the overly permissive delete policy
DROP POLICY IF EXISTS "authenticated_delete" ON public.sarkari_naukri;
DROP POLICY IF EXISTS "Allow authenticated delete" ON public.sarkari_naukri;
DROP POLICY IF EXISTS "Enable delete for authenticated users" ON public.sarkari_naukri;

-- Create restrictive delete policy (only super-admin and admin roles)
CREATE POLICY "admin_only_delete" ON public.sarkari_naukri
  FOR DELETE TO authenticated
  USING (
    auth.uid() IN (
      SELECT up.id FROM public.user_profiles up
      JOIN public.roles r ON up.role_id = r.id
      WHERE r.slug IN ('super-admin', 'admin')
    )
  );

-- Also fix cms_education_news DELETE policy
DROP POLICY IF EXISTS "authenticated_delete" ON public.cms_education_news;
DROP POLICY IF EXISTS "Allow authenticated delete" ON public.cms_education_news;
DROP POLICY IF EXISTS "Enable delete for authenticated users" ON public.cms_education_news;

CREATE POLICY "admin_only_delete" ON public.cms_education_news
  FOR DELETE TO authenticated
  USING (
    auth.uid() IN (
      SELECT up.id FROM public.user_profiles up
      JOIN public.roles r ON up.role_id = r.id
      WHERE r.slug IN ('super-admin', 'admin')
    )
  );

-- ============================================================
-- PERFORMANCE: Add missing indexes
-- ============================================================
-- sarkari_naukri composite index for common query pattern
CREATE INDEX IF NOT EXISTS idx_sarkari_naukri_published_featured 
  ON public.sarkari_naukri (workflow_status, is_featured DESC, updated_at DESC);

-- sarkari_naukri state filter
CREATE INDEX IF NOT EXISTS idx_sarkari_naukri_state 
  ON public.sarkari_naukri (workflow_status, state) WHERE state IS NOT NULL;

-- sarkari_naukri recruitment type
CREATE INDEX IF NOT EXISTS idx_sarkari_naukri_type 
  ON public.sarkari_naukri (workflow_status, recruitment_type);

-- content_posts common join pattern
CREATE INDEX IF NOT EXISTS idx_content_posts_exam_type 
  ON public.content_posts (exam_id, content_type) WHERE status = 'published';

-- menu_items fast lookup
CREATE INDEX IF NOT EXISTS idx_menu_items_menu_active 
  ON public.menu_items (menu_id, is_active, column_index, order_index);

-- exam_editions current lookup
CREATE INDEX IF NOT EXISTS idx_exam_editions_current 
  ON public.exam_editions (exam_id, is_current) WHERE is_current = true;

-- exams composite for pillar listing
CREATE INDEX IF NOT EXISTS idx_exams_pillar_featured 
  ON public.exams (pillar, is_featured DESC, updated_at DESC);

-- ============================================================
-- PUBLISH VALIDATION: Prevent publishing with missing required fields
-- ============================================================
-- sarkari_naukri: cannot set workflow_status='published' without slug and title
ALTER TABLE public.sarkari_naukri DROP CONSTRAINT IF EXISTS chk_publish_requires_fields;
ALTER TABLE public.sarkari_naukri ADD CONSTRAINT chk_publish_requires_fields
  CHECK (
    workflow_status != 'published' OR (
      slug IS NOT NULL AND slug != '' AND
      title IS NOT NULL AND title != '' AND
      organization IS NOT NULL AND organization != ''
    )
  );
;
