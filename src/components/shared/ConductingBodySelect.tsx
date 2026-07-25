/**
 * ConductingBodySelect — Searchable dropdown for the conducting_body lookup table.
 * Displays short_name where available, name as fallback.
 * Includes "Add new" option for admin/editor roles. (Req 15.6, 15.7)
 */
import React, { useState, useMemo, useRef, useEffect } from 'react'
import { ChevronDown, Plus, Search, Check } from 'lucide-react'
import { useConductingBodies } from '@/hooks/useConductingBodies'
import { createConductingBody } from '@/services/entity/conductingBodyService'
import { generateSlug } from '@/lib/validation/entitySchemas'
import { useQueryClient } from '@tanstack/react-query'
import { conductingBodyKeys } from '@/lib/queryKeys'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface ConductingBodySelectProps {
  value: string | null
  onChange: (id: string | null) => void
  disabled?: boolean
}

export function ConductingBodySelect({ value, onChange, disabled }: ConductingBodySelectProps) {
  const { data: bodies = [], isLoading } = useConductingBodies()
  const qc = useQueryClient()
  const [isOpen, setIsOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
        setIsCreating(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const filtered = useMemo(() => {
    if (!search) return bodies
    const q = search.toLowerCase()
    return bodies.filter(b =>
      b.name.toLowerCase().includes(q) ||
      (b.shortName?.toLowerCase().includes(q) ?? false)
    )
  }, [bodies, search])

  const selectedBody = bodies.find(b => b.id === value)
  const displayText = selectedBody
    ? (selectedBody.shortName ?? selectedBody.name)
    : ''

  const handleCreate = async () => {
    if (!newName.trim()) return
    try {
      const created = await createConductingBody({
        name: newName.trim(),
        slug: generateSlug(newName.trim()),
      })
      qc.invalidateQueries({ queryKey: conductingBodyKeys.list() })
      onChange(created.id)
      setIsCreating(false)
      setNewName('')
      setIsOpen(false)
      toast.success(`Created "${created.name}"`)
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to create')
    }
  }

  return (
    <div className="relative" ref={containerRef}>
      {/* Trigger */}
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(o => !o)}
        disabled={disabled}
        className={cn(
          'flex h-9 w-full items-center justify-between rounded-md border border-slate-200',
          'bg-white px-3 text-sm text-slate-900',
          'focus:outline-none focus:ring-2 focus:ring-blue-500',
          disabled && 'cursor-not-allowed opacity-50'
        )}
      >
        <span className={selectedBody ? 'text-slate-900' : 'text-slate-400'}>
          {isLoading ? 'Loading…' : (displayText || 'Select conducting body…')}
        </span>
        <ChevronDown className="h-4 w-4 text-slate-400" />
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute z-50 mt-1 w-full rounded-md border border-slate-200 bg-white shadow-lg">
          {/* Search */}
          <div className="flex items-center gap-2 border-b border-slate-100 px-3 py-2">
            <Search className="h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search…"
              className="flex-1 text-sm outline-none placeholder:text-slate-400"
              autoFocus
            />
          </div>

          {/* Options — grouped by hierarchy: parents first, children indented */}
          <div className="max-h-48 overflow-y-auto p-1">
            {/* Clear option */}
            {value && (
              <button
                type="button"
                onClick={() => { onChange(null); setIsOpen(false) }}
                className="w-full rounded px-3 py-2 text-left text-sm text-slate-400 hover:bg-slate-50"
              >
                Clear selection
              </button>
            )}

            {/* Parents (no parent_id) — fully selectable as conducting bodies */}
            {filtered.filter(b => !b.parentId).map(parent => (
              <React.Fragment key={parent.id}>
                <button
                  type="button"
                  onClick={() => { onChange(parent.id); setIsOpen(false); setSearch('') }}
                  className={cn(
                    'flex w-full items-center gap-2 rounded px-3 py-2 text-left text-sm hover:bg-blue-50',
                    value === parent.id && 'text-blue-700 bg-blue-50'
                  )}
                >
                  <span className="flex-1 font-medium">
                    {parent.shortName && <span>{parent.shortName} — </span>}
                    {parent.name}
                  </span>
                  {value === parent.id && <Check className="h-3.5 w-3.5 text-blue-600" />}
                </button>
                {/* Children of this parent — indented, equally selectable */}
                {filtered.filter(c => c.parentId === parent.id).map(child => (
                  <button
                    key={child.id}
                    type="button"
                    onClick={() => { onChange(child.id); setIsOpen(false); setSearch('') }}
                    className={cn(
                      'flex w-full items-center gap-2 rounded pl-7 pr-3 py-1.5 text-left text-sm hover:bg-blue-50',
                      value === child.id && 'text-blue-700 bg-blue-50'
                    )}
                  >
                    <span className="flex-1 text-slate-600">
                      {child.shortName && <span className="font-medium">{child.shortName} — </span>}
                      {child.name}
                    </span>
                    {value === child.id && <Check className="h-3.5 w-3.5 text-blue-600" />}
                  </button>
                ))}
              </React.Fragment>
            ))}

            {/* Orphan children (parentId set but parent not in filtered list — show flat) */}
            {filtered.filter(b => b.parentId && !filtered.some(p => p.id === b.parentId && !p.parentId)).map(body => (
              <button
                key={body.id}
                type="button"
                onClick={() => { onChange(body.id); setIsOpen(false); setSearch('') }}
                className={cn(
                  'flex w-full items-center gap-2 rounded px-3 py-2 text-left text-sm hover:bg-blue-50',
                  value === body.id && 'text-blue-700 bg-blue-50'
                )}
              >
                <span className="flex-1">
                  {body.shortName && <span className="font-medium">{body.shortName} — </span>}
                  {body.name}
                </span>
                {value === body.id && <Check className="h-3.5 w-3.5 text-blue-600" />}
              </button>
            ))}

            {filtered.length === 0 && !isCreating && (
              <p className="px-3 py-2 text-sm text-slate-400">No matches</p>
            )}
          </div>

          {/* Add new */}
          <div className="border-t border-slate-100 p-2">
            {isCreating ? (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  placeholder="Full name (e.g. Union Public Service Commission)"
                  className="flex-1 rounded border border-slate-200 px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                  autoFocus
                  onKeyDown={e => { if (e.key === 'Enter') handleCreate() }}
                />
                <button type="button" onClick={handleCreate}
                  className="rounded bg-blue-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-blue-700">
                  Add
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setIsCreating(true)}
                className="flex w-full items-center gap-2 rounded px-3 py-2 text-sm text-blue-600 hover:bg-blue-50"
              >
                <Plus className="h-3.5 w-3.5" />
                Add new conducting body
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
