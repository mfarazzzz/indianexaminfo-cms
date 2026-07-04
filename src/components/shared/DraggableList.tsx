/**
 * DraggableList — Generic drag-and-drop sortable list.
 *
 * Uses @dnd-kit/sortable. Calls onReorder(orderedIds) after every drop.
 * Works with keyboard (dnd-kit default keyboard sensor).
 *
 * Usage:
 *   <DraggableList
 *     items={events}
 *     onReorder={(ids) => reorderTimeline(entityId, ids)}
 *     renderItem={(event, { dragHandleProps, isDragging }) => (
 *       <TimelineRow event={event} dragHandleProps={dragHandleProps} />
 *     )}
 *   />
 */
import React, { useCallback } from 'react'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical } from 'lucide-react'
import { cn } from '@/lib/utils'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface DragHandleProps {
  /** Spread onto the drag-handle element */
  listeners: ReturnType<typeof useSortable>['listeners']
  attributes: ReturnType<typeof useSortable>['attributes']
}

export interface DraggableItemRenderProps {
  dragHandleProps: DragHandleProps
  isDragging: boolean
  index: number
}

export interface DraggableListProps<T extends { id: string }> {
  items: T[]
  /** Called with the new ordered array of IDs after a drag ends */
  onReorder: (orderedIds: string[]) => void
  renderItem: (item: T, props: DraggableItemRenderProps) => React.ReactNode
  /** Extra class applied to the outer list container */
  className?: string
  /** Whether to show the default grip handle to the left of each item */
  showDefaultHandle?: boolean
}

// ── Internal sortable row ─────────────────────────────────────────────────────

function SortableItem<T extends { id: string }>({
  item,
  index,
  renderItem,
  showDefaultHandle,
}: {
  item: T
  index: number
  renderItem: DraggableListProps<T>['renderItem']
  showDefaultHandle: boolean
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id })

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : undefined,
    position: isDragging ? 'relative' : undefined,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'flex items-start gap-2',
        isDragging && 'opacity-60 shadow-lg'
      )}
    >
      {showDefaultHandle && (
        <button
          type="button"
          className="mt-2 cursor-grab touch-none text-slate-300 hover:text-slate-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded"
          aria-label="Drag to reorder"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-4 w-4" />
        </button>
      )}
      <div className="flex-1 min-w-0">
        {renderItem(item, {
          dragHandleProps: { listeners, attributes },
          isDragging,
          index,
        })}
      </div>
    </div>
  )
}

// ── DraggableList ─────────────────────────────────────────────────────────────

export function DraggableList<T extends { id: string }>({
  items,
  onReorder,
  renderItem,
  className,
  showDefaultHandle = true,
}: DraggableListProps<T>) {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 4 }, // prevents accidental drags on click
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event
      if (!over || active.id === over.id) return

      const oldIndex = items.findIndex(i => i.id === active.id)
      const newIndex = items.findIndex(i => i.id === over.id)
      if (oldIndex === -1 || newIndex === -1) return

      const reordered = arrayMove(items, oldIndex, newIndex)
      onReorder(reordered.map(i => i.id))
    },
    [items, onReorder]
  )

  if (items.length === 0) return null

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext
        items={items.map(i => i.id)}
        strategy={verticalListSortingStrategy}
      >
        <div className={cn('space-y-2', className)}>
          {items.map((item, index) => (
            <SortableItem
              key={item.id}
              item={item}
              index={index}
              renderItem={renderItem}
              showDefaultHandle={showDefaultHandle}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  )
}
