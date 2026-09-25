
-- The FK was ON DELETE SET NULL, which would silently blank an edition's syllabus PDF
-- when its resource is deleted (silent data loss). Switch to RESTRICT: the DB blocks the
-- delete while any edition references the row. The service surfaces which editions use it,
-- so the editor unlinks/replaces deliberately (same principle as the Excel CONFIRM gate).
alter table exam_editions
  drop constraint if exists exam_editions_syllabus_resource_id_fkey;

alter table exam_editions
  add constraint exam_editions_syllabus_resource_id_fkey
  foreign key (syllabus_resource_id) references exam_resources(id) on delete restrict;
;
