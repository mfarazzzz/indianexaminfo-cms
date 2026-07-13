/**
 * taxonomyService.ts — Generic CRUD for all 7 descriptive taxonomy tables.
 * Descriptive taxonomy is editor-managed (categories, conducting bodies, tags, etc.).
 * All 7 tables share the same schema — one service handles all of them.
 */
import { db } from '@/lib/supabase/client'
import type { TaxonomyBase, TaxonomyTable, TaxonomyInput, MergeResult } from '@/types/taxonomy'

// ── Row mapper ────────────────────────────────────────────────────────────────

function mapRow<T extends TaxonomyBase>(row: Record<string, unknown>): T {
  return {
    id:          row.id as string,
    slug:        row.slug as string,
    label:       row.label as string,
    usageCount:  row.usage_count as number,
    isActive:    row.is_active as boolean,
    createdVia:  row.created_via as string | null,
    createdAt:   row.created_at as string,
    createdBy:   row.created_by as string | null,
    updatedAt:   row.updated_at as string,
    deletedAt:   row.deleted_at as string | null,
  } as T
}

// ── Slugify helper ─────────────────────────────────────────────────────────────

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 100)
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function listTaxonomy<T extends TaxonomyBase>(
  table: TaxonomyTable
): Promise<T[]> {
  const { data, error } = await db
    .from(table)
    .select('*')
    .is('deleted_at', null)
    .order('label', { ascending: true })
  if (error) throw error
  return (data ?? []).map((row: Record<string, unknown>) => mapRow<T>(row))
}

export async function getTaxonomyBySlug<T extends TaxonomyBase>(
  table: TaxonomyTable,
  slug: string
): Promise<T | null> {
  const { data, error } = await db
    .from(table)
    .select('*')
    .eq('slug', slug)
    .is('deleted_at', null)
    .single()
  if (error || !data) return null
  return mapRow<T>(data as Record<string, unknown>)
}

export async function createTaxonomy<T extends TaxonomyBase>(
  table: TaxonomyTable,
  input: TaxonomyInput,
  userId?: string
): Promise<T> {
  const slug = slugify(input.label)

  // Case-insensitive uniqueness check
  const { data: existing } = await db
    .from(table)
    .select('id, label')
    .ilike('label', input.label)
    .is('deleted_at', null)
    .limit(1)
    .single()

  if (existing) {
    throw new Error(`'${input.label}' already exists`)
  }

  const { data, error } = await db
    .from(table)
    .insert({
      slug,
      label:       input.label,
      created_via: input.createdVia ?? 'taxonomy_manager',
      created_by:  userId ?? null,
      usage_count: 0,
      is_active:   true,
    })
    .select('*')
    .single()
  if (error) throw error
  return mapRow<T>(data as Record<string, unknown>)
}

export async function renameTaxonomy(
  table: TaxonomyTable,
  id: string,
  newLabel: string
): Promise<void> {
  const { error } = await db
    .from(table)
    .update({ label: newLabel, slug: slugify(newLabel) })
    .eq('id', id)
  if (error) throw error
}

export async function mergeTaxonomy(
  table: TaxonomyTable,
  sourceId: string,
  targetId: string
): Promise<MergeResult> {
  // For each taxonomy table, entity references it via a FK column
  // The FK column name convention is: {table}_id on the entity table
  // e.g. conducting_body → conducting_body_id, exam_level → exam_level_id
  const fkColumn = `${table}_id`

  // Count affected entities
  const { count } = await db
    .from('entity')
    .select('id', { count: 'exact', head: true })
    .eq(fkColumn, sourceId)
    .is('deleted_at', null)

  const mergedCount = count ?? 0

  // Update entity references: source → target
  if (mergedCount > 0) {
    const { error: updateErr } = await db
      .from('entity')
      .update({ [fkColumn]: targetId })
      .eq(fkColumn, sourceId)
      .is('deleted_at', null)
    if (updateErr) throw updateErr
  }

  // Increment target usage_count
  const { error: incErr } = await db
    .from(table)
    .update({ usage_count: db.rpc('increment', { x: mergedCount }) as unknown as number })
    .eq('id', targetId)
  if (incErr) {
    // Fallback: direct increment if RPC not available
    const { data: cur } = await db.from(table).select('usage_count').eq('id', targetId).single()
    const currentCount = (cur as Record<string, unknown>)?.usage_count as number ?? 0
    await db.from(table).update({ usage_count: currentCount + mergedCount }).eq('id', targetId)
  }

  // Soft-delete source
  const { error: deleteErr } = await db
    .from(table)
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', sourceId)
  if (deleteErr) throw deleteErr

  return { sourceId, targetId, mergedCount }
}

export async function disableTaxonomy(table: TaxonomyTable, id: string): Promise<void> {
  const { error } = await db
    .from(table)
    .update({ is_active: false })
    .eq('id', id)
  if (error) throw error
}

export async function getTaxonomyUsageCount(
  table: TaxonomyTable,
  id: string
): Promise<number> {
  const fkColumn = `${table}_id`
  const { count, error } = await db
    .from('entity')
    .select('id', { count: 'exact', head: true })
    .eq(fkColumn, id)
    .is('deleted_at', null)
  if (error) throw error
  return count ?? 0
}
