/**
 * EntityCreationPage.tsx — Content creation flow.
 *
 * Simple, fast, predictable. No AI. No technical language.
 * Editor selects: Title → Content Domain → Content Type → Create.
 *
 * The platform automatically:
 * - Resolves the correct lifecycle template from the content type's pillar
 * - Creates the entity with frozen snapshot
 * - Navigates to the Workspace
 *
 * No mention of: Entity, Lifecycle Template, Schema, Snapshot, Internal IDs.
 */
import React, { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { Loader2, ArrowRight } from 'lucide-react'
import { toast } from 'sonner'
import { usePillars } from '@/hooks/usePillars'
import { useContentTypes } from '@/hooks/useContentTypes'
import { useTemplates } from '@/hooks/useTemplates'
import { createEntity } from '@/services/entity/entityService'
import { getActiveTemplateVersion } from '@/services/template/templateService'
import { cn } from '@/lib/utils'

// ── Domain display config (editorial labels, no technical terms) ───────────────

const DOMAIN_ICONS: Record<string, string> = {
  'recruitment':     '💼',
  'entrance-exam':   '📝',
  'board-university':'🎓',
  'news-editorial':  '📰',
}

export function EntityCreationPage() {
  const navigate = useNavigate()
  const { pillar: pillarParam } = useParams<{ pillar?: string }>()

  // ── State ─────────────────────────────────────────────────────────────────
  const [title, setTitle] = useState('')
  const [selectedDomain, setSelectedDomain] = useState<string>(pillarParam ?? '')
  const [selectedContentType, setSelectedContentType] = useState<string>('')

  // ── Data ──────────────────────────────────────────────────────────────────
  const { data: domains = [] } = usePillars()
  const { data: contentTypes = [] } = useContentTypes(
    domains.find(d => d.slug === selectedDomain)?.id
  )
  const { data: templates = [] } = useTemplates(
    domains.find(d => d.slug === selectedDomain)?.id
  )

  // Pre-select domain from URL param
  useEffect(() => {
    if (pillarParam && domains.length > 0) {
      setSelectedDomain(pillarParam)
    }
  }, [pillarParam, domains])

  // Reset content type when domain changes
  useEffect(() => {
    setSelectedContentType('')
  }, [selectedDomain])

  // ── Create mutation ───────────────────────────────────────────────────────
  const createMutation = useMutation({
    mutationFn: async () => {
      if (!title.trim()) throw new Error('Please enter a title')
      if (!selectedDomain) throw new Error('Please select a content domain')

      // Automatically resolve the lifecycle template for this domain
      // Use the first active template for the selected pillar
      const template = templates[0]
      if (!template) throw new Error('No content configuration available for this domain. Please contact an administrator.')

      // Get the active version of this template
      const version = await getActiveTemplateVersion(template.id)
      if (!version) throw new Error('Content configuration not ready. Please contact an administrator.')

      // Create the entity — platform handles slug, snapshot, SEO skeleton
      return createEntity({
        name:              title.trim(),
        slug:              '', // auto-generated from title
        pillar:            selectedDomain,
        contentTypeId:     selectedContentType || undefined,
        templateVersionId: version.id,
        workflowStatus:    'draft',
        isFeatured:        false,
        tags:              [],
        searchKeywords:    [],
        lang:              'en',
        metadata:          {},
      })
    },
    onSuccess: (entity) => {
      toast.success('Content created')
      navigate(`/entities/${entity.pillar}/${entity.id}`)
    },
    onError: (err: Error) => {
      toast.error(err.message)
    },
  })

  // ── Derived state ─────────────────────────────────────────────────────────
  const canCreate = title.trim().length >= 2 && !!selectedDomain
  const selectedDomainLabel = domains.find(d => d.slug === selectedDomain)?.label ?? ''

  return (
    <div className="max-w-xl mx-auto px-6 py-12">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Create New Content</h1>
        <p className="text-sm text-slate-500 mt-1">
          Start writing. The platform handles everything else.
        </p>
      </div>

      <div className="space-y-6">

        {/* ── Title ────────────────────────────────────────────────────────── */}
        <div>
          <label htmlFor="content-title" className="block text-sm font-medium text-slate-700 mb-1.5">
            What are you writing about?
          </label>
          <input
            id="content-title"
            type="text"
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="e.g. SSC CGL Recruitment 2026"
            className="w-full border border-slate-200 rounded-lg px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            autoFocus
            maxLength={200}
          />
          {title.length > 0 && (
            <p className="text-xs text-slate-400 mt-1 text-right">{title.length}/200</p>
          )}
        </div>

        {/* ── Content Domain ───────────────────────────────────────────────── */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">
            Content Domain
          </label>
          <div className="grid grid-cols-2 gap-2">
            {domains.map(domain => (
              <button
                key={domain.slug}
                type="button"
                onClick={() => setSelectedDomain(domain.slug)}
                className={cn(
                  'flex items-center gap-3 p-3 rounded-lg border-2 text-left transition-all',
                  selectedDomain === domain.slug
                    ? 'border-blue-500 bg-blue-50 shadow-sm'
                    : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                )}
              >
                <span className="text-xl" aria-hidden="true">
                  {DOMAIN_ICONS[domain.slug] ?? '📄'}
                </span>
                <div>
                  <p className={cn(
                    'text-sm font-medium',
                    selectedDomain === domain.slug ? 'text-blue-700' : 'text-slate-700'
                  )}>
                    {domain.label}
                  </p>
                  {domain.description && (
                    <p className="text-xs text-slate-400 mt-0.5 line-clamp-1">
                      {domain.description}
                    </p>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* ── Content Type (optional refinement) ───────────────────────────── */}
        {selectedDomain && contentTypes.length > 0 && (
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Content Type <span className="text-slate-400 font-normal">(optional)</span>
            </label>
            <div className="flex flex-wrap gap-2">
              {contentTypes.map(ct => (
                <button
                  key={ct.id}
                  type="button"
                  onClick={() => setSelectedContentType(
                    selectedContentType === ct.id ? '' : ct.id
                  )}
                  className={cn(
                    'px-3 py-1.5 rounded-full text-sm border transition-all',
                    selectedContentType === ct.id
                      ? 'border-blue-500 bg-blue-50 text-blue-700 font-medium'
                      : 'border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                  )}
                >
                  {ct.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── Create Button ────────────────────────────────────────────────── */}
        <div className="pt-4 border-t">
          <button
            type="button"
            onClick={() => createMutation.mutate()}
            disabled={!canCreate || createMutation.isPending}
            className={cn(
              'w-full flex items-center justify-center gap-2 px-6 py-3 rounded-lg text-sm font-medium transition-all',
              canCreate
                ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-sm'
                : 'bg-slate-100 text-slate-400 cursor-not-allowed'
            )}
          >
            {createMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Creating...
              </>
            ) : (
              <>
                Create {selectedDomainLabel || 'Content'}
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </button>

          {createMutation.isError && (
            <p className="text-sm text-red-600 mt-2 text-center" role="alert">
              {(createMutation.error as Error).message}
            </p>
          )}
        </div>

        {/* ── Cancel ───────────────────────────────────────────────────────── */}
        <div className="text-center">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="text-sm text-slate-500 hover:text-slate-700"
          >
            ← Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
