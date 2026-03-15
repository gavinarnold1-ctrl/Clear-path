import type { PrimaryGoal, GoalTarget, GoalPhase, IncomeTransition } from '@/types'

interface GoalTargetContext {
  monthlyIncome: number
  monthlySavings: number
  totalDebt: number
  weightedAverageRate?: number
  topOverspendCategory?: { name: string; monthlyAvg: number; blsBenchmark: number }
  categorizationPct: number
  netWorth: number
}

/**
 * Interest-aware payoff calculation using amortization formula.
 * Returns months needed to pay off a balance at a given monthly payment and rate.
 */
function monthsToPayoffWithInterest(balance: number, monthlyPayment: number, annualRate: number): number {
  if (monthlyPayment <= 0 || balance <= 0) return 0
  const monthlyRate = annualRate / 12
  if (monthlyRate === 0) return Math.ceil(balance / monthlyPayment)
  if (monthlyPayment <= balance * monthlyRate) return Infinity // payment doesn't cover interest
  return Math.ceil(-Math.log(1 - (balance * monthlyRate) / monthlyPayment) / Math.log(1 + monthlyRate))
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
    computeTarget: ({ totalDebt, monthlyIncome, weightedAverageRate }) => {
      if (totalDebt <= 0) {
        return {
          targetValue: 0,
          monthlyNeeded: 0,
          description: 'Stay debt-free',
        }
      }

      // Allocate 10% of monthly income toward debt payoff
      const monthlyPayment = Math.max(monthlyIncome * 0.10, 100)
      const avgRate = weightedAverageRate ?? 0.06

      // Interest-aware payoff timeline
      const months = monthsToPayoffWithInterest(totalDebt, monthlyPayment, avgRate)

      if (months === Infinity || months > 360) {
        // Payment doesn't cover interest or timeline > 30 years — suggest higher allocation
        const minPayment = Math.ceil(totalDebt * (avgRate / 12) * 1.5) // 1.5x interest
        const feasibleMonths = monthsToPayoffWithInterest(totalDebt, minPayment, avgRate)
        return {
          targetValue: 0,
          monthlyNeeded: minPayment,
          description: `Pay off $${Math.round(totalDebt).toLocaleString()} in debt — increase payments to $${Math.round(minPayment).toLocaleString()}/mo`,
        }
      }

      return {
        targetValue: 0,
        monthlyNeeded: monthlyPayment,
        description: `Pay off $${Math.round(totalDebt).toLocaleString()} in debt`,
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
  if (remaining <= 0) return 'Achieved'
  const monthsNeeded = Math.ceil(remaining / target.monthlyNeeded)
  const projected = new Date()
  projected.setMonth(projected.getMonth() + monthsNeeded)
  return projected.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
}

/**
 * Compute goal phases from income transitions.
 * Splits the goal timeline into phases where each has a different
 * monthly contribution based on the income available in that period.
 * The sum of all phase contributions equals the remaining goal amount.
 */
export function computeGoalPhases(
  target: GoalTarget,
  currentMonthlyIncome: number,
  currentMonthlyExpenses: number,
  incomeTransitions: IncomeTransition[],
): GoalPhase[] {
  const now = new Date()
  const targetDate = new Date(target.targetDate)
  const remaining = target.targetValue - (target.currentValue ?? target.startValue)
  if (remaining <= 0) return []

  const futureTransitions = incomeTransitions
    .filter((t) => {
      const d = new Date(t.date)
      return d > now && d < targetDate
    })
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

  if (futureTransitions.length === 0) return []

  // Build phase boundaries
  const boundaries: { date: Date; income: number; label: string }[] = [
    { date: now, income: currentMonthlyIncome, label: 'Current phase' },
    ...futureTransitions.map((t) => ({
      date: new Date(t.date),
      income: t.monthlyIncome,
      label: t.label,
    })),
  ]

  // Compute months in each phase
  const phases: { label: string; months: number; income: number; startDate: string; endDate: string }[] = []
  for (let i = 0; i < boundaries.length; i++) {
    const start = boundaries[i].date
    const end = i < boundaries.length - 1 ? boundaries[i + 1].date : targetDate
    const months = Math.max(0, monthsBetween(start.toISOString(), end.toISOString()))
    if (months > 0) {
      phases.push({
        label: boundaries[i].label,
        months,
        income: boundaries[i].income,
        startDate: start.toISOString().slice(0, 10),
        endDate: end.toISOString().slice(0, 10),
      })
    }
  }

  if (phases.length === 0) return []

  // Distribute the remaining amount across phases proportionally to income
  // Higher income phases contribute more
  const totalIncomeMonths = phases.reduce((sum, p) => sum + p.income * p.months, 0)
  if (totalIncomeMonths <= 0) return []

  return phases.map((p) => {
    const phaseShare = (p.income * p.months) / totalIncomeMonths
    const phaseContribution = remaining * phaseShare
    const monthlyNeeded = p.months > 0 ? Math.round(phaseContribution / p.months) : 0

    return {
      label: p.label,
      monthlyNeeded,
      startDate: p.startDate,
      endDate: p.endDate,
    }
  })
}
