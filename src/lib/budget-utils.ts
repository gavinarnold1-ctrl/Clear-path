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
 * Reconcile imported transactions whose category doesn't match any budget-linked
 * category. Uses the stored originalCategory field to find partial name matches
 * against budget categories, then re-links the transactions.
 *
 * Should be called after CSV import, before recalculateBudgetSpent.
 */
export async function reconcileBudgetCategories(userId: string): Promise<number> {
  const budgets = await db.budget.findMany({
    where: { userId, categoryId: { not: null } },
    include: { category: true },
  })

  if (budgets.length === 0) return 0

  const budgetCatNameToId = new Map<string, string>()
  const budgetCatIds = new Set<string>()
  for (const b of budgets) {
    if (b.category) {
      budgetCatNameToId.set(b.category.name.toLowerCase(), b.categoryId!)
      budgetCatIds.add(b.categoryId!)
    }
  }

  // Find imported transactions not linked to any budget category
  const transactions = await db.transaction.findMany({
    where: {
      userId,
      importSource: 'csv',
      originalCategory: { not: null },
      categoryId: { notIn: [...budgetCatIds] },
    },
    select: { id: true, categoryId: true, originalCategory: true },
  })

  let relinkedCount = 0

  for (const tx of transactions) {
    if (!tx.originalCategory) continue
    const origKey = tx.originalCategory.toLowerCase().trim()

    // Try exact name match to budget category
    let matchedCatId = budgetCatNameToId.get(origKey) ?? null

    // Try partial match (contains or word overlap)
    if (!matchedCatId) {
      for (const [catName, catId] of budgetCatNameToId) {
        if (origKey.includes(catName) || catName.includes(origKey)) {
          matchedCatId = catId
          break
        }
        const origWords = origKey.split(/[\s&,]+/).filter((w) => w.length > 2)
        const catWords = catName.split(/[\s&,]+/).filter((w) => w.length > 2)
        const overlap = origWords.filter((w) => catWords.includes(w)).length
        if (overlap > 0 && overlap >= Math.min(origWords.length, catWords.length) * 0.5) {
          matchedCatId = catId
          break
        }
      }
    }

    if (matchedCatId && matchedCatId !== tx.categoryId) {
      await db.transaction.update({
        where: { id: tx.id },
        data: { categoryId: matchedCatId },
      })
      relinkedCount++
    }
  }

  return relinkedCount
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
