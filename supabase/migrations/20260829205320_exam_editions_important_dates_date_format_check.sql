-- Group 2.4: block junk dates at the source via an IMMUTABLE validator function
-- (CHECK constraints cannot contain subqueries, so the array scan lives in a fn).
-- Returns true when every element's `date` is an ISO YYYY-MM-DD string.
-- NULL input and empty array are valid. Dry run confirmed 0 existing violations.
CREATE OR REPLACE FUNCTION public.important_dates_all_iso(dates jsonb)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT dates IS NULL
    OR (
      jsonb_typeof(dates) = 'array'
      AND NOT EXISTS (
        SELECT 1
        FROM jsonb_array_elements(dates) AS x
        WHERE (x->>'date') IS NULL
           OR (x->>'date') !~ '^\d{4}-\d{2}-\d{2}$'
      )
    );
$$;

ALTER TABLE public.exam_editions
ADD CONSTRAINT exam_editions_important_dates_valid
CHECK (public.important_dates_all_iso(important_dates));;
