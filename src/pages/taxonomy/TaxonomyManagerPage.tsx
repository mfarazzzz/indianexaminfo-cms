/**
 * TaxonomyManagerPage.tsx — Manage all descriptive taxonomy tables.
 * Supports: search, create, rename, merge, disable.
 */
import { useState } from 'react'
import { Plus, Edit2, GitMerge, EyeOff, Search, Loader2 } from 'lucide-react'
import { useTaxonomyManager } from '@/hooks/useTaxonomyManager'
import type { TaxonomyBase, TaxonomyTable } from '@/types/taxonomy'
import { cn } from '@/lib/utils'

const TAXONOMY_TYPES: { key: TaxonomyTable; label: string }[] = [
  { key: 'conducting_body',  label: 'Conducting Bodies' },
  { key: 'department',       label: 'Departments' },
  { key: 'tag',              label: 'Tags' },
  { key: 'exam_level',       label: 'Exam Levels' },
  { key: 'exam_mode',        label: 'Exam Modes' },
  { key: 'application_mode', label: 'Application Modes' },
  { key: 'category',         label: 'Categories' },
]

// ── Rename dialog ─────────────────────────────────────────────────────────────
interface RenameDialogProps {
  item: TaxonomyBase
  onSave: (newLabel: string) => void
  onCancel: () => void
}

