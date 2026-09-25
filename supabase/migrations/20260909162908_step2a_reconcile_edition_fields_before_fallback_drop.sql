
-- STEP 2a: reconcile the handful of editions where the parent held the correct
-- value and the current edition was empty or wrong, BEFORE the read path stops
-- reading the parent fallback (2b) and BEFORE the parent columns are dropped (4).
-- Writes the SAME jsonb shape the CMS updateEdition() passthrough writes.
-- Backup: _backup_step2a_20260908. Direction: parent -> edition in every case.
-- SKIPPED intentionally: aiims-norcet fee (all-zero junk), rrb-je/rrb-ntpc dates
-- (2024 seed junk / legacy untyped shape that would not feed exam_derived_status).

-- ibps-clerk: edition fee empty {}, parent has real IBPS fee -> copy (case a)
update exam_editions ed
set application_fee = e.application_fee
from exams e
where e.current_edition_id = ed.id and e.slug = 'ibps-clerk'
  and (ed.application_fee is null or ed.application_fee::text in ('{}','null'));

-- rrb-je: edition fee empty, parent has real RRB fee -> copy (case a)
update exam_editions ed
set application_fee = e.application_fee
from exams e
where e.current_edition_id = ed.id and e.slug = 'rrb-je'
  and (ed.application_fee is null or ed.application_fee::text in ('{}','null'));

-- rrb-je: edition eligibility corrupt ("50 Years","Gradution") -> overwrite w/ correct parent (case d)
update exam_editions ed
set eligibility = e.eligibility
from exams e
where e.current_edition_id = ed.id and e.slug = 'rrb-je';

-- rrb-ntpc: edition vacancy empty, parent 11558 real -> copy (case a)
update exam_editions ed
set vacancy = e.vacancy
from exams e
where e.current_edition_id = ed.id and e.slug = 'rrb-ntpc'
  and (ed.vacancy is null or ed.vacancy = 0);

-- india-post-gds-2026: edition vacancy stub 400, parent 44228 real -> overwrite (case d)
update exam_editions ed
set vacancy = e.vacancy
from exams e
where e.current_edition_id = ed.id and e.slug = 'india-post-gds-2026';
;
