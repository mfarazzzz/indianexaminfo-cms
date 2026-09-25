-- Existing exam records have created_by = null, so the own-row path never matches.
-- The intern's core job is updating existing exams -> add edit_any_exam. NOT publish_exam:
-- the gate stays at publish, not at edit.
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r JOIN permissions p ON p.slug = 'edit_any_exam'
WHERE r.slug = 'content-intern'
ON CONFLICT (role_id, permission_id) DO NOTHING;;
