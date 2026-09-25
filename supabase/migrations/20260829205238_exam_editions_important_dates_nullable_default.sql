-- Group 2.3: allow NULL and change default '[]' -> NULL so a newly created
-- edition no longer stores a truthy empty array that could shadow other data.
-- All readers coalesce (?? [] / Array.isArray guard), so NULL is safe.
ALTER TABLE public.exam_editions ALTER COLUMN important_dates DROP NOT NULL;
ALTER TABLE public.exam_editions ALTER COLUMN important_dates DROP DEFAULT;
ALTER TABLE public.exam_editions ALTER COLUMN important_dates SET DEFAULT NULL;;
