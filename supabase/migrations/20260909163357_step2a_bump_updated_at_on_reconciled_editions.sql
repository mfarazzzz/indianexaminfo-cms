
-- The 2a reconciliation genuinely changed these editions' content; reflect that
-- in updated_at (the real last-write timestamp the frontend reads for lastUpdated).
-- Scoped to exactly the rows 2a wrote: ibps-clerk(fee), rrb-je(fee+elig),
-- rrb-ntpc(vacancy), india-post-gds-2026(vacancy).
update exam_editions ed
set updated_at = now()
from exams e
where e.current_edition_id = ed.id
  and e.slug in ('ibps-clerk','rrb-je','rrb-ntpc','india-post-gds-2026');
;
