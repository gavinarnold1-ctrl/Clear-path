'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import GoalRecalibrationBanner from './GoalRecalibrationBanner'
import type { RecalibrationSuggestion } from '@/lib/goal-recalibration'

interface Props {
  suggestion: RecalibrationSuggestion
}

export default function RecalibrationWrapper({ suggestion }: Props) {
  const [dismissed, setDismissed] = useState(false)
  const router = useRouter()

  if (dismissed) return null

  return (
    <GoalRecalibrationBanner
      suggestion={suggestion}
      onAccept={async (type) => {
        await fetch('/api/profile/goal-target', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...(type === 'extend' ? { targetDate: suggestion.newTargetDate } : {}),
            ...(type === 'increase' ? { monthlyNeeded: suggestion.newMonthlyNeeded } : {}),
          }),
        })
        router.refresh()
      }}
      onDismiss={() => {
        setDismissed(true)
        const action = suggestion.type === 'celebrate_completion' ? 'celebrate'
          : suggestion.type === 'reduce_target' ? 'reduce_target'
          : suggestion.type
        fetch('/api/ai/context', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'recalibration_dismissed', action }),
        }).catch(() => {})
      }}
    />
  )
}
