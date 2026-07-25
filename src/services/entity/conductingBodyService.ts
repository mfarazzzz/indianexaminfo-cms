/**
 * conductingBodyService.ts — CRUD for the `conducting_body` lookup table.
 * Supports the normalized conducting body dropdown (Req 15.6, 15.7).
 */
import { db } from '@/lib/supabase/client'
import type { ConductingBody } from '@/types/entity'

function mapRow(row: Record<string, unknown>): ConductingBody {
  return {
    id: row.id as string,
    name: row.name as string,
    shortName: row.short_name as string | null,
    slug: row.slug as string,
    officialWebsite: row.official_website as string | null,
    parentId: row.parent_id as string | null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  }
}

/** Fetch all conducting bodies (small table, cached with staleTime: Infinity) */
export async function listConductingBodies(): Promise<ConductingBody[]> {
  const { data, error } = await db
    .from('conducting_body')
    .select('*')
    .order('parent_id', { ascending: true, nullsFirst: true })
    .order('name', { ascending: true })
  if (error) throw error
  return (data ?? []).map(mapRow)
}

/** Search conducting bodies by name or short_name substring */
export async function searchConductingBodies(query: string): Promise<ConductingBody[]> {
  const { data, error } = await db
    .from('conducting_body')
    .select('*')
    .or(`name.ilike.%${query}%,short_name.ilike.%${query}%`)
    .order('name', { ascending: true })
    .limit(20)
  if (error) throw error
  return (data ?? []).map(mapRow)
}

/** Create a new conducting body entry (admin/editor only) */
export async function createConductingBody(input: {
  name: string
  shortName?: string | null
  slug: string
  officialWebsite?: string | null
}): Promise<ConductingBody> {
  const { data, error } = await db
    .from('conducting_body')
    .insert({
      name: input.name,
      short_name: input.shortName ?? null,
      slug: input.slug,
      official_website: input.officialWebsite ?? null,
    })
    .select('*')
    .single()
  if (error) throw error
  return mapRow(data as Record<string, unknown>)
}
