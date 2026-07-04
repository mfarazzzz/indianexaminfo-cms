/**
 * AddBlockMenu — Block type palette.
 *
 * Reads blockRegistry.getAll() — no knowledge of specific block types.
 * Adding a new block type requires zero changes here.
 */
import React from 'react'
import { X } from 'lucide-react'
import { getAll } from '@/lib/blocks/blockRegistry'

interface AddBlockMenuProps {
  onSelect: (blockType: string) => void
  onClose: () => void
}

export function AddBlockMenu({ onSelect, onClose }: AddBlockMenuProps) {
  const defs = getAll()
  return (
    <div className="rounded-lg border border-slate-200 bg-white shadow-md p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">Add Block</h3>
        <button type="button" onClick={onClose} aria-label="Close block palette"
          className="rounded p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {defs.map(def => {
          const Icon = def.icon
          return (
            <button key={def.type} type="button"
              onClick={() => onSelect(def.type)}
              aria-label={`Add ${def.label} block`}
              className="flex items-center gap-2 rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-700 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
              <Icon className="h-4 w-4 shrink-0" />
              <span className="truncate">{def.label}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
