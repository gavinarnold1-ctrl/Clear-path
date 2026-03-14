import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getSession } from '@/lib/session'
import { db } from '@/lib/db'
import { getTrueRemainingData } from '@/lib/true-remaining'
import { getForecastSummaries } from '@/lib/forecast-helpers'
import AnnualOverview from '@/components/annual/AnnualOverview'
import AnnualAlerts from '@/components/annual/AnnualAlerts'
import AutoFundBanner from '@/components/annual/AutoFundBanner'
import MonthlyForecast from '@/components/annual/MonthlyForecast'
import AnnualExpenseList from '@/components/annual/AnnualExpenseList'
import FundingProjection from '@/components/annual/FundingProjection'
import AddExpenseButton from '@/components/annual/AddExpenseButton'

export const metadata: Metadata = { title: 'Annual Planning' }

export default async function AnnualPlanningPage() {
  const session = await getSession()
  if (!session) redirect('/login')

  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999)

  const [expenses, categories, properties] = await Promise.all([
    db.annualExpense.findMany({
      where: { userId: session.userId },
      include: {
        budget: { include: { category: true } },
        transactions: { select: { id: true, amount: true } },
        property: { select: { id: true, name: true, type: true } },
      },
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
    db.property.findMany({
      where: { userId: session.userId },
      select: { id: true, name: true, type: true },
      orderBy: { name: 'asc' },
    }),
  ])

  // True Remaining — use shared function so all 3 surfaces show the same number
  const trData = await getTrueRemainingData(session.userId, startOfMonth, endOfMonth)
  const trueRemaining = trData.trueRemaining

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

    // Compute total spent from linked transactions (category-agnostic tracking)
    const linkedSpent = exp.transactions.reduce((sum, tx) => sum + Math.abs(tx.amount), 0)

    return {
      ...exp,
      // Serialize dates for client components
      actualDate: exp.actualDate?.toISOString() ?? null,
      monthsRemaining,
      currentSetAside,
      computedStatus,
      linkedSpent,
    }
  })

  const active = enriched.filter((e) => e.status !== 'spent' && e.status !== 'overspent')
  const completed = enriched.filter((e) => e.status === 'spent' || e.status === 'overspent')

  const totalPlanned = active.reduce((s, e) => s + e.annualAmount, 0)
  const totalFunded = active.reduce((s, e) => s + e.funded, 0)
  const monthlyBurden = active.reduce((s, e) => s + e.currentSetAside, 0)

  // Near-term vs. future breakdown
  const nearTermPlanned = active
    .filter((e) => e.monthsRemaining <= 12)
    .reduce((s, e) => s + e.annualAmount, 0)
  const futurePlanned = totalPlanned - nearTermPlanned

  const categoryOptions = categories.map((c) => ({
    id: c.id,
    name: c.name,
    icon: c.icon,
  }))

  const forecastSummary = await getForecastSummaries(session.userId)

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-fjord">Annual Planning</h1>
          <p className="text-sm text-stone">
            Rolling 12-month plan &middot;{' '}
            {new Date(now.getFullYear(), now.getMonth(), 1).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
            {' – '}
            {new Date(now.getFullYear(), now.getMonth() + 11, 1).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
          </p>
        </div>
        <AddExpenseButton categories={categoryOptions} />
      </div>

      {forecastSummary && (
        <div className="mb-4 rounded-lg border border-pine/20 bg-pine/5 px-4 py-3">
          <span className="text-xs font-medium text-stone">Annual plan · Goal connection</span>
          <p className="text-sm text-fjord">{forecastSummary.annualPlan}</p>
        </div>
      )}

      <AnnualAlerts expenses={enriched} />

      <AnnualOverview
        totalPlanned={totalPlanned}
        totalFunded={totalFunded}
        monthlyBurden={monthlyBurden}
        expenseCount={active.length}
        trueRemaining={trueRemaining}
        nearTermPlanned={nearTermPlanned}
        futurePlanned={futurePlanned}
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
        categories={categoryOptions}
        properties={properties}
      />

      <FundingProjection expenses={enriched} monthlyBurden={monthlyBurden} />
    </div>
  )
}
