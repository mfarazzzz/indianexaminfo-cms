
-- T2-1: sarkari_naukri.created_at NOT NULL (verified 0 violations)
ALTER TABLE public.sarkari_naukri ALTER COLUMN created_at SET NOT NULL;

-- T2-2: sarkari_naukri.updated_at NOT NULL (verified 0 violations)
ALTER TABLE public.sarkari_naukri ALTER COLUMN updated_at SET NOT NULL;

-- T2-3: Enable RLS on _migration_log_sarkari + admin-only read policy
ALTER TABLE public._migration_log_sarkari ENABLE ROW LEVEL SECURITY;

CREATE POLICY "migration_log_sarkari_select_admin" ON public._migration_log_sarkari
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      JOIN roles r ON r.id = up.role_id
      WHERE up.id = auth.uid()
      AND r.slug IN ('super-admin', 'admin')
    )
  );

-- T2-5: CHECK constraint on entity.pillar matching pillar_type values (verified 0 violations)
ALTER TABLE public.entity ADD CONSTRAINT chk_entity_pillar
  CHECK (pillar IS NULL OR pillar IN ('sarkari-naukri', 'entrance-exam', 'board-university'));
;
