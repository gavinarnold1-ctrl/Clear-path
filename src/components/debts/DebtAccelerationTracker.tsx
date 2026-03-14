'use client'

import { useEffect } from 'react'
import { trackDebtAccelerationViewed } from '@/lib/analytics'

export function DebtAccelerationTracker({ debtCount, monthsSaved, interestSaved }: {
  debtCount: number
  monthsSaved: number
  interestSaved: number
}) {
  useEffect(() => {
    trackDebtAccelerationViewed(debtCount, monthsSaved, interestSaved)
  }, [debtCount, monthsSaved, interestSaved])
  return null
}
