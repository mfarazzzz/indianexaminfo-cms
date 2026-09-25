CREATE OR REPLACE VIEW v_cms_user_permissions AS
SELECT
  u.id, u.supabase_uid, u.email, u.username, u.full_name,
  u.cms_role, u.is_active, u.avatar_url, u.author_id,
  u.ai_generation_allowed, u.ai_daily_limit,
  u.last_active_at, u.created_at, u.updated_at,
  COALESCE(
    json_agg(
      json_build_object('resource', p.resource, 'action', p.action, 'scope', p.scope)
    ) FILTER (WHERE p.id IS NOT NULL),
    '[]'::json
  ) AS permissions
FROM cms_users u
LEFT JOIN cms_permissions p ON p.role = u.cms_role
WHERE u.is_active = true
GROUP BY u.id;;
