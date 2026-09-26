-- Migration A: enum catalog changes only (NO DML that uses the new value —
-- PostgreSQL forbids using a freshly-ADDed enum value in the same transaction).
-- Renaming an existing value and adding a new one are catalog ops and are safe
-- together; the new value is USED in migration B (a later, separate transaction).

-- Rename the bare 'university' to 'university-admission'. The bare word is what
-- led ten admission records into the University Exams pillar; naming it for what
-- it is (admission) stops the next editor making the same assumption.
alter type entity_type rename value 'university' to 'university-admission';

-- Add the new value for genuine university (semester/term-end) exam records.
alter type entity_type add value if not exists 'university-exam';
