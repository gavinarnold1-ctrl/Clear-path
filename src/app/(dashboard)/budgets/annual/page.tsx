import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getSession } from '@/lib/session'
import { db } from '@/lib/db'
import AnnualOverview from '@/components/annual/AnnualOverview'
import AnnualAlerts from '@/components/annual/AnnualAlerts'
import MonthlyForecast from '@/components/annual/MonthlyForecast'
import AnnualExpenseList from '@/components/annual/AnnualExpenseList'
import YearEndProjection from '@/components/annual/YearEndProjection'
import AddExpenseButton from '@/components/annual/AddExpenseButton'

export const metadata: Metadata = { title: 'Annual Planning' }

export default async function AnnualPlanningPage() {
  const session = await getSession()
  if (!session) redirect('/login')

  const [expenses, categories] = await Promise.all([
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
  ])

  // Compute dynamic fields for each expense
  const now = new Date()
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
      />

      <MonthlyForecast expenses={enriched} monthlySetAside={monthlyBurden} />

      <AnnualExpenseList active={active} completed={completed} />

      <YearEndProjection expenses={enriched} monthlyBurden={monthlyBurden} />
    </div>
  )
}
