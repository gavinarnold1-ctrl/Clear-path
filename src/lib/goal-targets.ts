import type { PrimaryGoal, GoalTarget } from '@/types'

interface GoalTargetContext {
  monthlyIncome: number
  monthlySavings: number
  totalDebt: number
  topOverspendCategory?: { name: string; monthlyAvg: number; blsBenchmark: number }
  categorizationPct: number
  netWorth: number
}

interface GoalTargetSuggestion {
  metric: GoalTarget['metric']
  computeTarget: (context: GoalTargetContext) => Partial<GoalTarget>
}

export const GOAL_TARGET_DEFAULTS: Record<PrimaryGoal, GoalTargetSuggestion> = {
  save_more: {
    metric: 'savings_amount',
    computeTarget: ({ monthlyIncome }) => {
      const targetRate = 0.20
      const targetMonthlySavings = monthlyIncome * targetRate
      const monthsToGoal = 10
      const targetAmount = Math.round((targetMonthlySavings * monthsToGoal) / 1000) * 1000
      return {
        targetValue: Math.max(targetAmount, 1000),
        monthlyNeeded: targetMonthlySavings,
        description: `Save $${Math.max(targetAmount, 1000).toLocaleString()} in the next ${monthsToGoal} months`,
      }
    },
  },
  spend_smarter: {
    metric: 'category_spend',
    computeTarget: ({ topOverspendCategory }) => {
      if (!topOverspendCategory) {
        return { targetValue: 0, description: 'Optimize spending across all categories' }
      }
      const target = Math.round(topOverspendCategory.blsBenchmark)
      return {
        targetValue: target,
        description: `Get ${topOverspendCategory.name} under $${target}/month (currently $${Math.round(topOverspendCategory.monthlyAvg)})`,
      }
    },
  },
  pay_off_debt: {
    metric: 'debt_payoff',
    computeTarget: ({ totalDebt, monthlyIncome }) => {
      const monthlyExtra = monthlyIncome * 0.10
      const monthsToPayoff = totalDebt > 0 ? Math.ceil(totalDebt / monthlyExtra) : 0
      const targetDate = new Date()
      targetDate.setMonth(targetDate.getMonth() + Math.min(monthsToPayoff, 18))
      return {
        targetValue: 0,
        monthlyNeeded: monthlyExtra + (totalDebt > 0 ? totalDebt / 18 : 0),
        description: totalDebt > 0
          ? `Pay off $${Math.round(totalDebt).toLocaleString()} in debt`
          : 'Stay debt-free',
      }
    },
  },
  gain_visibility: {
    metric: 'categorization_pct',
    computeTarget: ({ categorizationPct }) => ({
      targetValue: 95,
      description: `Categorize 95%+ of transactions (currently ${Math.round(categorizationPct)}%)`,
    }),
  },
  build_wealth: {
    metric: 'net_worth_increase',
    computeTarget: ({ monthlyIncome }) => {
      const annualTarget = monthlyIncome * 12 * 0.15
      const roundedTarget = Math.round(annualTarget / 1000) * 1000
      return {
        targetValue: Math.max(roundedTarget, 1000),
        description: `Increase net worth by $${Math.max(roundedTarget, 1000).toLocaleString()} this year`,
      }
    },
  },
}

/** Compute months between two ISO date strings */
export function monthsBetween(start: string, end: string): number {
  const s = new Date(start)
  const e = new Date(end)
  return (e.getFullYear() - s.getFullYear()) * 12 + (e.getMonth() - s.getMonth())
}

/**
 * Compute the goal timeline impact of changing a budget amount.
 * Returns the shift in projected completion date.
 */
export function computeBudgetChangeImpact(
  goalTarget: GoalTarget,
  currentSurplus: number,          // current monthly surplus (income - all budgets)
  budgetDelta: number,             // positive = increased budget, negative = decreased
): {
  currentProjectedDate: string
  newProjectedDate: string
  monthsShifted: number            // positive = later, negative = earlier
  newMonthlySurplus: number
} | null {
  if (!goalTarget.monthlyNeeded || goalTarget.monthlyNeeded <= 0) return null

  const remaining = goalTarget.targetValue - (goalTarget.currentValue ?? goalTarget.startValue)
  if (remaining <= 0) return null

  // Current projection
  const currentMonthlyContribution = Math.max(currentSurplus, 0)
  const currentMonths = currentMonthlyContribution > 0
    ? Math.ceil(remaining / currentMonthlyContribution)
    : 999 // Effectively infinity

  // New projection after budget change
  const newSurplus = currentSurplus - budgetDelta  // Increasing budget reduces surplus
  const newMonthlyContribution = Math.max(newSurplus, 0)
  const newMonths = newMonthlyContribution > 0
    ? Math.ceil(remaining / newMonthlyContribution)
    : 999

  const currentDate = new Date()
  const currentProjected = new Date(currentDate)
  currentProjected.setMonth(currentProjected.getMonth() + currentMonths)

  const newProjected = new Date(currentDate)
  newProjected.setMonth(newProjected.getMonth() + newMonths)

  return {
    currentProjectedDate: currentProjected.toISOString(),
    newProjectedDate: newProjected.toISOString(),
    monthsShifted: newMonths - currentMonths,
    newMonthlySurplus: newSurplus,
  }
}

/** Projected completion date based on current pace */
export function projectedDate(target: GoalTarget): string {
  if (!target.currentValue || !target.monthlyNeeded || target.monthlyNeeded <= 0) {
    return target.targetDate ? new Date(target.targetDate).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : 'Unknown'
  }
  const remaining = target.targetValue - target.currentValue
  if (remaining <= 0) return 'Achieved!'
  const monthsNeeded = Math.ceil(remaining / target.monthlyNeeded)
  const projected = new Date()
  projected.setMonth(projected.getMonth() + monthsNeeded)
  return projected.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
}
