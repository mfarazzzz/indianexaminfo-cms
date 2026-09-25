
-- Retire sample-papers module (content moved to exam_resources library). Deactivate rather
-- than delete so it's reversible and audit-visible. `news` NOT retired (its replacement,
-- Related News, is not built yet — nothing retired before its replacement is live).
update module_registry set is_active = false, updated_at = now() where slug = 'sample-papers';
select slug, is_active from module_registry where slug in ('news','sample-papers');
;
