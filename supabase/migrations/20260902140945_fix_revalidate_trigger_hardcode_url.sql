
-- Replace the trigger function with the hardcoded project URL.
-- The Supabase project URL is not a secret — it's in the anon key and
-- exposed in the frontend bundle. Only the service role key (which the
-- Edge Function holds internally) and the revalidate_token are secrets.

CREATE OR REPLACE FUNCTION notify_frontend_revalidate()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_exam_slug text;
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

  -- Call the Edge Function asynchronously (fire and forget)
  PERFORM net.http_post(
    url     := 'https://cwbhhcqsrbuoybeaondk.supabase.co/functions/v1/revalidate-frontend',
    headers := jsonb_build_object('Content-Type', 'application/json'),
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
;
