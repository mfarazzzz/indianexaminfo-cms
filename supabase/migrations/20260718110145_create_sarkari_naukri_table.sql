
-- ============================================================================
-- SARKARI NAUKRI TABLE — Unified government jobs content model
-- recruitment_type: 'exam' (competitive exam-based) or 'direct' (merit/walk-in)
-- ============================================================================

CREATE TABLE IF NOT EXISTS sarkari_naukri (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  recruitment_type text NOT NULL CHECK (recruitment_type IN ('exam', 'direct')),
  
  -- Shared fields
  title text NOT NULL,
  title_hindi text,
  organization text NOT NULL,
  organization_hindi text,
  department text,
  state text,
  district text,
  category text,
  vacancy_count int,
  eligibility text,
  age_limit text,
  pay_scale text,
  application_fee jsonb,
  description text,
  description_hindi text,
  
  -- Application window (shared)
  notification_date date,
  application_start_date date,
  application_end_date date,
  application_url text,
  official_notification_url text,
  
  -- Exam-specific (NULL for direct)
  exam_date date,
  admit_card_date date,
  admit_card_url text,
  answer_key_date date,
  answer_key_url text,
  exam_mode text,
  
  -- Result/outcome (shared, different semantics per type)
  result_date date,
  result_url text,
  cutoff_marks text,
  total_candidates int,
  pass_percentage numeric(5,2),
  
  -- Direct-specific (NULL for exam)
  interview_date date,
  document_verification_date date,
  merit_list_date date,
  merit_list_url text,
  joining_details text,
  walk_in_date date,
  walk_in_venue text,
  
  -- Status & display
  status text DEFAULT 'upcoming' CHECK (status IN (
    'upcoming', 'application-open', 'application-closed', 
    'admit-card-released', 'exam-scheduled', 'answer-key-released',
    'result-declared', 'interview-scheduled', 'merit-list-released',
    'completed', 'cancelled'
  )),
  is_new boolean DEFAULT false,
  is_featured boolean DEFAULT false,
  is_urgent boolean DEFAULT false,
  
  -- SEO & discovery
  tags text[] DEFAULT '{}',
  search_keywords text[] DEFAULT '{}',
  seo_title text,
  seo_description text,
  
  -- Media & links
  image_id uuid,
  alternate_links jsonb,
  
  -- Workflow
  workflow_status text DEFAULT 'draft' CHECK (workflow_status IN ('draft', 'review', 'published', 'archived')),
  published_at timestamptz,
  
  -- Provenance & audit (for migration tracking)
  source_table text,
  source_id uuid,
  created_by uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Indexes for filtering/browsing
CREATE INDEX IF NOT EXISTS idx_sarkari_naukri_type ON sarkari_naukri(recruitment_type);
CREATE INDEX IF NOT EXISTS idx_sarkari_naukri_status ON sarkari_naukri(status);
CREATE INDEX IF NOT EXISTS idx_sarkari_naukri_state ON sarkari_naukri(state);
CREATE INDEX IF NOT EXISTS idx_sarkari_naukri_category ON sarkari_naukri(category);
CREATE INDEX IF NOT EXISTS idx_sarkari_naukri_department ON sarkari_naukri(department);
CREATE INDEX IF NOT EXISTS idx_sarkari_naukri_workflow ON sarkari_naukri(workflow_status);
CREATE INDEX IF NOT EXISTS idx_sarkari_naukri_updated ON sarkari_naukri(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_sarkari_naukri_featured ON sarkari_naukri(is_featured) WHERE is_featured = true;

-- RLS policies
ALTER TABLE sarkari_naukri ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_read_published" ON sarkari_naukri FOR SELECT TO anon USING (workflow_status = 'published');
CREATE POLICY "authenticated_select" ON sarkari_naukri FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated_insert" ON sarkari_naukri FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "authenticated_update" ON sarkari_naukri FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_delete" ON sarkari_naukri FOR DELETE TO authenticated USING (true);
CREATE POLICY "service_all" ON sarkari_naukri FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Updated_at trigger
CREATE TRIGGER set_sarkari_naukri_updated_at 
  BEFORE UPDATE ON sarkari_naukri
  FOR EACH ROW EXECUTE FUNCTION moddatetime(updated_at);

-- ============================================================================
-- MIGRATION LOG TABLE — tracks every migrated entry for reversibility
-- ============================================================================

CREATE TABLE IF NOT EXISTS _migration_log_sarkari (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_table text NOT NULL,
  source_id uuid NOT NULL,
  target_id uuid NOT NULL,
  recruitment_type text NOT NULL,
  classification_reason text,
  original_slug text NOT NULL,
  new_slug text NOT NULL,
  state_extracted text,
  migrated_at timestamptz DEFAULT now()
);
;
