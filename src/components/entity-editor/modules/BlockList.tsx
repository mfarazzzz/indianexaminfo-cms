/**
 * BlockList — plain list of block cards.
 * Drag-to-reorder was removed: block reorder wrote entity_module_block.display_order,
 * part of System B which the frontend never reads (CONSISTENCY_AUDIT Phase 1 Q2).
 * The reorderBlocks service and column remain parked.
 */
import React from 'react'
import type { ModuleBlock } from '@/types/entity'
import { BlockCard } from './BlockCard'

interface BlockListProps {
  blocks: ModuleBlock[]
  expandedId: string | null
  onExpand: (id: string) => void
  onCollapse: () => void
  onDelete: (id: string) => void
  onDuplicate: (id: string) => void
  onToggleVisibility: (id: string, isVisible: boolean) => void
  onUpdate: (id: string, content: Record<string, unknown>) => Promise<ModuleBlock>
}

export function BlockList({
  blocks, expandedId, onExpand, onCollapse,
  onDelete, onDuplicate, onToggleVisibility, onUpdate,
}: BlockListProps) {
  if (blocks.length === 0) return null
  return (
    <div className="space-y-2">
      {blocks.map((block) => (
        <BlockCard
          key={block.id}
          block={block}
          isExpanded={expandedId === block.id}
          onExpand={() => onExpand(block.id)}
          onCollapse={onCollapse}
          onDelete={() => onDelete(block.id)}
          onDuplicate={() => onDuplicate(block.id)}
          onToggleVisibility={(v) => onToggleVisibility(block.id, v)}
          onUpdate={(content) => onUpdate(block.id, content)}
        />
      ))}
    </div>
  )
}
