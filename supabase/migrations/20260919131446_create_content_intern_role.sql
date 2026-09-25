-- content-intern: creates exams, posts and sarkari_naukri vacancies (create_post also
-- gates sarkari_naukri inserts); edits only own posts; uploads media. NO publish of any
-- kind, NO edit_any, NO delete. Does not touch the existing writer role.
INSERT INTO roles (slug, name, description, is_system)
VALUES ('content-intern', 'Content Intern',
        'Creates exams, posts and recruitment vacancies; edits only own posts; uploads media. Cannot publish, cannot edit others'' content, cannot delete.',
        true)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.slug IN ('create_exam','create_post','edit_own_post','upload_media')
WHERE r.slug = 'content-intern'
ON CONFLICT (role_id, permission_id) DO NOTHING;;
