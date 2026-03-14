'use client'

import { useState } from 'react'
import type { RecalibrationSuggestion } from '@/lib/goal-recalibration'
import { formatCurrency } from '@/lib/utils'

interface Props {
  suggestion: RecalibrationSuggestion
  onAccept: (type: 'extend' | 'increase') => Promise<void>
  onDismiss: () => void
}

function formatMonth(date: Date): string {
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}

export default function GoalRecalibrationBanner({ suggestion, onAccept, onDismiss }: Props) {
  const [loading, setLoading] = useState(false)

  if (suggestion.type === 'defer_acceleration') {
    return (
      <div className="card mb-6 border-pine/30 bg-pine/5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <h3 className="font-display text-lg font-semibold text-pine">{suggestion.title}</h3>
            <p className="mt-1 text-sm text-fjord/80">{suggestion.description}</p>
            {suggestion.phasedContributions && suggestion.phasedContributions.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-3">
                {suggestion.phasedContributions.map((phase, i) => (
                  <div key={i} className="rounded-badge border border-pine/20 bg-snow px-3 py-1.5">
                    <p className="text-xs font-medium text-fjord">{phase.label}</p>
                    <p className="font-mono text-sm font-semibold text-pine">
                      {formatCurrency(phase.monthlyAmount)}/mo
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
          <button
            onClick={onDismiss}
            className="text-sm text-stone hover:text-fjord"
          >
            Dismiss
          </button>
        </div>
      </div>
    )
  }

  if (suggestion.type === 'celebrate_completion') {
    return (
      <div className="card mb-6 border-pine/30 bg-pine/5">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="font-display text-lg font-semibold text-pine">{suggestion.title}</h3>
            <p className="mt-1 text-sm text-fjord">{suggestion.description}</p>
          </div>
          <a href="/settings" className="btn-primary text-sm">Set New Goal</a>
        </div>
      </div>
    )
  }

  return (
    <div className="card mb-6 border-ember/20 bg-ember/5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <h3 className="font-display text-lg font-semibold text-fjord">{suggestion.title}</h3>
          <p className="mt-1 text-sm text-fjord/80">{suggestion.description}</p>

          <div className="mt-4 flex flex-wrap gap-3">
            {suggestion.newTargetDate && (
              <button
                onClick={async () => { setLoading(true); await onAccept('extend'); setLoading(false) }}
                className="btn-primary text-sm"
                disabled={loading}
              >
                Extend to {formatMonth(new Date(suggestion.newTargetDate))}
              </button>
            )}
            {suggestion.newMonthlyNeeded && (
              <button
                onClick={async () => { setLoading(true); await onAccept('increase'); setLoading(false) }}
                className="btn-secondary text-sm"
                disabled={loading}
              >
                Increase to {formatCurrency(suggestion.newMonthlyNeeded)}/month
              </button>
            )}
            <button
              onClick={onDismiss}
              className="text-sm text-stone hover:text-fjord"
            >
              Dismiss for now
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
