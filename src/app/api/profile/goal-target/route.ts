import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { db } from '@/lib/db'
import type { PrimaryGoal, GoalTarget } from '@/types'
import { GOAL_TARGET_DEFAULTS, monthsBetween } from '@/lib/goal-targets'
import { computeCurrentValue } from '@/lib/goal-utils'
import { recordRecalibrationResponse } from '@/lib/ai-context'

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const profile = await db.userProfile.findUnique({
    where: { userId: session.userId },
    select: { primaryGoal: true, goalTarget: true, expectedMonthlyIncome: true },
  })

  if (!profile?.goalTarget) {
    return NextResponse.json({ goalTarget: null })
  }

  const target = profile.goalTarget as unknown as GoalTarget
  const currentValue = await computeCurrentValue(session.userId, target)

  return NextResponse.json({
    goalTarget: { ...target, currentValue },
    progress: computeProgress(target, currentValue),
  })
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const { goalTarget: providedTarget, targetDate, monthlyNeeded } = body as {
    goalTarget?: GoalTarget
    targetDate?: string
    monthlyNeeded?: number
  }

  const profile = await db.userProfile.findUnique({
    where: { userId: session.userId },
    select: { primaryGoal: true, expectedMonthlyIncome: true, goalTarget: true },
  })

  if (!profile?.primaryGoal) {
    return NextResponse.json({ error: 'Set a primary goal first' }, { status: 400 })
  }

  // Recalibration: partial update to existing target (targetDate or monthlyNeeded only)
  const existingTarget = profile.goalTarget as unknown as GoalTarget | null
  if (existingTarget && (targetDate || monthlyNeeded) && !providedTarget) {
    const updated = {
      ...existingTarget,
      ...(targetDate ? { targetDate } : {}),
      ...(monthlyNeeded ? { monthlyNeeded } : {}),
    }
    await db.userProfile.update({
      where: { userId: session.userId },
      data: { goalTarget: JSON.parse(JSON.stringify(updated)) },
    })

    // Record recalibration acceptance signal
    const action = targetDate ? 'extend_date' as const : 'increase_monthly' as const
    recordRecalibrationResponse(session.userId, action, true).catch(() => {})

    return NextResponse.json({ goalTarget: updated, recalibrated: true })
  }

  let goalTarget: GoalTarget

  if (providedTarget) {
    // User provided or adjusted a target
    goalTarget = providedTarget
  } else {
    // Auto-propose based on archetype + real data
    goalTarget = await proposeTarget(session.userId, profile.primaryGoal as PrimaryGoal, profile.expectedMonthlyIncome)
  }

  await db.userProfile.update({
    where: { userId: session.userId },
    data: { goalTarget: JSON.parse(JSON.stringify(goalTarget)) },
  })

  return NextResponse.json({ goalTarget })
}

async function proposeTarget(
  userId: string,
  goal: PrimaryGoal,
  expectedMonthlyIncome: number | null
): Promise<GoalTarget> {
  const now = new Date()
  const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, 1)

  const [incomeAgg, expenseAgg, totalDebtAgg, totalTxCount, categorizedCount, accounts, properties, debtsForRate] =
    await Promise.all([
      db.transaction.aggregate({
        where: { userId, date: { gte: threeMonthsAgo }, classification: 'income' },
        _sum: { amount: true },
      }),
      db.transaction.aggregate({
        where: { userId, date: { gte: threeMonthsAgo }, classification: 'expense' },
        _sum: { amount: true },
      }),
      db.debt.aggregate({
        where: { userId },
        _sum: { currentBalance: true },
      }),
      db.transaction.count({ where: { userId, date: { gte: threeMonthsAgo } } }),
      db.transaction.count({ where: { userId, date: { gte: threeMonthsAgo }, categoryId: { not: null } } }),
      db.account.findMany({ where: { userId }, select: { type: true, balance: true } }),
      db.property.findMany({ where: { userId }, select: { currentValue: true, loanBalance: true } }),
      db.debt.findMany({ where: { userId }, select: { currentBalance: true, interestRate: true } }),
    ])

  const income3mo = incomeAgg._sum.amount ?? 0
  const expense3mo = Math.abs(expenseAgg._sum.amount ?? 0)
  const monthlyIncome = expectedMonthlyIncome ?? income3mo / 3
  const monthlySavings = (income3mo - expense3mo) / 3
  const totalDebt = totalDebtAgg._sum.currentBalance ?? 0
  const categorizationPct = totalTxCount > 0 ? (categorizedCount / totalTxCount) * 100 : 0

  const LIABILITY_TYPES = new Set(['CREDIT_CARD', 'MORTGAGE', 'AUTO_LOAN', 'STUDENT_LOAN'])
  const accountNetWorth = accounts.reduce((sum, a) => {
    if (LIABILITY_TYPES.has(a.type)) return sum - Math.abs(a.balance)
    return sum + a.balance
  }, 0)
  // Use liquid net worth (financial accounts only) for goal targets.
  // Property equity is tracked separately — entering properties shouldn't inflate goals.
  const netWorth = accountNetWorth

  // Compute balance-weighted average interest rate across all debts
  const totalDebtBalance = debtsForRate.reduce((s, d) => s + d.currentBalance, 0)
  const weightedAverageRate = totalDebtBalance > 0
    ? debtsForRate.reduce((s, d) => s + d.currentBalance * d.interestRate, 0) / totalDebtBalance
    : 0.06

  const defaults = GOAL_TARGET_DEFAULTS[goal]
  const computed = defaults.computeTarget({
    monthlyIncome,
    monthlySavings,
    totalDebt,
    weightedAverageRate,
    categorizationPct,
    netWorth,
  })

  const targetDate = new Date()
  targetDate.setMonth(targetDate.getMonth() + 10)

  const startValue = await computeStartValue(userId, defaults.metric, netWorth, totalDebt, categorizationPct, monthlySavings)

  return {
    metric: defaults.metric,
    targetValue: computed.targetValue ?? 0,
    targetDate: computed.targetValue !== undefined
      ? (targetDate.toISOString().split('T')[0])
      : targetDate.toISOString().split('T')[0],
    startValue,
    startDate: now.toISOString().split('T')[0],
    currentValue: startValue,
    description: computed.description ?? `Achieve your ${goal.replace(/_/g, ' ')} goal`,
    monthlyNeeded: computed.monthlyNeeded ?? 0,
  }
}

async function computeStartValue(
  userId: string,
  metric: GoalTarget['metric'],
  netWorth: number,
  totalDebt: number,
  categorizationPct: number,
  monthlySavings: number,
): Promise<number> {
  switch (metric) {
    case 'savings_amount':
      return 0 // Starting from zero — tracking new savings from now
    case 'savings_rate':
      return monthlySavings
    case 'debt_payoff':
      return totalDebt
    case 'categorization_pct':
      return categorizationPct
    case 'net_worth_increase':
      return 0 // Tracking delta from now
    case 'category_spend':
      return 0
    default:
      return 0
  }
}

function computeProgress(target: GoalTarget, currentValue: number): number {
  if (target.targetValue === 0) return currentValue <= 0 ? 100 : 0
  return Math.min(100, Math.round((currentValue / target.targetValue) * 100))
}
