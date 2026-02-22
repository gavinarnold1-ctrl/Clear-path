'use client'

import { useState } from 'react'
import { formatCurrency } from '@/lib/utils'

interface InsightCardProps {
  id: string
  category: string
  type: string
  priority: string
  title: string
  description: string
  savingsAmount: number | null
  actionItems: string
  metadata: string | null
  onDismiss: (id: string) => void
  onComplete: (id: string) => void
}

const PRIORITY_STYLES: Record<string, { badge: string; border: string }> = {
  high: { badge: 'bg-red-100 text-red-700', border: 'border-l-red-400' },
  medium: { badge: 'bg-amber-100 text-amber-700', border: 'border-l-amber-400' },
  low: { badge: 'bg-blue-100 text-blue-700', border: 'border-l-blue-400' },
}

const CATEGORY_ICONS: Record<string, string> = {
  spending: '💳',
  debt: '📉',
  savings: '🏦',
  tax: '📋',
  subscription: '🔄',
}

const TYPE_LABELS: Record<string, string> = {
  waste: 'Waste',
  optimization: 'Optimization',
  alert: 'Alert',
  opportunity: 'Opportunity',
}

export default function InsightCard({
  id,
  category,
  type,
  priority,
  title,
  description,
  savingsAmount,
  actionItems,
  metadata,
  onDismiss,
  onComplete,
}: InsightCardProps) {
  const [expanded, setExpanded] = useState(false)
  const [updating, setUpdating] = useState(false)

  const styles = PRIORITY_STYLES[priority] ?? PRIORITY_STYLES.low
  const icon = CATEGORY_ICONS[category] ?? '💡'
  const parsedActions: string[] = (() => {
    try {
      return JSON.parse(actionItems)
    } catch {
      return []
    }
  })()

  const parsedMeta = (() => {
    try {
      return metadata ? JSON.parse(metadata) : null
    } catch {
      return null
    }
  })()

  async function handleStatusChange(status: 'dismissed' | 'completed') {
    setUpdating(true)
    try {
      const res = await fetch(`/api/insights/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      if (res.ok) {
        if (status === 'dismissed') onDismiss(id)
        else onComplete(id)
      }
    } finally {
      setUpdating(false)
    }
  }

  return (
    <div className={`card border-l-4 ${styles.border}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className="text-lg">{icon}</span>
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${styles.badge}`}>
              {priority}
            </span>
            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
              {TYPE_LABELS[type] ?? type}
            </span>
            {parsedMeta?.difficulty && (
              <span className="text-xs text-gray-400">{parsedMeta.difficulty}</span>
            )}
          </div>
          <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
          <p className="mt-1 text-sm text-gray-600">{description}</p>
        </div>

        {savingsAmount != null && savingsAmount > 0 && (
          <div className="shrink-0 text-right">
            <p className="text-lg font-bold text-income">{formatCurrency(savingsAmount)}</p>
            <p className="text-xs text-gray-400">
              /{parsedMeta?.savingsFrequency === 'annual' ? 'yr' : 'mo'}
            </p>
          </div>
        )}
      </div>

      {parsedActions.length > 0 && (
        <div className="mt-3">
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="text-xs font-medium text-brand-600 hover:text-brand-700"
          >
            {expanded ? 'Hide steps' : `${parsedActions.length} action steps`}
          </button>

          {expanded && (
            <ol className="mt-2 space-y-1 pl-5 text-sm text-gray-600">
              {parsedActions.map((step, i) => (
                <li key={i} className="list-decimal">
                  {step}
                </li>
              ))}
            </ol>
          )}
        </div>
      )}

      <div className="mt-3 flex items-center gap-2 border-t border-gray-100 pt-3">
        <button
          type="button"
          onClick={() => handleStatusChange('completed')}
          disabled={updating}
          className="text-xs font-medium text-income hover:text-green-700 disabled:opacity-50"
        >
          Mark complete
        </button>
        <button
          type="button"
          onClick={() => handleStatusChange('dismissed')}
          disabled={updating}
          className="text-xs text-gray-400 hover:text-gray-600 disabled:opacity-50"
        >
          Dismiss
        </button>
      </div>
    </div>
  )
}
