import { db } from './db'

/**
 * Recalculates the `spent` field for all active budgets belonging to a user.
 * Should be called after:
 *   - CSV import
 *   - Manual transaction create/update/delete
 *   - Budget period change
 */
export async function recalculateBudgetSpent(userId: string): Promise<void> {
  const budgets = await db.budget.findMany({
    where: { userId },
    include: { category: true },
  })

  for (const budget of budgets) {
    if (!budget.categoryId) continue

    const { start, end } = getBudgetDateRange(budget)

    // Expenses are stored as negative amounts — sum then take absolute value
    const result = await db.transaction.aggregate({
      where: {
        userId,
        categoryId: budget.categoryId,
        date: { gte: start, lte: end },
        amount: { lt: 0 },
      },
      _sum: { amount: true },
    })

    const spent = Math.abs(result._sum.amount ?? 0)

    if (Math.abs(spent - budget.spent) > 0.001) {
      await db.budget.update({
        where: { id: budget.id },
        data: { spent },
      })
    }
  }
}

/**
 * For a single category — use after adding/editing/deleting a single transaction.
 * More efficient than recalculating everything.
 */
export async function recalculateBudgetSpentForCategory(
  userId: string,
  categoryId: string
): Promise<void> {
  const budgets = await db.budget.findMany({
    where: { userId, categoryId },
  })

  for (const budget of budgets) {
    const { start, end } = getBudgetDateRange(budget)

    const result = await db.transaction.aggregate({
      where: {
        userId,
        categoryId,
        date: { gte: start, lte: end },
        amount: { lt: 0 },
      },
      _sum: { amount: true },
    })

    const spent = Math.abs(result._sum.amount ?? 0)

    await db.budget.update({
      where: { id: budget.id },
      data: { spent },
    })
  }
}

/**
 * Recomputes every account balance for a user from the sum of its transactions.
 * Use after bulk operations (e.g. CSV import) that bypass incremental updates.
 */
export async function recalculateAccountBalances(userId: string): Promise<void> {
  const accounts = await db.account.findMany({ where: { userId } })

  for (const account of accounts) {
    const result = await db.transaction.aggregate({
      where: { accountId: account.id, userId },
      _sum: { amount: true },
    })

    const computed = result._sum.amount ?? 0
    if (Math.abs(computed - account.balance) > 0.001) {
      await db.account.update({
        where: { id: account.id },
        data: { balance: computed },
      })
    }
  }
}

/**
 * Determine the active date range for a budget based on its tier and period.
 */
function getBudgetDateRange(budget: {
  tier: string
  period: string
  startDate: Date
  endDate: Date | null
}): { start: Date; end: Date } {
  const now = new Date()

  switch (budget.tier) {
    case 'FIXED':
    case 'FLEXIBLE': {
      if (budget.period === 'MONTHLY') {
        const start = new Date(now.getFullYear(), now.getMonth(), 1)
        const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999)
        return { start, end }
      }
      if (budget.period === 'WEEKLY') {
        const dayOfWeek = now.getDay()
        const start = new Date(now)
        start.setDate(now.getDate() - dayOfWeek)
        start.setHours(0, 0, 0, 0)
        const end = new Date(start)
        end.setDate(start.getDate() + 6)
        end.setHours(23, 59, 59, 999)
        return { start, end }
      }
      if (budget.period === 'YEARLY') {
        const start = new Date(now.getFullYear(), 0, 1)
        const end = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999)
        return { start, end }
      }
      if (budget.period === 'QUARTERLY') {
        const quarter = Math.floor(now.getMonth() / 3)
        const start = new Date(now.getFullYear(), quarter * 3, 1)
        const end = new Date(now.getFullYear(), quarter * 3 + 3, 0, 23, 59, 59, 999)
        return { start, end }
      }
      return {
        start: budget.startDate,
        end: budget.endDate ?? new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999),
      }
    }

    case 'ANNUAL': {
      return {
        start: budget.startDate,
        end: budget.endDate ?? new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999),
      }
    }

    default:
      return {
        start: budget.startDate,
        end: budget.endDate ?? new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999),
      }
  }
}
