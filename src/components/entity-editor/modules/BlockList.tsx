/**
 * BlockList — Thin DraggableList wrapper for block cards.
 * No business logic. showDefaultHandle={false} — BlockCard owns its drag handle.
 */
import React from 'react'
import { DraggableList, type DragHandleProps } from '@/components/shared/DraggableList'
import type { ModuleBlock } from '@/types/entity'
import { BlockCard } from './BlockCard'

interface BlockListProps {
  blocks: ModuleBlock[]
  onReorder: (orderedIds: string[]) => void
  expandedId: string | null
  onExpand: (id: string) => void
  onCollapse: () => void
  onDelete: (id: string) => void
  onDuplicate: (id: string) => void
  onToggleVisibility: (id: string, isVisible: boolean) => void
  onUpdate: (id: string, content: Record<string, unknown>) => Promise<ModuleBlock>
}

export function BlockList({
  blocks, onReorder, expandedId, onExpand, onCollapse,
  onDelete, onDuplicate, onToggleVisibility, onUpdate,
}: BlockListProps) {
  if (blocks.length === 0) return null
  return (
    <DraggableList
      items={blocks}
      onReorder={onReorder}
      showDefaultHandle={false}
      renderItem={(block, { dragHandleProps, isDragging }) => (
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
          dragHandleProps={dragHandleProps}
          isDragging={isDragging}
        />
      )}
    />
  )
}
