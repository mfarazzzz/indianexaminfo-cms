/**
 * templateService.ts — CRUD and versioning for lifecycle_template and
 * lifecycle_template_version tables.
 *
 * Template edits always create a new version — the configuration is never
 * mutated in-place (ADR-005). Entities are isolated from template changes
 * via their immutable template_snapshot.
 */
import { db } from '@/lib/supabase/client'
import type {
  LifecycleTemplate,
  LifecycleTemplateVersion,
  TemplateInput,
  TemplateConfiguration,
} from '@/types/lifecycle-template'

// ── Row mappers ───────────────────────────────────────────────────────────────

function mapTemplateRow(row: Record<string, unknown>): LifecycleTemplate {
  return {
    id:                    row.id as string,
    pillarId:              row.pillar_id as string,
    name:                  row.name as string,
    slug:                  row.slug as string,
    description:           row.description as string | null,
    defaultModules:        (row.default_modules as string[]) ?? [],
    defaultTimelineStages: (row.default_timeline_stages as []) ?? [],
    defaultValidationRules:(row.default_validation_rules as Record<string, unknown>) ?? {},
    defaultSchemaOrgType:  row.default_schema_org_type as string,
    lifecycleRules:        (row.lifecycle_rules as []) ?? [],
    frontendLayout:        row.frontend_layout as string,
    isActive:              row.is_active as boolean,
    displayOrder:          row.display_order as number,
    createdAt:             row.created_at as string,
    updatedAt:             row.updated_at as string,
    deletedAt:             row.deleted_at as string | null,
  }
}

function mapVersionRow(row: Record<string, unknown>): LifecycleTemplateVersion {
  return {
    id:            row.id as string,
    templateId:    row.template_id as string,
    versionNumber: row.version_number as number,
    configuration: row.configuration as TemplateConfiguration,
    changeSummary: row.change_summary as string | null,
    isActive:      row.is_active as boolean,
    createdBy:     row.created_by as string | null,
    createdAt:     row.created_at as string,
  }
}

// ── Template CRUD ─────────────────────────────────────────────────────────────

export async function listTemplates(pillarId?: string): Promise<LifecycleTemplate[]> {
  let q = db
    .from('lifecycle_template')
    .select('*')
    .is('deleted_at', null)
    .order('display_order', { ascending: true })

  if (pillarId) q = q.eq('pillar_id', pillarId)

  const { data, error } = await q
  if (error) throw error
  return (data ?? []).map(mapTemplateRow)
}

export async function getTemplateById(id: string): Promise<LifecycleTemplate | null> {
  const { data, error } = await db
    .from('lifecycle_template')
    .select('*')
    .eq('id', id)
    .is('deleted_at', null)
    .single()
  if (error || !data) return null
  return mapTemplateRow(data as Record<string, unknown>)
}

export async function createTemplate(input: TemplateInput): Promise<LifecycleTemplate> {
  const { data, error } = await db
    .from('lifecycle_template')
    .insert({
      pillar_id:                input.pillarId,
      name:                     input.name,
      slug:                     input.slug,
      description:              input.description ?? null,
      default_modules:          input.defaultModules ?? [],
      default_timeline_stages:  input.defaultTimelineStages ?? [],
      default_schema_org_type:  input.defaultSchemaOrgType ?? 'Article',
      lifecycle_rules:          input.lifecycleRules ?? [],
      frontend_layout:          input.frontendLayout ?? 'default_layout',
      is_active:                input.isActive ?? true,
      display_order:            input.displayOrder ?? 0,
    })
    .select('*')
    .single()
  if (error) throw error
  return mapTemplateRow(data as Record<string, unknown>)
}

// ── Template Versioning ───────────────────────────────────────────────────────

export async function listTemplateVersions(
  templateId: string
): Promise<LifecycleTemplateVersion[]> {
  const { data, error } = await db
    .from('lifecycle_template_version')
    .select('*')
    .eq('template_id', templateId)
    .order('version_number', { ascending: false })
  if (error) throw error
  return (data ?? []).map(mapVersionRow)
}

export async function getActiveTemplateVersion(
  templateId: string
): Promise<LifecycleTemplateVersion | null> {
  const { data, error } = await db
    .from('lifecycle_template_version')
    .select('*')
    .eq('template_id', templateId)
    .eq('is_active', true)
    .single()
  if (error || !data) return null
  return mapVersionRow(data as Record<string, unknown>)
}

export async function createTemplateVersion(
  templateId: string,
  configuration: TemplateConfiguration,
  changeSummary: string,
  userId: string
): Promise<LifecycleTemplateVersion> {
  // Get next version number
  const { data: maxRow } = await db
    .from('lifecycle_template_version')
    .select('version_number')
    .eq('template_id', templateId)
    .order('version_number', { ascending: false })
    .limit(1)
    .single()

  const nextVersion = maxRow ? (maxRow.version_number as number) + 1 : 1

  const { data, error } = await db
    .from('lifecycle_template_version')
    .insert({
      template_id:    templateId,
      version_number: nextVersion,
      configuration,
      change_summary: changeSummary,
      is_active:      false,
      created_by:     userId,
    })
    .select('*')
    .single()
  if (error) throw error
  return mapVersionRow(data as Record<string, unknown>)
}

export async function activateTemplateVersion(versionId: string): Promise<void> {
  // Get template_id first
  const { data: ver, error: fetchErr } = await db
    .from('lifecycle_template_version')
    .select('template_id')
    .eq('id', versionId)
    .single()
  if (fetchErr || !ver) throw fetchErr ?? new Error('Version not found')

  const templateId = ver.template_id as string

  // Deactivate all versions for this template, then activate the target
  const { error: deactivateErr } = await db
    .from('lifecycle_template_version')
    .update({ is_active: false })
    .eq('template_id', templateId)
    .neq('id', versionId)
  if (deactivateErr) throw deactivateErr

  const { error: activateErr } = await db
    .from('lifecycle_template_version')
    .update({ is_active: true })
    .eq('id', versionId)
  if (activateErr) throw activateErr
}

export async function cloneTemplateVersion(
  versionId: string,
  userId: string
): Promise<LifecycleTemplateVersion> {
  const { data: source, error: fetchErr } = await db
    .from('lifecycle_template_version')
    .select('*')
    .eq('id', versionId)
    .single()
  if (fetchErr || !source) throw fetchErr ?? new Error('Version not found')

  const src = mapVersionRow(source as Record<string, unknown>)
  return createTemplateVersion(
    src.templateId,
    src.configuration,
    `Cloned from v${src.versionNumber}`,
    userId
  )
}

export async function compareTemplateVersions(
  v1Id: string,
  v2Id: string
): Promise<{ v1: LifecycleTemplateVersion; v2: LifecycleTemplateVersion }> {
  const [v1Result, v2Result] = await Promise.all([
    db.from('lifecycle_template_version').select('*').eq('id', v1Id).single(),
    db.from('lifecycle_template_version').select('*').eq('id', v2Id).single(),
  ])
  if (v1Result.error) throw v1Result.error
  if (v2Result.error) throw v2Result.error
  return {
    v1: mapVersionRow(v1Result.data as Record<string, unknown>),
    v2: mapVersionRow(v2Result.data as Record<string, unknown>),
  }
}
