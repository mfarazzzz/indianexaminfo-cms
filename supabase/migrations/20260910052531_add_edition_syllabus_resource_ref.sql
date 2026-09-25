
-- Option A (one file, one row): the edition REFERENCES a syllabus-pdf row in the library
-- rather than storing its own copy. Nullable; ON DELETE SET NULL so deleting the resource
-- just clears the edition's pointer (never cascade-deletes the edition).
alter table exam_editions
  add column if not exists syllabus_resource_id uuid references exam_resources(id) on delete set null;

create index if not exists exam_editions_syllabus_resource_idx
  on exam_editions (syllabus_resource_id) where syllabus_resource_id is not null;
;
