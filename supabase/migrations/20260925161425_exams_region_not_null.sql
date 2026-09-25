-- Verified 0 NULLs before applying. NOT NULL enforces region at the DB level so
-- no script/import/API can write a region-less exam that silently appears on no
-- state page. The FK already restricts values to the regions controlled list.
alter table exams alter column region set not null;
