import { db } from './db'
import type { GoalTarget } from '@/types'
import type { Prisma } from '@prisma/client'

/**
 * Compute the current value for a goal target based on real-time data.
 * Extracted from the goal-target API route so it can be reused by the monthly review page.
 */
export async function computeCurrentValue(userId: string, target: GoalTarget): Promise<number> {
  const now = new Date()
  const startDate = new Date(target.startDate)

  switch (target.metric) {
    case 'savings_amount': {
      const [incAgg, expAgg] = await Promise.all([
        db.transaction.aggregate({
          where: { userId, date: { gte: startDate, lte: now }, classification: 'income' },
          _sum: { amount: true },
        }),
        db.transaction.aggregate({
          where: { userId, date: { gte: startDate, lte: now }, classification: 'expense' },
          _sum: { amount: true },
        }),
      ])
      const income = incAgg._sum.amount ?? 0
      const expense = Math.abs(expAgg._sum.amount ?? 0)
      return Math.max(0, income - expense)
    }
    case 'debt_payoff': {
      const debtAgg = await db.debt.aggregate({
        where: { userId },
        _sum: { currentBalance: true },
      })
      return Math.max(0, target.startValue - (debtAgg._sum.currentBalance ?? 0))
    }
    case 'net_worth_increase': {
      // Track liquid financial assets only — excludes property equity so entering
      // properties doesn't inflate "wealth growth" from budgeting work.
      const accounts = await db.account.findMany({
        where: { userId },
        select: { type: true, balance: true },
      })
      const LIABILITY_TYPES = new Set(['CREDIT_CARD', 'MORTGAGE', 'AUTO_LOAN', 'STUDENT_LOAN'])
      const liquidNW = accounts.reduce((sum, a) => {
        if (LIABILITY_TYPES.has(a.type)) return sum - Math.abs(a.balance)
        return sum + a.balance
      }, 0)
      return Math.max(0, liquidNW - target.startValue)
    }
    case 'categorization_pct': {
      const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, 1)
      const [total, categorized] = await Promise.all([
        db.transaction.count({ where: { userId, date: { gte: threeMonthsAgo } } }),
        db.transaction.count({ where: { userId, date: { gte: threeMonthsAgo }, categoryId: { not: null } } }),
      ])
      return total > 0 ? Math.round((categorized / total) * 100) : 0
    }
    case 'savings_rate': {
      const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1)
      const [incAgg, expAgg] = await Promise.all([
        db.transaction.aggregate({
          where: { userId, date: { gte: thisMonth }, classification: 'income' },
          _sum: { amount: true },
        }),
        db.transaction.aggregate({
          where: { userId, date: { gte: thisMonth }, classification: 'expense' },
          _sum: { amount: true },
        }),
      ])
      const income = incAgg._sum.amount ?? 0
      const expense = Math.abs(expAgg._sum.amount ?? 0)
      return income > 0 ? Math.round(((income - expense) / income) * 100) : 0
    }
    case 'category_spend':
      return target.currentValue ?? 0
    default:
      return target.currentValue ?? 0
  }
}

/**
 * Compute and persist the current value of the user's goal target.
 * Fire-and-forget safe — catches errors internally.
 */
export async function persistGoalCurrentValue(userId: string): Promise<void> {
  try {
    const profile = await db.userProfile.findUnique({
      where: { userId },
      select: { goalTarget: true },
    })

    const target = profile?.goalTarget as GoalTarget | null
    if (!target?.metric) return

    const currentValue = await computeCurrentValue(userId, target)

    // Update the JSON field with the new currentValue
    const updated = { ...target, currentValue }
    await db.userProfile.update({
      where: { userId },
      data: { goalTarget: updated as unknown as Prisma.InputJsonValue },
    })
  } catch {
    // Fire-and-forget — don't crash the caller
  }
}
