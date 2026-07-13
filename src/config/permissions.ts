/**
 * permissions.ts — Canonical permission slugs.
 * Must match what is seeded in the `permissions` Supabase table.
 */
export const P = {
  // Content
  CREATE_POST:       "create_post",
  EDIT_ANY_POST:     "edit_any_post",
  EDIT_OWN_POST:     "edit_own_post",
  DELETE_POST:       "delete_post",
  PUBLISH_POST:      "publish_post",
  CREATE_EXAM:       "create_exam",
  EDIT_ANY_EXAM:     "edit_any_exam",
  DELETE_EXAM:       "delete_exam",
  PUBLISH_EXAM:      "publish_exam",
  // Structure
  MANAGE_CATEGORIES: "manage_categories",
  MANAGE_MENUS:      "manage_menus",
  MANAGE_PAGES:      "manage_pages",
  // Media
  UPLOAD_MEDIA:      "upload_media",
  DELETE_MEDIA:      "delete_media",
  // Ads
  MANAGE_ADS:        "manage_ads",
  VIEW_OWN_ADS:      "view_own_ads",
  MANAGE_AD_ZONES:   "manage_ad_zones",
  // Users
  MANAGE_USERS:      "manage_users",
  MANAGE_ROLES:      "manage_roles",
  // System
  MANAGE_SETTINGS:   "manage_settings",
  VIEW_ANALYTICS:    "view_analytics",
  VIEW_AUDIT_LOG:    "view_audit_log",
  // M3.8 — Structural taxonomy governance
  MANAGE_STRUCTURAL_TAXONOMY: "manage_structural_taxonomy",
  // M3.8 — Content operations
  PUBLISH_ENTITY:    "publish_entity",
  VERIFY_CONTENT:    "verify_content",
  MANAGE_RELATIONSHIPS: "manage_relationships",
  MANAGE_AMENDMENTS: "manage_amendments",
} as const;

export type PermissionSlug = typeof P[keyof typeof P];
