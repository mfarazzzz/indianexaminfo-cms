/**
 * entity-localization.ts — Row-per-field multilingual content (ADR-008)
 * One row per (entity_id, lang, field_key).
 * Canonical entity is English. Translations overlay canonical fields.
 * Adding a new language = insert rows with new lang code. Zero schema changes.
 */

export interface EntityLocalizationRow {
  id: string
  entityId: string
  /** BCP-47 language code: 'en', 'hi', 'ta', 'te', etc. */
  lang: string
  /** Entity field name: 'name', 'seo_title', 'meta_description', etc. */
  fieldKey: string
  value: string
  translatorId?: string | null
  isReviewed: boolean
  createdAt: string
  updatedAt: string
}

/** Map of field_key → translated value for a given entity+lang pair */
export type LocalizationMap = Record<string, string>
