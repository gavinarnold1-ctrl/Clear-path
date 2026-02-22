import { db } from './db'

export interface BudgetContext {
  totalBudgeted: number
  totalSpent: number
  utilizationPercent: number
  overBudgetCategories: { name: string; budgeted: number; spent: number; overBy: number }[]
  underUtilizedCategories: { name: string; budgeted: number; spent: number; pctUsed: number }[]
  unbudgetedSpending: number
  fixedBills: { name: string; amount: number; isPaid: boolean }[]
  annualExpenses: { name: string; funded: number; annualAmount: number; monthsLeft: number }[]
}

export async function buildBudgetContext(userId: string): Promise<BudgetContext> {
  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999)

  const [budgets, monthExpenses] = await Promise.all([
    db.budget.findMany({
      where: { userId },
      include: { category: true, annualExpense: true },
    }),
    db.transaction.findMany({
      where: {
        userId,
        date: { gte: startOfMonth, lte: endOfMonth },
        amount: { lt: 0 },
      },
      include: { category: true },
    }),
  ])

  const totalBudgeted = budgets
    .filter((b) => b.tier !== 'ANNUAL')
    .reduce((s, b) => s + b.amount, 0)
  const totalSpent = budgets
    .filter((b) => b.tier !== 'ANNUAL')
    .reduce((s, b) => s + b.spent, 0)

  const overBudgetCategories = budgets
    .filter((b) => b.spent > b.amount && b.tier !== 'ANNUAL')
    .map((b) => ({
      name: b.category?.name ?? b.name,
      budgeted: b.amount,
      spent: b.spent,
      overBy: b.spent - b.amount,
    }))

  const underUtilizedCategories = budgets
    .filter((b) => b.tier === 'FLEXIBLE' && b.amount > 0 && b.spent / b.amount < 0.3)
    .map((b) => ({
      name: b.category?.name ?? b.name,
      budgeted: b.amount,
      spent: b.spent,
      pctUsed: Math.round((b.spent / b.amount) * 100),
    }))

  // Find spending in categories with no budget
  const budgetedCategoryIds = new Set(budgets.map((b) => b.categoryId).filter(Boolean))
  const unbudgeted = monthExpenses.filter(
    (t) => t.categoryId && !budgetedCategoryIds.has(t.categoryId)
  )
  const unbudgetedSpending = unbudgeted.reduce((s, t) => s + Math.abs(t.amount), 0)

  const fixedBills = budgets
    .filter((b) => b.tier === 'FIXED')
    .map((b) => ({
      name: b.category?.name ?? b.name,
      amount: b.amount,
      isPaid: b.spent > 0,
    }))

  const annualExpenses = budgets
    .filter((b) => b.tier === 'ANNUAL' && b.annualExpense)
    .map((b) => {
      const ae = b.annualExpense!
      const targetDate = new Date(ae.dueYear, ae.dueMonth - 1, 1)
      const monthsLeft = Math.max(
        0,
        (targetDate.getFullYear() - now.getFullYear()) * 12 +
          (targetDate.getMonth() - now.getMonth())
      )
      return {
        name: ae.name,
        funded: ae.funded,
        annualAmount: ae.annualAmount,
        monthsLeft,
      }
    })

  return {
    totalBudgeted,
    totalSpent,
    utilizationPercent: totalBudgeted > 0 ? Math.round((totalSpent / totalBudgeted) * 100) : 0,
    overBudgetCategories,
    underUtilizedCategories,
    unbudgetedSpending,
    fixedBills,
    annualExpenses,
  }
}
