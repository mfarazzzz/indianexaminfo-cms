
-- ── Enable pg_net for HTTP calls from Postgres ────────────────────────────────
CREATE EXTENSION IF NOT EXISTS pg_net;

-- ── Trigger function: fire revalidate when exam_editions.important_dates changes
-- Calls the Edge Function 'revalidate-frontend' which forwards to the Next.js
-- revalidate endpoint. Edge Function holds the token, not this trigger.
-- Fires on UPDATE only (INSERT creates a new edition; the exam itself triggers
-- a separate revalidation on the exams table save in the CMS).

CREATE OR REPLACE FUNCTION notify_frontend_revalidate()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_exam_slug text;
  v_supabase_url text;
BEGIN
  -- Only fire when important_dates actually changed
  IF OLD.important_dates IS NOT DISTINCT FROM NEW.important_dates THEN
    RETURN NEW;
  END IF;

  -- Look up the exam slug for tag-level invalidation
  SELECT slug INTO v_exam_slug
  FROM exams
  WHERE current_edition_id = NEW.id
  LIMIT 1;

  -- Get project URL from settings if available, fallback to env
  SELECT value::text INTO v_supabase_url
  FROM settings
  WHERE key = 'supabase_url'
  LIMIT 1;

  -- Call the Edge Function asynchronously (fire and forget — pg_net doesn't block)
  -- The Edge Function reads the revalidate_token from settings and calls the frontend.
  PERFORM net.http_post(
    url     := COALESCE(v_supabase_url,
                current_setting('app.supabase_url', true),
                '') || '/functions/v1/revalidate-frontend',
    headers := jsonb_build_object(
                 'Content-Type', 'application/json'
               ),
    body    := jsonb_build_object(
                 'exam_slug', COALESCE(v_exam_slug, ''),
                 'tag',       CASE
                                WHEN v_exam_slug IS NOT NULL
                                THEN 'exam:' || v_exam_slug
                                ELSE 'exams'
                              END
               )
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Never fail a save because revalidation errored
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER trg_revalidate_on_dates_change
AFTER UPDATE ON exam_editions
FOR EACH ROW
EXECUTE FUNCTION notify_frontend_revalidate();
;
