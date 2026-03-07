'use client'

import { useState } from 'react'
import { formatCurrency } from '@/lib/utils'
import { trackInsightDismissed, trackInsightCompleted } from '@/lib/analytics'

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
  high: { badge: 'bg-ember/10 text-ember', border: 'border-l-ember' },
  medium: { badge: 'bg-birch/20 text-birch', border: 'border-l-birch' },
  low: { badge: 'bg-frost text-fjord', border: 'border-l-fjord' },
}

const CATEGORY_ICONS: Record<string, string> = {
  spending: '\uD83D\uDCB3',
  debt: '\uD83D\uDCC9',
  savings: '\uD83C\uDFE6',
  tax: '\uD83D\uDCCB',
  subscription: '\uD83D\uDD04',
}

const TYPE_LABELS: Record<string, string> = {
  waste: 'Waste',
  optimization: 'Optimization',
  alert: 'Alert',
  opportunity: 'Opportunity',
}

const DISMISS_REASONS = [
  { value: 'not_relevant', label: 'Not relevant to me' },
  { value: 'already_doing', label: 'Already doing this' },
  { value: 'too_hard', label: 'Too difficult to implement' },
  { value: 'disagree', label: 'I disagree with this' },
  { value: 'other', label: 'Other reason' },
]

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
  const [showDismissOptions, setShowDismissOptions] = useState(false)
  const [showCompleteForm, setShowCompleteForm] = useState(false)
  const [completionNotes, setCompletionNotes] = useState('')

  const styles = PRIORITY_STYLES[priority] ?? PRIORITY_STYLES.low
  const icon = CATEGORY_ICONS[category] ?? '\uD83D\uDCA1'
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

  async function handleDismiss(reason: string) {
    setUpdating(true)
    try {
      const res = await fetch(`/api/insights/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'dismissed', dismissReason: reason }),
      })
      if (res.ok) {
        trackInsightDismissed(type, reason)
        onDismiss(id)
      }
    } finally {
      setUpdating(false)
      setShowDismissOptions(false)
    }
  }

  async function handleComplete() {
    setUpdating(true)
    try {
      const res = await fetch(`/api/insights/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'completed',
          completionNotes: completionNotes.trim() || undefined,
        }),
      })
      if (res.ok) {
        trackInsightCompleted(type, category, savingsAmount ?? 0)
        onComplete(id)
      }
    } finally {
      setUpdating(false)
      setShowCompleteForm(false)
      setCompletionNotes('')
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
            <span className="rounded-full bg-mist px-2 py-0.5 text-xs font-medium text-stone">
              {TYPE_LABELS[type] ?? type}
            </span>
            {parsedMeta?.difficulty && (
              <span className="text-xs text-stone">{parsedMeta.difficulty}</span>
            )}
          </div>
          <h3 className="text-sm font-semibold text-fjord">{title}</h3>
          <p className="mt-1 text-sm text-stone">{description}</p>
        </div>

        {savingsAmount != null && savingsAmount > 0 && (
          <div className="shrink-0 text-right">
            <p className="text-lg font-bold text-income">{formatCurrency(savingsAmount)}</p>
            <p className="text-xs text-stone">
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
            className="text-xs font-medium text-fjord hover:text-midnight"
          >
            {expanded ? 'Hide steps' : `${parsedActions.length} action steps`}
          </button>

          {expanded && (
            <ol className="mt-2 space-y-1 pl-5 text-sm text-stone">
              {parsedActions.map((step, i) => (
                <li key={i} className="list-decimal">
                  {step}
                </li>
              ))}
            </ol>
          )}
        </div>
      )}

      {/* Dismiss reason picker */}
      {showDismissOptions && (
        <div className="mt-3 rounded-lg bg-snow p-3">
          <p className="mb-2 text-xs font-medium text-stone">Why are you dismissing this?</p>
          <div className="flex flex-wrap gap-1.5">
            {DISMISS_REASONS.map((reason) => (
              <button
                key={reason.value}
                type="button"
                onClick={() => handleDismiss(reason.value)}
                disabled={updating}
                className="rounded-full border border-mist bg-frost px-2.5 py-1 text-xs text-stone hover:border-mist hover:bg-snow disabled:opacity-50"
              >
                {reason.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setShowDismissOptions(false)}
            className="mt-2 text-xs text-stone hover:text-stone"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Completion notes form */}
      {showCompleteForm && (
        <div className="mt-3 rounded-lg bg-pine/10 p-3">
          <p className="mb-2 text-xs font-medium text-pine">
            What did you do? (optional)
          </p>
          <textarea
            className="input w-full text-sm"
            rows={2}
            placeholder="e.g. Cancelled Netflix, switched to annual plan..."
            value={completionNotes}
            onChange={(e) => setCompletionNotes(e.target.value)}
          />
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={handleComplete}
              disabled={updating}
              className="rounded-md bg-pine px-3 py-1 text-xs font-medium text-snow hover:bg-pine/80 disabled:opacity-50"
            >
              {updating ? 'Saving...' : 'Complete'}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowCompleteForm(false)
                setCompletionNotes('')
              }}
              className="text-xs text-stone hover:text-stone"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Action buttons */}
      {!showDismissOptions && !showCompleteForm && (
        <div className="mt-3 flex items-center gap-2 border-t border-mist pt-3">
          <button
            type="button"
            onClick={() => setShowCompleteForm(true)}
            disabled={updating}
            className="text-xs font-medium text-income hover:text-pine disabled:opacity-50"
          >
            Mark complete
          </button>
          <button
            type="button"
            onClick={() => setShowDismissOptions(true)}
            disabled={updating}
            className="text-xs text-stone hover:text-stone disabled:opacity-50"
          >
            Dismiss
          </button>
        </div>
      )}
    </div>
  )
}
