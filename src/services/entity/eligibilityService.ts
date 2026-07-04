import { db } from '@/lib/supabase/client'
import type { EntityEligibility } from '@/types/entity'
import type { EligibilityInput } from '@/lib/validation/entitySchemas'

function mapRow(r: Record<string, unknown>): EntityEligibility {
  return {
    id: r.id as string,
    entityId: r.entity_id as string,
    minAge: r.min_age as number | null,
    maxAge: r.max_age as number | null,
    ageRelaxation: (r.age_relaxation as EntityEligibility['ageRelaxation']) ?? [],
    nationality: r.nationality as string | null,
    education: r.education as string | null,
    experience: r.experience as string | null,
    maxAttempts: r.max_attempts as number | null,
    physicalStandards: r.physical_standards as string | null,
    medicalStandards: r.medical_standards as string | null,
    languageRequirements: r.language_requirements as string | null,
    updatedAt: r.updated_at as string,
  }
}

export async function getEligibility(
  entityId: string
): Promise<EntityEligibility | null> {
  const { data } = await db
    .from('entity_eligibility')
    .select('*')
    .eq('entity_id', entityId)
    .maybeSingle()
  return data ? mapRow(data as Record<string, unknown>) : null
}

export async function upsertEligibility(
  entityId: string,
  input: EligibilityInput
): Promise<void> {
  const { error } = await db.from('entity_eligibility').upsert(
    {
      entity_id: entityId,
      min_age: input.minAge ?? null,
      max_age: input.maxAge ?? null,
      age_relaxation: input.ageRelaxation ?? [],
      nationality: input.nationality ?? null,
      education: input.education ?? null,
      experience: input.experience ?? null,
      max_attempts: input.maxAttempts ?? null,
      physical_standards: input.physicalStandards ?? null,
      medical_standards: input.medicalStandards ?? null,
      language_requirements: input.languageRequirements ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'entity_id' }
  )
  if (error) throw error
}
