-- J2d: verification-trigger proof. NOT a migration — a self-contained test.
-- It creates the trigger from 20260927140000 in-transaction, exercises every
-- branch on scratch DRAFT rows, prints a result table, then ROLLED BACK so the
-- live database is untouched (net: nothing applied).
--
-- Run whole-file in ONE session (psql / supabase). auth.uid() is simulated by
-- setting the JWT claim GUC to a real user id: an editor (holds publish_post)
-- and a non-editor (does not). current_user_has_permission is SECURITY DEFINER
-- and reads auth.uid(), so the trigger's permission outcome follows the CLAIM,
-- not the session role — exactly what we want to prove.

BEGIN;

-- ── 1. Install the trigger under test (verbatim from the migration) ──────────
CREATE OR REPLACE FUNCTION public.trg_sarkari_verify()
RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.verified_at IS NOT NULL THEN
      NEW.verified_at := now();
      IF NEW.official_notification_url IS NULL
         OR NEW.official_notification_url !~* '^https?://' THEN
        RAISE EXCEPTION 'Cannot verify: official_notification_url must be an http(s) URL';
      END IF;
      IF NEW.application_end_date IS NULL THEN
        RAISE EXCEPTION 'Cannot verify: application_end_date must be set';
      END IF;
      IF NOT current_user_has_permission('publish_post') THEN
        RAISE EXCEPTION 'permission denied: verifying requires the publish_post permission'
          USING ERRCODE = '42501';
      END IF;
    END IF;
    RETURN NEW;
  END IF;

  IF OLD.verified_at IS NULL AND NEW.verified_at IS NOT NULL THEN
    NEW.verified_at := now();
    IF NEW.official_notification_url IS NULL
       OR NEW.official_notification_url !~* '^https?://' THEN
      RAISE EXCEPTION 'Cannot verify: official_notification_url must be an http(s) URL';
    END IF;
    IF NEW.application_end_date IS NULL THEN
      RAISE EXCEPTION 'Cannot verify: application_end_date must be set';
    END IF;
    IF NOT current_user_has_permission('publish_post') THEN
      RAISE EXCEPTION 'permission denied: verifying requires the publish_post permission'
        USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
  END IF;

  IF OLD.verified_at IS NOT NULL AND NEW.verified_at IS NULL THEN
    RETURN NEW;
  END IF;

  IF OLD.verified_at IS NOT NULL AND NEW.verified_at IS NOT NULL THEN
    IF (OLD.notification_date          IS DISTINCT FROM NEW.notification_date
        OR OLD.application_start_date  IS DISTINCT FROM NEW.application_start_date
        OR OLD.application_end_date    IS DISTINCT FROM NEW.application_end_date
        OR OLD.official_notification_url IS DISTINCT FROM NEW.official_notification_url)
    THEN
      NEW.verified_at := NULL;
    ELSE
      NEW.verified_at := OLD.verified_at;
    END IF;
    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sarkari_naukri_verify ON public.sarkari_naukri;
CREATE TRIGGER sarkari_naukri_verify
  BEFORE INSERT OR UPDATE ON public.sarkari_naukri
  FOR EACH ROW EXECUTE FUNCTION public.trg_sarkari_verify();

-- ── 2. Test harness ──────────────────────────────────────────────────────────
DO $$
DECLARE
  v_editor   uuid;   -- a user who holds publish_post
  v_none     uuid;   -- a user who does NOT hold publish_post
  v_id       uuid;
  v_verified timestamptz;
  results    text := '';
