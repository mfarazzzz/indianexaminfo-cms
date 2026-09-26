-- Migration C: enforce valid (pillar, entity_type) pairs at the DATABASE, so a
-- script, import, or future API cannot write a wrong pairing (the region lesson).
-- Pillar decides entity type; only entrance-exam carries a genuine choice
-- (an entrance exam, or a counselling-route university admission).
alter table exams
  drop constraint if exists exams_pillar_entity_type_valid;
alter table exams
  add constraint exams_pillar_entity_type_valid check (
    (pillar = 'government-exam' and entity_type = 'recruitment') or
    (pillar = 'govt-vacancy'    and entity_type = 'recruitment') or
    (pillar = 'board-exam'      and entity_type = 'board') or
    (pillar = 'university-exam' and entity_type = 'university-exam') or
    (pillar = 'entrance-exam'   and entity_type in ('exam','university-admission'))
  );
