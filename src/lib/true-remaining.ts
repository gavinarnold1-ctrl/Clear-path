/**
 * Single source of truth for True Remaining computation.
 * True Remaining = Income - Fixed Obligations - Flexible Spent - Unbudgeted Spent - Annual Set-Asides
 */

import { db } from '@/lib/db'

export interface TrueRemainingInputs {
  income: number
  fixedTotal: number
  flexibleSpent: number
  unbudgetedSpent: number
  annualSetAside: number
}

export function computeTrueRemaining(inputs: TrueRemainingInputs): number {
  return inputs.income - inputs.fixedTotal - inputs.flexibleSpent - inputs.unbudgetedSpent - inputs.annualSetAside
}

/**
 * Data returned by getTrueRemainingData — everything needed for the
 * TrueRemainingBanner and the True Remaining hero number.
 */
export interface TrueRemainingData {
  /** Resolved income: expectedMonthlyIncome ?? 3-month avg ?? current month */
  income: number
  /** Actual income received this month */
  rawIncome: number
  /** Sum of FIXED budget amounts */
  fixedTotal: number
  /** Actual spending in FLEXIBLE budget categories */
  flexibleSpent: number
  /** Spending in categories not covered by any budget + uncategorized */
  unbudgetedSpent: number
  /** Sum of monthlySetAside from ANNUAL budgets */
  annualSetAside: number
  /** Sum of FLEXIBLE budget amounts (for banner display) */
  flexibleBudget: number
  /** Computed True Remaining value */
  trueRemaining: number
}

/**
 * Compute True Remaining inputs identically for all surfaces.
 * Dashboard, budgets page, and annual page MUST all call this function
 * so users see the same number everywhere.
 *
 * Logic:
 * 1. Budgets: ALL user budgets (no startDate/endDate filtering)
 * 2. Transactions: current-month expenses; annual-linked excluded from
 *    budget spent (they're tracked on the annual plan)
 * 3. Flexible spent: actual spending in categories that have a FLEXIBLE budget
 * 4. Unbudgeted: spending in categories with NO budget + uncategorized txs
 * 5. Income: expectedMonthlyIncome ?? 3-month average ?? current month
 */
export async function getTrueRemainingData(
  userId: string,
  startOfMonth: Date,
  endOfMonth: Date,
): Promise<TrueRemainingData> {
  const threeMonthsAgo = new Date(startOfMonth.getFullYear(), startOfMonth.getMonth() - 3, 1)

  const [budgets, expenseTransactions, incomeAgg, priorIncomeAgg, userProfile] = await Promise.all([
    db.budget.findMany({
      where: { userId },
      select: {
        id: true,
        amount: true,
        tier: true,
        categoryId: true,
        annualExpense: { select: { monthlySetAside: true } },
      },
    }),
    db.transaction.findMany({
      where: {
        userId,
        date: { gte: startOfMonth, lte: endOfMonth },
        classification: 'expense',
        amount: { lt: 0 },
      },
      select: { categoryId: true, amount: true, annualExpenseId: true },
    }),
    db.transaction.aggregate({
      where: { userId, date: { gte: startOfMonth, lte: endOfMonth }, classification: 'income' },
      _sum: { amount: true },
    }),
    db.transaction.aggregate({
      where: { userId, date: { gte: threeMonthsAgo, lte: startOfMonth }, classification: 'income' },
      _sum: { amount: true },
    }),
    db.userProfile.findUnique({
      where: { userId },
      select: { expectedMonthlyIncome: true },
    }),
  ])

  // Income resolution — identical across all surfaces
  const rawIncome = incomeAgg._sum.amount ?? 0
  const autoExpectedIncome = (priorIncomeAgg._sum.amount ?? 0) / 3
  const income = userProfile?.expectedMonthlyIncome
    ?? (autoExpectedIncome > 0 ? autoExpectedIncome : rawIncome)

  // Build spent-by-category map (excluding annual-linked transactions only)
  const spentByCategory = new Map<string, number>()
  for (const tx of expenseTransactions) {
    if (tx.annualExpenseId) continue
    if (tx.categoryId) {
      spentByCategory.set(
        tx.categoryId,
        (spentByCategory.get(tx.categoryId) ?? 0) + Math.abs(tx.amount),
      )
    }
  }

  // Fixed total = sum of FIXED budget amounts
  const fixedTotal = budgets
    .filter(b => b.tier === 'FIXED')
    .reduce((sum, b) => sum + b.amount, 0)

  // Flexible spent = actual spending in FLEXIBLE budget categories
  const flexibleBudgets = budgets.filter(b => b.tier === 'FLEXIBLE')
  const flexibleSpent = flexibleBudgets
    .reduce((sum, b) => sum + (b.categoryId ? (spentByCategory.get(b.categoryId) ?? 0) : 0), 0)
  const flexibleBudget = flexibleBudgets.reduce((sum, b) => sum + b.amount, 0)

  // Annual set-aside = sum of monthlySetAside from annual budgets
  const annualSetAside = budgets
    .filter(b => b.tier === 'ANNUAL')
    .reduce((sum, b) => sum + (b.annualExpense?.monthlySetAside ?? 0), 0)

  // Unbudgeted spent = spending in categories NOT covered by any budget
  // PLUS uncategorized transactions (no categoryId at all)
  const budgetedCategoryIds = new Set(budgets.filter(b => b.categoryId).map(b => b.categoryId!))
  const unbudgetedSpent = expenseTransactions
    .filter(tx => !tx.annualExpenseId && (!tx.categoryId || !budgetedCategoryIds.has(tx.categoryId)))
    .reduce((sum, tx) => sum + Math.abs(tx.amount), 0)

  const trueRemaining = computeTrueRemaining({ income, fixedTotal, flexibleSpent, unbudgetedSpent, annualSetAside })

  return {
    income,
    rawIncome,
    fixedTotal,
    flexibleSpent,
    unbudgetedSpent,
    annualSetAside,
    flexibleBudget,
    trueRemaining,
  }
}
