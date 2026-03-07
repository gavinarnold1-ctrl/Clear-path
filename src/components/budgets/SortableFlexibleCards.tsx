'use client'

import { useState, useCallback, type ReactNode } from 'react'
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
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

interface SortableCardProps {
  id: string
  children: ReactNode
}

function SortableCard({ id, children }: SortableCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : undefined,
    opacity: isDragging ? 0.85 : 1,
    position: 'relative' as const,
  }

  return (
    <div ref={setNodeRef} style={style} className="group/drag border-b border-mist last:border-b-0">
      <div className="flex">
        <button
          {...attributes}
          {...listeners}
          className="flex w-5 shrink-0 cursor-grab items-center justify-center text-mist transition-colors group-hover/drag:text-stone active:cursor-grabbing"
          aria-label="Drag to reorder"
        >
          <svg width="10" height="10" viewBox="0 0 12 12" fill="currentColor">
            <circle cx="4" cy="2" r="1.2" />
            <circle cx="8" cy="2" r="1.2" />
            <circle cx="4" cy="6" r="1.2" />
            <circle cx="8" cy="6" r="1.2" />
            <circle cx="4" cy="10" r="1.2" />
            <circle cx="8" cy="10" r="1.2" />
          </svg>
        </button>
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </div>
  )
}

interface CardItem {
  id: string
  content: ReactNode
}

interface Props {
  items: CardItem[]
  trailing?: ReactNode
}

export default function SortableFlexibleCards({ items, trailing }: Props) {
  const [orderedItems, setOrderedItems] = useState(items)

  // Sync if items change (new budget added/removed)
  if (
    items.length !== orderedItems.length ||
    items.some(item => !orderedItems.find(o => o.id === item.id))
  ) {
    setOrderedItems(items)
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return

    setOrderedItems(prev => {
      const oldIndex = prev.findIndex(item => item.id === active.id)
      const newIndex = prev.findIndex(item => item.id === over.id)
      const reordered = arrayMove(prev, oldIndex, newIndex)

      // Persist new order (fire-and-forget)
      fetch('/api/budgets/reorder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderedIds: reordered.map(item => item.id) }),
      }).catch(() => { /* silently ignore */ })

      return reordered
    })
  }, [])

  const ids = orderedItems.map(item => item.id)

  return (
    <div className="divide-y divide-mist rounded-card border border-mist bg-snow">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={ids} strategy={verticalListSortingStrategy}>
          {orderedItems.map(item => (
            <SortableCard key={item.id} id={item.id}>
              {item.content}
            </SortableCard>
          ))}
        </SortableContext>
      </DndContext>
      {trailing}
    </div>
  )
}
