/**
 * Deterministic narrative summary builder for forecast scenarios.
 * No AI, no API calls — builds 1-2 sentence human-readable summaries
 * from scenario impact data.
 */

import { formatCurrency } from '@/lib/utils'

export interface NarrativeInput {
  monthlyImpactOnTrueRemaining: number
  daysSaved: number
  makesGoalAchievable?: boolean
  newProjectedDate?: string | null
  baselineProjectedDate?: string | null
  budgetCategoriesAffected: string[]
  totalInterestImpact?: number
}

export function buildNarrativeSummary(input: NarrativeInput): string {
  const parts: string[] = []

  // 1. Monthly impact magnitude
  const monthly = input.monthlyImpactOnTrueRemaining
  if (monthly > 0) {
    parts.push(`Saves ${formatCurrency(monthly)}/month`)
  } else if (monthly < 0) {
    parts.push(`Costs ${formatCurrency(Math.abs(monthly))}/month`)
  } else {
    return 'This scenario has minimal impact on your finances.'
  }

  // 2. What categories are affected (max 3)
  const affected = input.budgetCategoriesAffected
  if (affected.length > 0 && affected.length <= 3) {
    parts.push(`by adjusting ${affected.join(' and ')}`)
  } else if (affected.length > 3) {
    parts.push(`across ${affected.length} budget categories`)
  }

  // 3. Goal timeline impact
  if (input.makesGoalAchievable) {
    parts.push('making your goal achievable')
    if (input.newProjectedDate) {
      parts.push(`with a projected completion of ${fmtDate(input.newProjectedDate)}`)
    }
  } else if (input.daysSaved > 30) {
    const months = Math.round(input.daysSaved / 30)
    const label = months === 1 ? '1 month' : `${months} months`
    parts.push(`reaching your goal ${label} sooner`)
    if (input.newProjectedDate && input.baselineProjectedDate) {
      parts.push(`(${fmtDate(input.newProjectedDate)} vs. ${fmtDate(input.baselineProjectedDate)})`)
    }
  } else if (input.daysSaved < -30) {
    const months = Math.round(Math.abs(input.daysSaved) / 30)
    parts.push(`pushing your goal back ${months === 1 ? '1 month' : `${months} months`}`)
  } else if (Math.abs(input.daysSaved) <= 30) {
    parts.push('with minimal impact on your goal timeline')
  }

  // 4. Interest impact for debt scenarios
  if (input.totalInterestImpact && Math.abs(input.totalInterestImpact) > 100) {
    if (input.totalInterestImpact < 0) {
      parts.push(`saving ${formatCurrency(Math.abs(input.totalInterestImpact))} in interest`)
    } else {
      parts.push(`adding ${formatCurrency(input.totalInterestImpact)} in interest costs`)
    }
  }

  return parts.join(', ') + '.'
}

function fmtDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}
