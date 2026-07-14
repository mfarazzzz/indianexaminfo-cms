-- Migration: 001_permission_helper
-- Task: M1-T1
-- Requirements: REQ-037
-- Design: Section 2.0, Section 11
--
-- Note: roles, permissions, role_permissions tables already exist (from types.ts).
-- This migration adds user_pillar_access and the has_permission() helper function,
-- then seeds the canonical roles and permissions for the Content OS.

-- ── user_pillar_access ────────────────────────────────────────────────────────
-- Scopes editors to specific content domains (optional restriction per REQ-037.4)

create table if not exists user_pillar_access (
  user_id     uuid not null references auth.users(id) on delete cascade,
  pillar_slug text not null,
  primary key (user_id, pillar_slug)
);

-- ── has_permission() helper ───────────────────────────────────────────────────
-- Checks if the current authenticated user has a given permission slug.
-- Result is stable within a transaction — Postgres will cache it per query
-- once the session variable is set.

create or replace function has_permission(required_perm text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from user_profiles up
    join role_permissions rp on rp.role_id = up.role_id
    join permissions p       on p.id        = rp.permission_id
    where up.id   = auth.uid()
      and p.slug  = required_perm
  );
$$;

-- ── Seed permissions ──────────────────────────────────────────────────────────
-- Insert canonical Content OS permissions.
-- 'group' column exists on permissions table per existing schema.

insert into permissions (slug, label, "group") values
  ('manage_structural_taxonomy', 'Manage Structural Taxonomy',   'platform'),
  ('manage_descriptive_taxonomy','Manage Descriptive Taxonomy',  'platform'),
  ('create_entity',              'Create Content Item',          'content'),
  ('edit_any_entity',            'Edit Any Content Item',        'content'),
  ('edit_own_entity',            'Edit Own Content Item',        'content'),
  ('transition_to_published',    'Publish Content',              'content'),
  ('verify_content',             'Verify Content',               'content'),
  ('manage_entity_seo',          'Manage SEO',                   'content'),
  ('manage_entity_media',        'Manage Media',                 'content'),
  ('manage_relationships',       'Manage Relationships',         'content'),
  ('publish_amendments',         'Publish Amendments',           'content'),
  ('manage_template_versions',   'Manage Template Versions',     'platform'),
  ('bulk_operations',            'Bulk Operations',              'content')
on conflict (slug) do nothing;

-- ── Seed roles (content OS roles) ────────────────────────────────────────────
-- Extend the existing roles table with Content OS roles.

insert into roles (slug, name, description, is_system) values
  ('platform_admin',   'Platform Administrator', 'Full platform control',        true),
  ('cms_admin',        'CMS Administrator',       'Template and taxonomy admin',  true),
  ('content_manager',  'Content Manager',         'Cross-pillar content manager', false),
  ('editor',           'Editor',                  'Content editor',               false),
  ('reviewer',         'Reviewer',                'Content reviewer and publisher',false),
  ('seo_manager',      'SEO Manager',             'SEO specialist',               false),
  ('media_manager',    'Media Manager',           'Media library manager',        false),
  ('author',           'Author',                  'Content author (own content only)', false),
  ('viewer',           'Viewer',                  'Read-only access',             false)
on conflict (slug) do nothing;
