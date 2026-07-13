/**
 * EntityCreationPage.tsx — 3-step entity creation wizard.
 * On success, navigates to the new entity's editor.
 */
import { useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Loader2, ChevronRight, ChevronLeft, Check } from 'lucide-react'
import { useEntityCreationWizard } from '@/hooks/useEntityCreationWizard'
import { useTemplates } from '@/hooks/useTemplates'
import { useContentTypes } from '@/hooks/useContentTypes'
import { usePillars } from '@/hooks/usePillars'
import { cn } from '@/lib/utils'

export function EntityCreationPage() {
  const { pillar: pillarParam } = useParams<{ pillar?: string }>()
  const navigate = useNavigate()

  const {
    step, data, updateData, goNext, goBack,
    handleCreate, createdEntity, isCreating, createError,
    canProceedStep1, canProceedStep2,
  } = useEntityCreationWizard()

  const { data: pillars = [] } = usePillars()
  const { data: templates = [] } = useTemplates(data.pillar?.id)
  const { data: contentTypes = [] } = useContentTypes(data.pillar?.id)

  // Pre-select pillar from URL param
  useEffect(() => {
    if (pillarParam && pillars.length > 0 && !data.pillar) {
      const found = pillars.find(p => p.slug === pillarParam)
      if (found) updateData({ pillar: found })
    }
  }, [pillarParam, pillars, data.pillar, updateData])

  // Navigate on successful creation
  useEffect(() => {
    if (createdEntity) {
      navigate(`/entities/${createdEntity.pillar}/${createdEntity.id}`)
    }
  }, [createdEntity, navigate])

  return (
    <div className="max-w-2xl mx-auto p-6">
      {/* Step indicator */}
      <div className="flex items-center gap-2 mb-8">
        {[1, 2, 3].map(n => (
          <div key={n} className="flex items-center gap-2">
            <div className={cn(
              'h-8 w-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors',
              step === n ? 'bg-blue-600 text-white' :
              step > n  ? 'bg-green-500 text-white' :
              'bg-gray-200 text-gray-500'
            )}>
              {step > n ? <Check className="h-4 w-4" /> : n}
            </div>
            {n < 3 && <div className={cn('h-0.5 w-12', step > n ? 'bg-green-500' : 'bg-gray-200')} />}
          </div>
        ))}
        <span className="ml-3 text-sm text-gray-500">
          {step === 1 ? 'Basic Info' : step === 2 ? 'Choose Template' : 'Review & Create'}
        </span>
      </div>

      {/* Step 1 — Name + Pillar */}
      {step === 1 && (
        <div className="space-y-5">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-1">Name your entity</h2>
            <p className="text-sm text-gray-500">Use the full official name, including the year.</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Entity Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={data.name}
              onChange={e => updateData({ name: e.target.value })}
              placeholder="e.g. SSC CGL Recruitment 2026"
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoFocus
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Pillar <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-2 gap-3">
              {pillars.map(p => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => updateData({ pillar: p, template: null, contentType: null })}
                  className={cn(
                    'text-left p-3 rounded-lg border-2 text-sm transition-colors',
                    data.pillar?.id === p.id
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-gray-200 hover:border-gray-300'
                  )}
                >
                  <div className="font-medium">{p.label}</div>
                  {p.description && <div className="text-xs text-gray-400 mt-0.5 truncate">{p.description}</div>}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Step 2 — Template + Content Type */}
      {step === 2 && (
        <div className="space-y-5">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-1">Choose template & type</h2>
            <p className="text-sm text-gray-500">The template determines which modules and fields are available.</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Lifecycle Template</label>
            <div className="grid grid-cols-2 gap-3">
              {templates.map(t => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => updateData({ template: t })}
                  className={cn(
                    'text-left p-3 rounded-lg border-2 text-sm transition-colors',
                    data.template?.id === t.id
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-gray-200 hover:border-gray-300'
                  )}
                >
                  <div className="font-medium">{t.name}</div>
                  {t.description && <div className="text-xs text-gray-400 mt-0.5 truncate">{t.description}</div>}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Content Type</label>
            <div className="grid grid-cols-3 gap-2">
              {contentTypes.map(ct => (
                <button
                  key={ct.id}
                  type="button"
                  onClick={() => updateData({ contentType: ct })}
                  className={cn(
                    'text-left p-2.5 rounded-lg border-2 text-xs transition-colors',
                    data.contentType?.id === ct.id
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-gray-200 hover:border-gray-300'
                  )}
                >
                  {ct.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Step 3 — Review */}
      {step === 3 && (
        <div className="space-y-5">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-1">Review & Create</h2>
            <p className="text-sm text-gray-500">Confirm details before creating the entity.</p>
          </div>
          <dl className="bg-gray-50 rounded-lg p-4 space-y-3 text-sm">
            <div className="flex gap-4">
              <dt className="font-medium text-gray-600 w-32 shrink-0">Name</dt>
              <dd className="text-gray-900">{data.name}</dd>
            </div>
            <div className="flex gap-4">
              <dt className="font-medium text-gray-600 w-32 shrink-0">Pillar</dt>
              <dd className="text-gray-900">{data.pillar?.label}</dd>
            </div>
            <div className="flex gap-4">
              <dt className="font-medium text-gray-600 w-32 shrink-0">Template</dt>
              <dd className="text-gray-900">{data.template?.name}</dd>
            </div>
            <div className="flex gap-4">
              <dt className="font-medium text-gray-600 w-32 shrink-0">Content Type</dt>
              <dd className="text-gray-900">{data.contentType?.label}</dd>
            </div>
            <div className="flex gap-4">
              <dt className="font-medium text-gray-600 w-32 shrink-0">Layout</dt>
              <dd className="text-gray-500 text-xs">{data.template?.frontendLayout}</dd>
            </div>
            <div className="flex gap-4">
              <dt className="font-medium text-gray-600 w-32 shrink-0">Schema.org</dt>
              <dd className="text-gray-500 text-xs">{data.template?.defaultSchemaOrgType}</dd>
            </div>
          </dl>

          {createError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded text-sm text-red-600">
              {(createError as Error).message}
            </div>
          )}
        </div>
      )}

      {/* Navigation buttons */}
      <div className="flex items-center justify-between mt-8 pt-6 border-t">
        <button
          type="button"
          onClick={step === 1 ? () => navigate(-1) : goBack}
          className="flex items-center gap-1.5 text-sm px-4 py-2 rounded ring-1 ring-gray-200 hover:bg-gray-50"
        >
          <ChevronLeft className="h-4 w-4" />
          {step === 1 ? 'Cancel' : 'Back'}
        </button>

        {step < 3 ? (
          <button
            type="button"
            onClick={goNext}
            disabled={(step === 1 && !canProceedStep1) || (step === 2 && !canProceedStep2)}
            className="flex items-center gap-1.5 text-sm px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40"
          >
            Next
            <ChevronRight className="h-4 w-4" />
          </button>
        ) : (
          <button
            type="button"
            onClick={() => handleCreate()}
            disabled={isCreating}
            className="flex items-center gap-1.5 text-sm px-5 py-2 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40"
          >
            {isCreating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            {isCreating ? 'Creating…' : 'Create Entity'}
          </button>
        )}
      </div>
    </div>
  )
}
