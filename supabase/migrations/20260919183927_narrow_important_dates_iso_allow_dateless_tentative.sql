-- Narrow the important_dates validity rule:
--   * If a `date` key is present and non-empty, it MUST be ISO (^YYYY-MM-DD$) in EVERY state
--     (no state may carry prose like "To be announced" in the date field).
--   * A row with no date (absent or empty string) is allowed ONLY when state is
--     expected / postponed / cancelled ("there is no date yet"), never confirmed and never
--     when state is missing.
-- This grants "there is no date yet", not "put anything here".
CREATE OR REPLACE FUNCTION public.important_dates_all_iso(dates jsonb)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $function$
  SELECT dates IS NULL
    OR (
      jsonb_typeof(dates) = 'array'
      AND NOT EXISTS (
        SELECT 1
        FROM jsonb_array_elements(dates) AS x
        WHERE NOT (
          CASE
            -- date present and non-empty -> must be ISO
            WHEN (x->>'date') IS NOT NULL AND (x->>'date') <> ''
              THEN (x->>'date') ~ '^\d{4}-\d{2}-\d{2}$'
            -- no date -> permitted only for tentative/negative states
            ELSE lower(coalesce(x->>'state','')) IN ('expected','postponed','cancelled')
          END
        )
      )
    );
$function$;;
