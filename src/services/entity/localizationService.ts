/**
 * localizationService.ts — Row-per-field translations (ADR-008).
 * Canonical entity is English (entity table).
 * Translations overlay canonical fields from entity_localization table.
 */
import { db } from '@/lib/supabase/client'
import type { EntityLocalizationRow, LocalizationMap } from '@/types/entity-localization'

// ── Row mapper ────────────────────────────────────────────────────────────────

function mapRow(row: Record<string, unknown>): EntityLocalizationRow {
  return {
    id:           row.id as string,
    entityId:     row.entity_id as string,
    lang:         row.lang as string,
    fieldKey:     row.field_key as string,
    value:        row.value as string,
    translatorId: row.translator_id as string | null,
    isReviewed:   row.is_reviewed as boolean,
    createdAt:    row.created_at as string,
    updatedAt:    row.updated_at as string,
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Returns all translated fields for an entity+language as a flat map.
 * { field_key → value }
 */
export async function getLocalization(
  entityId: string,
  lang: string
): Promise<LocalizationMap> {
  const { data, error } = await db
    .from('entity_localization')
    .select('field_key, value')
    .eq('entity_id', entityId)
    .eq('lang', lang)
  if (error) throw error
  return Object.fromEntries((data ?? []).map((r: { field_key: string; value: string }) => [r.field_key, r.value]))
}

/**
 * Upsert a single translated field.
 * If value is empty string, deletes the row (treats empty = no translation).
 */
export async function setLocalization(
  entityId: string,
  lang: string,
  fieldKey: string,
  value: string,
  translatorId?: string
): Promise<void> {
  if (value.trim() === '') {
    // Empty string = remove translation, fallback to canonical
    await db
      .from('entity_localization')
      .delete()
      .eq('entity_id', entityId)
      .eq('lang', lang)
      .eq('field_key', fieldKey)
    return
  }

  const { error } = await db
    .from('entity_localization')
    .upsert(
      {
        entity_id:     entityId,
        lang,
        field_key:     fieldKey,
        value,
        translator_id: translatorId ?? null,
        is_reviewed:   false,
      },
      { onConflict: 'entity_id,lang,field_key' }
    )
  if (error) throw error
}

/**
 * Returns all localization rows for an entity, grouped by language.
 */
export async function listTranslatedFields(entityId: string): Promise<{
  lang: string
  fieldKey: string
  isReviewed: boolean
}[]> {
  const { data, error } = await db
    .from('entity_localization')
    .select('lang, field_key, is_reviewed')
    .eq('entity_id', entityId)
    .order('lang')
    .order('field_key')
  if (error) throw error
  return (data ?? []).map((r: { lang: string; field_key: string; is_reviewed: boolean }) => ({
    lang:       r.lang,
    fieldKey:   r.field_key,
    isReviewed: r.is_reviewed,
  }))
}

/**
 * Returns all rows for an entity+language for audit/translation UI.
 */
export async function listLocalizationRows(
  entityId: string,
  lang: string
): Promise<EntityLocalizationRow[]> {
  const { data, error } = await db
    .from('entity_localization')
    .select('*')
    .eq('entity_id', entityId)
    .eq('lang', lang)
    .order('field_key')
  if (error) throw error
  return (data ?? []).map(mapRow)
}
