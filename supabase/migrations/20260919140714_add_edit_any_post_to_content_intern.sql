-- Same reasoning as edit_any_exam: created_by is null across the existing post/vacancy/news
-- corpus, so edit_own_post matches nothing that already exists. Add edit_any_post so the
-- intern can update existing content. NOT publish_post — the gate stays at publish.
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r JOIN permissions p ON p.slug = 'edit_any_post'
WHERE r.slug = 'content-intern'
ON CONFLICT (role_id, permission_id) DO NOTHING;

SELECT array_agg(p.slug ORDER BY p.slug) AS content_intern_perms
FROM roles r JOIN role_permissions rp ON rp.role_id=r.id JOIN permissions p ON p.id=rp.permission_id
WHERE r.slug='content-intern';;
