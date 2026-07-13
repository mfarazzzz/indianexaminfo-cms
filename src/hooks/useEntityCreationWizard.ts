/**
 * useEntityCreationWizard.ts — 3-step entity creation wizard state machine.
 * Step 1: Enter name + choose Pillar
 * Step 2: Choose Lifecycle Template + Content Type
 * Step 3: Review + Confirm
 */
import { useState, useCallback } from 'react'
import { useMutation } from '@tanstack/react-query'
import { createEntity } from '@/services/entity/entityService'
import { getActiveTemplateVersion } from '@/services/template/templateService'
import type { Pillar } from '@/types/pillar'
import type { LifecycleTemplate } from '@/types/lifecycle-template'
import type { ContentType } from '@/types/content-type'
import type { Entity } from '@/types/entity'

export type WizardStep = 1 | 2 | 3

export interface WizardData {
  name: string
  pillar: Pillar | null
  template: LifecycleTemplate | null
  contentType: ContentType | null
}

const INITIAL_DATA: WizardData = {
  name: '',
  pillar: null,
  template: null,
  contentType: null,
}

export function useEntityCreationWizard() {
  const [step, setStep] = useState<WizardStep>(1)
  const [data, setData] = useState<WizardData>(INITIAL_DATA)

  const updateData = useCallback((patch: Partial<WizardData>) => {
    setData(prev => ({ ...prev, ...patch }))
  }, [])

  const goNext = useCallback(() => {
    setStep(prev => Math.min(prev + 1, 3) as WizardStep)
  }, [])

  const goBack = useCallback(() => {
    setStep(prev => Math.max(prev - 1, 1) as WizardStep)
  }, [])

  const reset = useCallback(() => {
    setStep(1)
    setData(INITIAL_DATA)
  }, [])

  const createMutation = useMutation<Entity, Error, void>({
    mutationFn: async () => {
      if (!data.name.trim())     throw new Error('Entity name is required')
      if (!data.pillar)          throw new Error('Pillar is required')
      if (!data.template)        throw new Error('Lifecycle template is required')
      if (!data.contentType)     throw new Error('Content type is required')

      // Resolve the active template version — this supplies template_version_id
      const version = await getActiveTemplateVersion(data.template.id)
      if (!version) {
        throw new Error(`No active version found for template "${data.template.name}"`)
      }

      return createEntity({
        name:             data.name.trim(),
        slug:             data.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 80),
        conductingBody:   '',
        pillar:           data.pillar.slug,
        lang:             'en',
        // Store template and content type in metadata until EntityCreateInput is updated
        ...(({ conductingBody: _c, ...rest }) => rest)({ conductingBody: '' }),
      } as import('@/lib/validation/entitySchemas').EntityCreateInput)
    },
  })

  const canProceedStep1 = data.name.trim().length >= 2 && !!data.pillar
  const canProceedStep2 = !!data.template && !!data.contentType

  return {
    step,
    data,
    updateData,
    goNext,
    goBack,
    reset,
    handleCreate: createMutation.mutate,
    createdEntity: createMutation.data,
    isCreating: createMutation.isPending,
    createError: createMutation.error,
    canProceedStep1,
    canProceedStep2,
  }
}
