/**
 * TaxonomySelect.tsx — Shared dropdown for descriptive taxonomy fields.
 * Includes "Other / Create new…" inline creation flow.
 * New terms are instantly available across all dropdowns (cache invalidation).
 */
import { useState, useRef, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ChevronDown, Check, Plus, Loader2 } from 'lucide-react'
import { taxonomyKeys } from '@/lib/queryKeys'
import { listTaxonomy, createTaxonomy } from '@/services/taxonomy/taxonomyService'
import type { TaxonomyBase, TaxonomyTable } from '@/types/taxonomy'
import { cn } from '@/lib/utils'

interface TaxonomySelectProps {
  /** The taxonomy table to query */
  type: TaxonomyTable
  /** Current selected id (null = no selection) */
  value: string | null | undefined
  onChange: (id: string | null) => void
  placeholder?: string
  allowCreate?: boolean
  disabled?: boolean
  className?: string
}

export function TaxonomySelect({
  type,
  value,
  onChange,
  placeholder = 'Select…',
  allowCreate = false,
  disabled = false,
  className,
}: TaxonomySelectProps) {
  const qc = useQueryClient()
  const queryKey = taxonomyKeys.list(type)
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [showCreateInput, setShowCreateInput] = useState(false)
  const [newLabel, setNewLabel] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)

  const { data: options = [] } = useQuery({
    queryKey,
    queryFn: () => listTaxonomy<TaxonomyBase>(type),
    staleTime: 5 * 60_000,
  })

  const createMutation = useMutation({
    mutationFn: (label: string) =>
      createTaxonomy<TaxonomyBase>(type, { label, createdVia: 'inline_create' }),
    onSuccess: (created) => {
      qc.invalidateQueries({ queryKey })
      onChange(created.id)
      setOpen(false)
      setShowCreateInput(false)
      setNewLabel('')
    },
    onError: (err: Error) => {
      // If already exists (thrown from service), try to find and select it
      const existing = options.find(
        o => o.label.toLowerCase() === newLabel.toLowerCase()
      )
      if (existing) {
        onChange(existing.id)
        setOpen(false)
        setShowCreateInput(false)
        setNewLabel('')
      } else {
        alert(err.message)
      }
    },
  })

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
        setShowCreateInput(false)
        setNewLabel('')
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const activeOptions = options.filter(o => o.isActive)
  const filtered = search.trim()
    ? activeOptions.filter(o => o.label.toLowerCase().includes(search.toLowerCase()))
    : activeOptions

  const selected = options.find(o => o.id === value)

  const handleConfirmCreate = () => {
    if (!newLabel.trim()) return
    createMutation.mutate(newLabel.trim())
  }

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      {/* Trigger button */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(o => !o)}
        className={cn(
          'w-full flex items-center justify-between gap-2 px-3 py-2 text-sm border rounded-md bg-white',
          'focus:outline-none focus:ring-2 focus:ring-blue-500',
          disabled && 'opacity-50 cursor-not-allowed',
          !disabled && 'hover:border-gray-400'
        )}
      >
        <span className={selected ? 'text-gray-900' : 'text-gray-400'}>
          {selected?.label ?? placeholder}
        </span>
        <ChevronDown className="h-4 w-4 text-gray-400 shrink-0" />
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute z-50 mt-1 w-full bg-white border rounded-md shadow-lg max-h-64 overflow-auto">
          {/* Search */}
          <div className="p-2 border-b">
            <input
              autoFocus
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search…"
              className="w-full text-sm px-2 py-1 border rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {/* Clear selection */}
          {value && (
            <button
              type="button"
              onClick={() => { onChange(null); setOpen(false) }}
              className="w-full text-left px-3 py-2 text-sm text-gray-400 hover:bg-gray-50"
            >
              — Clear selection
            </button>
          )}

          {/* Options */}
          {filtered.map(opt => (
            <button
              key={opt.id}
              type="button"
              onClick={() => { onChange(opt.id); setOpen(false); setSearch('') }}
              className="w-full text-left flex items-center gap-2 px-3 py-2 text-sm hover:bg-blue-50"
            >
              <span className="flex-1">{opt.label}</span>
              {opt.id === value && <Check className="h-4 w-4 text-blue-600 shrink-0" />}
            </button>
          ))}

          {filtered.length === 0 && (
            <div className="px-3 py-2 text-sm text-gray-400">No results</div>
          )}

          {/* Other → Create New */}
          {allowCreate && !showCreateInput && (
            <button
              type="button"
              onClick={() => setShowCreateInput(true)}
              className="w-full text-left flex items-center gap-2 px-3 py-2 text-sm text-blue-600 hover:bg-blue-50 border-t"
            >
              <Plus className="h-4 w-4" />
              Other / Create new…
            </button>
          )}

          {/* Inline create input */}
          {allowCreate && showCreateInput && (
            <div className="p-2 border-t space-y-2">
              <input
                autoFocus
                type="text"
                value={newLabel}
                onChange={e => setNewLabel(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleConfirmCreate() } }}
                placeholder="Enter new term name…"
                className="w-full text-sm px-2 py-1 border rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleConfirmCreate}
                  disabled={createMutation.isPending || !newLabel.trim()}
                  className="flex items-center gap-1 text-xs px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                >
                  {createMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
                  Add
                </button>
                <button
                  type="button"
                  onClick={() => { setShowCreateInput(false); setNewLabel('') }}
                  className="text-xs px-2 py-1 text-gray-500 hover:bg-gray-100 rounded"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
