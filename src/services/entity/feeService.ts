import { db } from '@/lib/supabase/client'
import type { EntityFee } from '@/types/entity'
import type { FeeInput } from '@/lib/validation/entitySchemas'

function mapRow(r: Record<string, unknown>): EntityFee {
  return {
    id: r.id as string,
    entityId: r.entity_id as string,
    general: r.general as number | null,
    obc: r.obc as number | null,
    sc: r.sc as number | null,
    st: r.st as number | null,
    ews: r.ews as number | null,
    pwd: r.pwd as number | null,
    female: r.female as number | null,
    paymentModes: (r.payment_modes as string[]) ?? [],
    refundRules: r.refund_rules as string | null,
    updatedAt: r.updated_at as string,
  }
}

export async function getFee(entityId: string): Promise<EntityFee | null> {
  const { data } = await db
    .from('entity_fee')
    .select('*')
    .eq('entity_id', entityId)
    .maybeSingle()
  return data ? mapRow(data as Record<string, unknown>) : null
}

export async function upsertFee(
  entityId: string,
  input: FeeInput
): Promise<void> {
  const { error } = await db.from('entity_fee').upsert(
    {
      entity_id: entityId,
      general: input.general ?? null,
      obc: input.obc ?? null,
      sc: input.sc ?? null,
      st: input.st ?? null,
      ews: input.ews ?? null,
      pwd: input.pwd ?? null,
      female: input.female ?? null,
      payment_modes: input.paymentModes ?? [],
      refund_rules: input.refundRules ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'entity_id' }
  )
  if (error) throw error
}
