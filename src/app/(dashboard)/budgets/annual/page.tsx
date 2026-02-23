import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getSession } from '@/lib/session'
import { db } from '@/lib/db'
import AnnualOverview from '@/components/annual/AnnualOverview'
import AnnualAlerts from '@/components/annual/AnnualAlerts'
import AutoFundBanner from '@/components/annual/AutoFundBanner'
import MonthlyForecast from '@/components/annual/MonthlyForecast'
import AnnualExpenseList from '@/components/annual/AnnualExpenseList'
import YearEndProjection from '@/components/annual/YearEndProjection'
import AddExpenseButton from '@/components/annual/AddExpenseButton'

export const metadata: Metadata = { title: 'Annual Planning' }

export default async function AnnualPlanningPage() {
  const session = await getSession()
  if (!session) redirect('/login')

  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999)

  const [expenses, categories, allBudgets, incomeAgg, monthExpenses] = await Promise.all([
    db.annualExpense.findMany({
      where: { userId: session.userId },
      include: { budget: { include: { category: true } } },
      orderBy: [{ dueYear: 'asc' }, { dueMonth: 'asc' }],
    }),
    db.category.findMany({
      where: {
        OR: [{ userId: session.userId }, { userId: null }],
        type: 'expense',
        isActive: true,
      },
      orderBy: [{ group: 'asc' }, { name: 'asc' }],
    }),
    db.budget.findMany({
      where: { userId: session.userId },
      include: { annualExpense: true },
    }),
    db.transaction.aggregate({
      where: {
        userId: session.userId,
        date: { gte: startOfMonth, lte: endOfMonth },
        amount: { gt: 0 },
      },
      _sum: { amount: true },
    }),
    db.transaction.findMany({
      where: {
        userId: session.userId,
        date: { gte: startOfMonth, lte: endOfMonth },
        amount: { lt: 0 },
      },
      select: { categoryId: true, amount: true },
    }),
  ])

  // Compute True Remaining (mirrors budgets page TrueRemainingBanner logic)
  const income = incomeAgg._sum.amount ?? 0

  const spentByCategory = new Map<string, number>()
  for (const tx of monthExpenses) {
    if (tx.categoryId) {
      spentByCategory.set(
        tx.categoryId,
        (spentByCategory.get(tx.categoryId) ?? 0) + Math.abs(tx.amount)
      )
    }
  }

  const fixedTotal = allBudgets
    .filter((b) => b.tier === 'FIXED')
    .reduce((sum, b) => sum + b.amount, 0)
  const flexibleSpent = allBudgets
    .filter((b) => b.tier === 'FLEXIBLE')
    .reduce((sum, b) => sum + (b.categoryId ? (spentByCategory.get(b.categoryId) ?? 0) : 0), 0)
  const annualSetAside = allBudgets
    .filter((b) => b.tier === 'ANNUAL')
    .reduce((sum, b) => sum + (b.annualExpense?.monthlySetAside ?? 0), 0)
  const trueRemaining = income - fixedTotal - flexibleSpent - annualSetAside

  // Compute dynamic fields for each expense
  const enriched = expenses.map((exp) => {
    const targetDate = new Date(exp.dueYear, exp.dueMonth - 1, 1)
    const monthsRemaining = Math.max(
      0,
      (targetDate.getFullYear() - now.getFullYear()) * 12 +
        (targetDate.getMonth() - now.getMonth())
    )
    const remaining = Math.max(0, exp.annualAmount - exp.funded)
    const currentSetAside = monthsRemaining > 0 ? remaining / monthsRemaining : remaining

    let computedStatus = exp.status
    if (exp.status !== 'spent' && exp.status !== 'overspent') {
      if (exp.funded >= exp.annualAmount) {
        computedStatus = 'funded'
      } else if (monthsRemaining <= 0) {
        computedStatus = 'overdue'
      } else if (monthsRemaining <= 2 && exp.funded < exp.annualAmount * 0.5) {
        computedStatus = 'urgent'
      }
    }

    return {
      ...exp,
      // Serialize dates for client components
      actualDate: exp.actualDate?.toISOString() ?? null,
      monthsRemaining,
      currentSetAside,
      computedStatus,
    }
  })

  const active = enriched.filter((e) => e.status !== 'spent' && e.status !== 'overspent')
  const completed = enriched.filter((e) => e.status === 'spent' || e.status === 'overspent')

  const totalPlanned = active.reduce((s, e) => s + e.annualAmount, 0)
  const totalFunded = active.reduce((s, e) => s + e.funded, 0)
  const monthlyBurden = active.reduce((s, e) => s + e.currentSetAside, 0)

  const categoryOptions = categories.map((c) => ({
    id: c.id,
    name: c.name,
    icon: c.icon,
  }))

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Annual Planning</h1>
          <p className="text-sm text-gray-500">{now.getFullYear()} Expense Forecast</p>
        </div>
        <AddExpenseButton categories={categoryOptions} />
      </div>

      <AnnualAlerts expenses={enriched} />

      <AnnualOverview
        totalPlanned={totalPlanned}
        totalFunded={totalFunded}
        monthlyBurden={monthlyBurden}
        expenseCount={active.length}
        trueRemaining={trueRemaining}
      />

      <AutoFundBanner
        trueRemaining={trueRemaining}
        monthlyBurden={monthlyBurden}
        expenses={active.map((e) => ({
          id: e.id,
          name: e.name,
          currentSetAside: e.currentSetAside,
          monthsRemaining: e.monthsRemaining,
          funded: e.funded,
          annualAmount: e.annualAmount,
        }))}
      />

      <MonthlyForecast expenses={enriched} monthlySetAside={monthlyBurden} />

      <AnnualExpenseList
        active={active}
        completed={completed}
        trueRemaining={trueRemaining}
        monthlyBurden={monthlyBurden}
      />

      <YearEndProjection expenses={enriched} monthlyBurden={monthlyBurden} />
    </div>
  )
}