function RenameDialog({ item, onSave, onCancel }: RenameDialogProps) {
  const [label, setLabel] = useState(item.label)
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-sm space-y-4">
        <h3 className="text-base font-semibold text-gray-900">Rename "{item.label}"</h3>
        <input
          autoFocus
          type="text"
          value={label}
          onChange={e => setLabel(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') onSave(label) }}
          className="w-full text-sm border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <div className="flex gap-2 justify-end">
          <button onClick={onCancel} className="text-sm px-3 py-1.5 rounded ring-1 ring-gray-200 hover:bg-gray-50">Cancel</button>
          <button onClick={() => onSave(label)} disabled={!label.trim() || label === item.label}
            className="text-sm px-3 py-1.5 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50">
            Rename
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Merge dialog ──────────────────────────────────────────────────────────────
interface MergeDialogProps {
  source: TaxonomyBase
  options: TaxonomyBase[]
  onMerge: (targetId: string) => void
  onCancel: () => void
  isMerging: boolean
}

function MergeDialog({ source, options, onMerge, onCancel, isMerging }: MergeDialogProps) {
  const [targetId, setTargetId] = useState('')
  const targets = options.filter(o => o.id !== source.id && o.isActive)
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-sm space-y-4">
        <h3 className="text-base font-semibold text-gray-900">Merge "{source.label}"</h3>
        <p className="text-sm text-gray-500">
          All entities referencing "{source.label}" will be updated to use the target term.
          "{source.label}" will then be removed.
        </p>
        <select
          value={targetId}
          onChange={e => setTargetId(e.target.value)}
          className="w-full text-sm border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Choose target term…</option>
          {targets.map(t => (
            <option key={t.id} value={t.id}>{t.label} ({t.usageCount} uses)</option>
          ))}
        </select>
        <div className="flex gap-2 justify-end">
          <button onClick={onCancel} className="text-sm px-3 py-1.5 rounded ring-1 ring-gray-200 hover:bg-gray-50">Cancel</button>
          <button onClick={() => onMerge(targetId)} disabled={!targetId || isMerging}
            className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-50">
            {isMerging && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Merge
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export function TaxonomyManagerPage() {
  const [activeType, setActiveType] = useState<TaxonomyTable>('conducting_body')
  const [renameTarget, setRenameTarget] = useState<TaxonomyBase | null>(null)
  const [mergeTarget, setMergeTarget] = useState<TaxonomyBase | null>(null)
  const [newLabel, setNewLabel] = useState('')
  const [showCreateInput, setShowCreateInput] = useState(false)

  const {
    items, allItems, isLoading, searchTerm, setSearchTerm,
    create, isCreating, rename, merge, isMerging, disable,
  } = useTaxonomyManager(activeType)

  const activeLabel = TAXONOMY_TYPES.find(t => t.key === activeType)?.label ?? activeType

  return (
    <div className="flex h-full">
      {/* Sidebar */}
      <div className="w-52 shrink-0 border-r bg-white py-4">
        <h2 className="px-4 text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Taxonomy</h2>
        {TAXONOMY_TYPES.map(t => (
          <button
            key={t.key}
            onClick={() => setActiveType(t.key)}
            className={cn(
              'w-full text-left px-4 py-2 text-sm transition-colors',
              activeType === t.key
                ? 'bg-blue-50 text-blue-700 font-medium'
                : 'text-gray-600 hover:bg-gray-50'
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Main area */}
      <div className="flex-1 p-6 overflow-auto">
        <div className="max-w-3xl space-y-4">
          <div className="flex items-center justify-between">
            <h1 className="text-lg font-semibold text-gray-900">{activeLabel}</h1>
            <button
              onClick={() => setShowCreateInput(true)}
              className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded bg-blue-600 text-white hover:bg-blue-700"
            >
              <Plus className="h-4 w-4" />
              New
            </button>
          </div>

          {/* Create input */}
          {showCreateInput && (
            <div className="flex gap-2">
              <input
                autoFocus
                type="text"
                value={newLabel}
                onChange={e => setNewLabel(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && newLabel.trim()) {
                    create({ label: newLabel.trim() }, { onSuccess: () => { setNewLabel(''); setShowCreateInput(false) } })
                  }
                  if (e.key === 'Escape') { setNewLabel(''); setShowCreateInput(false) }
                }}
                placeholder="Enter term name…"
                className="flex-1 text-sm border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                onClick={() => {
                  if (newLabel.trim()) create({ label: newLabel.trim() }, { onSuccess: () => { setNewLabel(''); setShowCreateInput(false) } })
                }}
                disabled={isCreating || !newLabel.trim()}
                className="text-sm px-3 py-1.5 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {isCreating ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Add'}
              </button>
              <button onClick={() => { setNewLabel(''); setShowCreateInput(false) }}
                className="text-sm px-3 py-1.5 rounded ring-1 ring-gray-200 hover:bg-gray-50">
                Cancel
              </button>
            </div>
          )}

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Search…"
              className="w-full pl-9 pr-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Table */}
          {isLoading ? (
            <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-blue-500" /></div>
          ) : (
            <div className="bg-white border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Label</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600 hidden md:table-cell">Slug</th>
                    <th className="text-right px-4 py-3 font-medium text-gray-600 hidden sm:table-cell">Uses</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {items.map(item => (
                    <tr key={item.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-900">{item.label}</td>
                      <td className="px-4 py-3 text-gray-400 text-xs hidden md:table-cell">{item.slug}</td>
                      <td className="px-4 py-3 text-right text-gray-500 hidden sm:table-cell">{item.usageCount}</td>
                      <td className="px-4 py-3">
                        <span className={cn(
                          'text-xs px-1.5 py-0.5 rounded',
                          item.isActive ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'
                        )}>
                          {item.isActive ? 'Active' : 'Disabled'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1 justify-end">
                          <button onClick={() => setRenameTarget(item)} title="Rename"
                            className="p-1.5 text-gray-400 hover:text-blue-600 rounded hover:bg-blue-50">
                            <Edit2 className="h-3.5 w-3.5" />
                          </button>
                          <button onClick={() => setMergeTarget(item)} title="Merge into another term"
                            className="p-1.5 text-gray-400 hover:text-amber-600 rounded hover:bg-amber-50">
                            <GitMerge className="h-3.5 w-3.5" />
                          </button>
                          {item.isActive && (
                            <button onClick={() => disable(item.id)} title="Disable"
                              className="p-1.5 text-gray-400 hover:text-red-600 rounded hover:bg-red-50">
                              <EyeOff className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {items.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-sm text-gray-400">
                        No {activeLabel.toLowerCase()} found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Dialogs */}
      {renameTarget && (
        <RenameDialog
          item={renameTarget}
          onSave={newL => { rename({ id: renameTarget.id, newLabel: newL }); setRenameTarget(null) }}
          onCancel={() => setRenameTarget(null)}
        />
      )}
      {mergeTarget && (
        <MergeDialog
          source={mergeTarget}
          options={allItems}
          onMerge={targetId => merge({ sourceId: mergeTarget.id, targetId }, { onSuccess: () => setMergeTarget(null) })}
          onCancel={() => setMergeTarget(null)}
          isMerging={isMerging}
        />
      )}
    </div>
  )
}
