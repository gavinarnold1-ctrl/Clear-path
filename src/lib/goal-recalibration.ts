import type { GoalTarget, PrimaryGoal } from '@/types'
import { db } from '@/lib/db'
import { formatCurrency } from '@/lib/utils'
import { monthsBetween } from '@/lib/goal-targets'

export interface RecalibrationSuggestion {
  type: 'extend_date' | 'increase_monthly' | 'reduce_target' | 'celebrate_completion'
  title: string
  description: string
  newTargetDate?: string
  newMonthlyNeeded?: number
  newTargetValue?: number
  monthsBehind: number
}

/**
 * Check if user's goal needs recalibration based on recent progress.
 * Called from dashboard page load and monthly review generation.
 */
export async function checkRecalibration(
  userId: string,
  goalTarget: GoalTarget,
  primaryGoal: PrimaryGoal,
): Promise<RecalibrationSuggestion | null> {
  // 1. Get the last 3 months of snapshots
  const threeMonthsAgo = new Date()
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3)

  const snapshots = await db.monthlySnapshot.findMany({
    where: { userId, month: { gte: threeMonthsAgo } },
    orderBy: { month: 'asc' },
  })

  if (snapshots.length < 2) return null // Not enough data

  // 2. Compute actual monthly velocity over the period
  const actualMonthlyProgress = computeActualVelocity(snapshots, goalTarget)

  // 3. Compare to required velocity
  const monthsRemaining = monthsBetween(new Date().toISOString(), goalTarget.targetDate)
  if (monthsRemaining <= 0) {
    // Past target date — suggest celebration or reset
    const progress = ((goalTarget.currentValue ?? goalTarget.startValue) / goalTarget.targetValue) * 100
    if (progress >= 95) {
      return {
        type: 'celebrate_completion',
        title: 'You did it!',
        description: `You've reached ${Math.round(progress)}% of your goal: ${goalTarget.description}. Time to set a new goal?`,
        monthsBehind: 0,
      }
    }
    // Missed deadline
    const newMonthsNeeded = Math.ceil(
      (goalTarget.targetValue - (goalTarget.currentValue ?? goalTarget.startValue)) /
      Math.max(actualMonthlyProgress, 1)
    )
    const newDate = new Date()
    newDate.setMonth(newDate.getMonth() + newMonthsNeeded)
    return {
      type: 'extend_date',
      title: 'Adjust your timeline?',
      description: `Your target date has passed, but you're ${Math.round(progress)}% there. At your current pace, you'd reach your goal by ${formatMonth(newDate)}.`,
      newTargetDate: newDate.toISOString(),
      monthsBehind: Math.abs(monthsRemaining),
    }
  }

  const requiredVelocity = (goalTarget.targetValue - (goalTarget.currentValue ?? goalTarget.startValue)) / monthsRemaining

  // 4. If velocity is < 70% of required for 2+ months, suggest recalibration
  if (actualMonthlyProgress < requiredVelocity * 0.7 && snapshots.length >= 2) {
    const consecutiveBehind = countConsecutiveBehind(snapshots, goalTarget)
    if (consecutiveBehind < 2) return null // Need 2+ months behind

    // Option A: Extend the date
    const velocityToUse = Math.max(actualMonthlyProgress, requiredVelocity * 0.5)
    const remaining = goalTarget.targetValue - (goalTarget.currentValue ?? goalTarget.startValue)
    const newMonthsNeeded = Math.ceil(remaining / velocityToUse)
    const extendedDate = new Date()
    extendedDate.setMonth(extendedDate.getMonth() + newMonthsNeeded)

    // Option B: Increase monthly contribution
    const increasedMonthly = Math.ceil(requiredVelocity * 1.1) // 10% buffer

    return {
      type: 'extend_date', // Default suggestion — less pressure
      title: 'Your goal may need adjusting',
      description: `You've been behind pace for ${consecutiveBehind} months. At your current rate of ${formatCurrency(actualMonthlyProgress)}/month, you'd reach your goal by ${formatMonth(extendedDate)} instead of ${formatMonth(new Date(goalTarget.targetDate))}.`,
      newTargetDate: extendedDate.toISOString(),
      newMonthlyNeeded: increasedMonthly,
      monthsBehind: consecutiveBehind,
    }
  }

  return null
}

/**
 * Compute weighted moving average of monthly progress toward the goal.
 * Most recent month gets 3x weight, second 2x, rest 1x.
 */
function computeActualVelocity(
  snapshots: { month: Date; totalIncome: number; totalExpenses: number; netSurplus: number }[],
  goalTarget: GoalTarget,
): number {
  if (snapshots.length === 0) return 0

  // Use net surplus as a proxy for goal velocity (works for save_more, pay_off_debt, build_wealth)
  let totalWeighted = 0
  let totalWeight = 0

  for (let i = 0; i < snapshots.length; i++) {
    const weight = i === snapshots.length - 1 ? 3 : i === snapshots.length - 2 ? 2 : 1
    totalWeighted += Math.max(0, snapshots[i].netSurplus) * weight
    totalWeight += weight
  }

  return totalWeight > 0 ? totalWeighted / totalWeight : 0
}

/**
 * Count how many of the most recent consecutive months the user was behind pace.
 */
function countConsecutiveBehind(
  snapshots: { month: Date; totalIncome: number; totalExpenses: number; netSurplus: number }[],
  goalTarget: GoalTarget,
): number {
  if (!goalTarget.monthlyNeeded || goalTarget.monthlyNeeded <= 0) return 0

  let count = 0
  // Walk from most recent backward
  for (let i = snapshots.length - 1; i >= 0; i--) {
    const surplus = snapshots[i].netSurplus
    if (surplus < goalTarget.monthlyNeeded * 0.7) {
      count++
    } else {
      break // Streak broken
    }
  }
  return count
}

function formatMonth(date: Date): string {
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}