begin
  SELECT up.id INTO v_editor
    FROM user_profiles up
    JOIN role_permissions rp ON rp.role_id = up.role_id
    JOIN permissions p       ON p.id = rp.permission_id
   WHERE p.slug = 'publish_post' AND up.is_active = true
   LIMIT 1;

  SELECT up.id INTO v_none
    FROM user_profiles up
   WHERE up.is_active = true
     AND NOT EXISTS (
       SELECT 1 FROM role_permissions rp
       JOIN permissions p ON p.id = rp.permission_id
      WHERE rp.role_id = up.role_id AND p.slug = 'publish_post')
   LIMIT 1;

  IF v_editor IS NULL OR v_none IS NULL THEN
    RAISE EXCEPTION 'need one user WITH and one WITHOUT publish_post (editor=%, none=%)', v_editor, v_none;
  END IF;

  -- helper: set the acting identity for the rest of the transaction
  -- (inline below via set_config calls)

  -- T1: verify WITHOUT official link → error
  set_config('request.jwt.claims', json_build_object('sub', v_editor)::text, true);
  set_config('request.jwt.claim.sub', v_editor::text, true);
  INSERT INTO sarkari_naukri (slug, recruitment_type, title, organization, workflow_status, application_end_date)
    VALUES ('_jt_no_link', 'direct', '_jt_no_link', 'TestOrg', 'draft', current_date + 30)
  RETURNING id INTO v_id;
  BEGIN
    UPDATE sarkari_naukri SET verified_at = now() WHERE id = v_id;
    results := results || 'T1 no-link: FAIL (no error raised)' || E'\n';
  EXCEPTION WHEN OTHERS THEN
    results := results || 'T1 no-link: PASS (' || SQLERRM || ')' || E'\n';
  END;

  -- T1b: verify with NON-http link (ftp://) → error (J2c regex)
  INSERT INTO sarkari_naukri (slug, recruitment_type, title, organization, workflow_status, application_end_date, official_notification_url)
    VALUES ('_jt_ftp', 'direct', '_jt_ftp', 'TestOrg', 'draft', current_date + 30, 'ftp://example.com/x')
  RETURNING id INTO v_id;
  BEGIN
    UPDATE sarkari_naukri SET verified_at = now() WHERE id = v_id;
    results := results || 'T1b ftp-link: FAIL (no error raised)' || E'\n';
  EXCEPTION WHEN OTHERS THEN
    results := results || 'T1b ftp-link: PASS (' || SQLERRM || ')' || E'\n';
  END;

  -- T2: verify WITHOUT end date → error
  INSERT INTO sarkari_naukri (slug, recruitment_type, title, organization, workflow_status, official_notification_url)
    VALUES ('_jt_no_end', 'direct', '_jt_no_end', 'TestOrg', 'draft', 'https://example.com/notif')
  RETURNING id INTO v_id;
  BEGIN
    UPDATE sarkari_naukri SET verified_at = now() WHERE id = v_id;
    results := results || 'T2 no-enddate: FAIL (no error raised)' || E'\n';
  EXCEPTION WHEN OTHERS THEN
    results := results || 'T2 no-enddate: PASS (' || SQLERRM || ')' || E'\n';
  END;

  -- T3: verify as a role WITHOUT publish_post → 42501
  set_config('request.jwt.claims', json_build_object('sub', v_none)::text, true);
  set_config('request.jwt.claim.sub', v_none::text, true);
  INSERT INTO sarkari_naukri (slug, recruitment_type, title, organization, workflow_status, application_end_date, official_notification_url)
    VALUES ('_jt_noperm', 'direct', '_jt_noperm', 'TestOrg', 'draft', current_date + 30, 'https://example.com/notif')
  RETURNING id INTO v_id;
  BEGIN
    UPDATE sarkari_naukri SET verified_at = now() WHERE id = v_id;
    results := results || 'T3 noperm: FAIL (no error raised)' || E'\n';
  EXCEPTION WHEN INSUFFICIENT_PRIVILEGE THEN
    results := results || 'T3 noperm: PASS (42501)' || E'\n';
  WHEN OTHERS THEN
    results := results || 'T3 noperm: FAIL (wrong error ' || SQLERRM || ' / ' || SQLSTATE || ')' || E'\n';
  END;

  -- T4: valid verify as editor → now() (non-null, server clock)
  set_config('request.jwt.claims', json_build_object('sub', v_editor)::text, true);
  set_config('request.jwt.claim.sub', v_editor::text, true);
  UPDATE sarkari_naukri SET verified_at = now() WHERE id = v_id
    RETURNING verified_at INTO v_verified;
  IF v_verified IS NOT NULL THEN
    results := results || 'T4 valid-verify: PASS (verified_at=' || v_verified || ')' || E'\n';
  ELSE
    results := results || 'T4 valid-verify: FAIL (verified_at null)' || E'\n';
  END;

  -- T5: change a gated date → verified_at cleared
  UPDATE sarkari_naukri SET application_end_date = current_date + 60 WHERE id = v_id
    RETURNING verified_at INTO v_verified;
  IF v_verified IS NULL THEN
    results := results || 'T5 date-change-clears: PASS' || E'\n';
  ELSE
    results := results || 'T5 date-change-clears: FAIL (still ' || v_verified || ')' || E'\n';
  END;

  -- T6: backdating attempt on a verified row with NO gated change → OLD kept
  UPDATE sarkari_naukri SET verified_at = now() WHERE id = v_id;          -- re-verify
  UPDATE sarkari_naukri SET verified_at = '1999-01-01T00:00:00+00', title = '_jt_renamed' WHERE id = v_id
    RETURNING verified_at INTO v_verified;
  IF v_verified IS NOT NULL AND EXTRACT(YEAR FROM v_verified) <> 1999 THEN
    results := results || 'T6 backdate-blocked: PASS (kept ' || v_verified || ')' || E'\n';
  ELSE
    results := results || 'T6 backdate-blocked: FAIL (got ' || v_verified || ')' || E'\n';
  END;

  -- T7: INSERT arriving pre-verified WITHOUT permission → error
  set_config('request.jwt.claims', json_build_object('sub', v_none)::text, true);
  set_config('request.jwt.claim.sub', v_none::text, true);
  BEGIN
    INSERT INTO sarkari_naukri (slug, recruitment_type, title, organization, workflow_status, application_end_date, official_notification_url, verified_at)
      VALUES ('_jt_preverified', 'direct', '_jt_preverified', 'TestOrg', 'draft', current_date + 30, 'https://example.com/notif', now());
    results := results || 'T7 insert-preverified-noperm: FAIL (no error raised)' || E'\n';
  EXCEPTION WHEN OTHERS THEN
    results := results || 'T7 insert-preverified-noperm: PASS (' || SQLERRM || ')' || E'\n';
  END;

  RAISE NOTICE E'\n==== J2 TRIGGER PROOF ====\n%', results;
END;
$$;

ROLLBACK;  -- net effect on the live database: NOTHING
