import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getSession } from '@/lib/session'
import { db } from '@/lib/db'
import { formatCurrency, formatDate, budgetProgress } from '@/lib/utils'
import ProgressBar from '@/components/ui/ProgressBar'
import MonthPicker from './MonthPicker'
import MonthlyChart from '@/components/dashboard/MonthlyChart'
import ValueTracker from '@/components/dashboard/ValueTracker'
import TrueRemainingBanner from '@/components/budgets/TrueRemainingBanner'
import GetStarted from '@/components/onboarding/GetStarted'
import { getValueSummary } from '@/lib/value-tracker'
import { getGoalContext } from '@/lib/goal-context'
import { getForecastSummaries } from '@/lib/forecast-helpers'
import GoalProgressCard from '@/components/dashboard/GoalProgressCard'
import { checkRecalibration } from '@/lib/goal-recalibration'
import RecalibrationWrapper from '@/components/dashboard/RecalibrationWrapper'
import type { PrimaryGoal, GoalTarget } from '@/types'
import { computeBenefitAlerts } from '@/lib/engines/benefit-alerts'
import type { BenefitAlertInput } from '@/lib/engines/benefit-alerts'

export const metadata: Metadata = { title: 'Overview' }
export const revalidate = 60

function StatCard({
  label,
  value,
  sub,
  valueClass,
  change,
}: {
  label: string
  value: string
  sub?: string
  valueClass?: string
  change?: { pct: number; label: string } | null
}) {
  return (
    <div className="card">
      <p className="text-xs font-medium text-stone">{label}</p>
      <p className={`mt-1 font-mono text-2xl font-medium ${valueClass ?? 'text-fjord'}`}>{value}</p>
      {change != null && (
        <p className={`mt-1 text-xs font-medium ${change.pct > 0 ? 'text-income' : change.pct < 0 ? 'text-expense' : 'text-stone'}`}>
          {change.pct > 0 ? '+' : ''}{change.pct.toFixed(1)}% {change.label}
        </p>
      )}
      {sub && !change && <p className="mt-1 text-xs text-stone">{sub}</p>}
    </div>
  )
}

function pctChange(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? null : 100
  return ((current - previous) / Math.abs(previous)) * 100
}

interface Props {
  searchParams: Promise<{ month?: string }>
}

export default async function DashboardPage({ searchParams }: Props) {
  const session = await getSession()
  if (!session) redirect('/login')

  const params = await searchParams

  // Parse month from search params or default to current month
  const now = new Date()
  let year = now.getFullYear()
  let month = now.getMonth() // 0-indexed
  if (params.month) {
    const [y, m] = params.month.split('-').map(Number)
    if (y && m && m >= 1 && m <= 12) {
      year = y
      month = m - 1
    }
  }

  const startDate = new Date(year, month, 1)
  const endDate = new Date(year, month + 1, 0, 23, 59, 59, 999)
  const monthLabel = startDate.toLocaleString('en-US', { month: 'long', year: 'numeric' })

  // Previous month for comparison
  const prevStart = new Date(year, month - 1, 1)
  const prevEnd = new Date(year, month, 0, 23, 59, 59, 999)

  // Compute 6-month range for chart (ending at selected month)
  const chartStart = new Date(year, month - 5, 1)

  // Use amount sign as the source of truth for income vs expense.
  // The server action guarantees: income = positive, expense = negative.
  // This is more reliable than relational category-type filters, which
  // break if a category's type is wrong or missing.
  const [
    accounts,
    incomeAgg,
    expenseAgg,
    prevIncomeAgg,
    prevExpenseAgg,
    recent,
    rawBudgets,
    budgetExpenses,
    categorySpending,
    chartData,
    userProfile,
    valueSummary,
    goalContext,
  ] = await Promise.all([
    db.account.findMany({ where: { userId: session.userId } }),
    // R1.14: Income = classification "income"
    db.transaction.aggregate({
      where: {
        userId: session.userId,
        date: { gte: startDate, lte: endDate },
        classification: 'income',
      },
      _sum: { amount: true },
    }),
    // R1.14: Expenses = classification "expense" (excludes transfers)
    db.transaction.aggregate({
      where: {
        userId: session.userId,
        date: { gte: startDate, lte: endDate },
        classification: 'expense',
      },
      _sum: { amount: true },
    }),
    // Previous month income (exclude transfers)
    db.transaction.aggregate({
      where: {
        userId: session.userId,
        date: { gte: prevStart, lte: prevEnd },
        classification: 'income',
      },
      _sum: { amount: true },
    }),
    // Previous month expenses (exclude transfers)
    db.transaction.aggregate({
      where: {
        userId: session.userId,
        date: { gte: prevStart, lte: prevEnd },
        classification: 'expense',
      },
      _sum: { amount: true },
    }),
    db.transaction.findMany({
      where: { userId: session.userId },
      include: { account: true, category: true },
      orderBy: { date: 'desc' },
      take: 5,
    }),
    db.budget.findMany({
      where: {
        userId: session.userId,
        startDate: { lte: now },
        OR: [{ endDate: null }, { endDate: { gte: now } }],
      },
      include: { category: true, annualExpense: true },
    }),
    // Current month expense transactions for live budget spent computation (exclude transfers)
    db.transaction.findMany({
      where: {
        userId: session.userId,
        date: { gte: startDate, lte: endDate },
        classification: 'expense',
        amount: { lt: 0 },
      },
      select: { categoryId: true, amount: true, annualExpenseId: true, category: { select: { id: true, name: true } } },
    }),
    // Spending breakdown by category (expenses only, no transfers)
    db.transaction.groupBy({
      by: ['categoryId'],
      where: {
        userId: session.userId,
        date: { gte: startDate, lte: endDate },
        classification: 'expense',
        amount: { lt: 0 },
        categoryId: { not: null },
      },
      _sum: { amount: true },
      orderBy: { _sum: { amount: 'asc' } },
      take: 6,
    }),
    // Monthly aggregates for chart (last 6 months, excluding transfers)
    db.transaction.findMany({
      where: {
        userId: session.userId,
        date: { gte: chartStart, lte: endDate },
        classification: { not: 'transfer' },
      },
      select: { date: true, amount: true, classification: true },
    }),
    // User profile for expected income + goal target
    db.userProfile.findUnique({
      where: { userId: session.userId },
      select: { expectedMonthlyIncome: true, primaryGoal: true, goalTarget: true },
    }),
    // Value tracker — cumulative savings identified by AI insights
    getValueSummary(session.userId),
    // Goal context for goal-driven dashboard
    getGoalContext(session.userId),
  ])

  // Fetch forecast summaries (non-blocking, after main data)
  const forecastSummaries = await getForecastSummaries(session.userId)

  // Benefit alerts — expiring card credits
  const userCards = await db.userCard.findMany({
    where: { userId: session.userId, isActive: true },
    select: {
      id: true,
      openedDate: true,
      cardProgram: { select: { issuer: true, name: true } },
      benefits: {
        where: { isOptedIn: true },
        select: {
          id: true,
          usedAmount: true,
          lastResetDate: true,
          isOptedIn: true,
          cardBenefit: {
            select: { id: true, name: true, creditAmount: true, creditCycle: true },
          },
        },
      },
    },
  })

  const alertInputs: BenefitAlertInput[] = []
  for (const card of userCards) {
    for (const ub of card.benefits) {
      if (!ub.cardBenefit.creditAmount || !ub.cardBenefit.creditCycle) continue
      alertInputs.push({
        benefitId: ub.cardBenefit.id,
        benefitName: ub.cardBenefit.name,
        cardIssuer: card.cardProgram.issuer,
        cardName: card.cardProgram.name,
        userCardId: card.id,
        creditAmount: ub.cardBenefit.creditAmount,
        creditCycle: ub.cardBenefit.creditCycle,
        usedAmount: ub.usedAmount,
        lastResetDate: ub.lastResetDate,
        isOptedIn: ub.isOptedIn,
        openedDate: card.openedDate,
      })
    }
  }
  const benefitAlerts = computeBenefitAlerts(alertInputs)

  // Check if goal needs recalibration
  const goalTargetData = userProfile?.goalTarget as GoalTarget | null
  const recalibration = goalTargetData && userProfile?.primaryGoal
    ? await checkRecalibration(session.userId, goalTargetData, userProfile.primaryGoal as PrimaryGoal)
    : null

  // New users with no accounts: show streamlined "Get Started" flow
  if (accounts.length === 0) {
    return <GetStarted />
  }

  // Compute live budget spent from current-month expense transactions.
  // Annual-plan-linked transactions are excluded from ALL budget tiers
  // to prevent double-counting (they are tracked on the annual plan itself).
  const budgetSpentMap = new Map<string, number>()
  const spentByCatName = new Map<string, number>()
  const catNameToIdMap = new Map<string, string>()
  for (const tx of budgetExpenses) {
    if (tx.annualExpenseId) continue // annual-linked → tracked on annual plan only
    if (tx.categoryId) {
      budgetSpentMap.set(tx.categoryId, (budgetSpentMap.get(tx.categoryId) ?? 0) + Math.abs(tx.amount))
    }
    if (tx.category?.name) {
      const nameKey = tx.category.name.toLowerCase()
      spentByCatName.set(nameKey, (spentByCatName.get(nameKey) ?? 0) + Math.abs(tx.amount))
      if (tx.categoryId) catNameToIdMap.set(nameKey, tx.categoryId)
    }
  }

  const allBudgetsWithSpent = rawBudgets.map((b) => {
    // Primary: match by categoryId
    let spent = b.categoryId ? (budgetSpentMap.get(b.categoryId) ?? 0) : 0

    // Fallback: match by category/budget name when categoryId is null
    if (spent === 0 && !b.categoryId) {
      const catName = b.category?.name?.toLowerCase()
      if (catName && spentByCatName.has(catName)) {
        spent = spentByCatName.get(catName)!
      } else {
        const budgetNameKey = b.name.toLowerCase()
        spent = spentByCatName.get(budgetNameKey) ?? 0
      }
    }

    return { ...b, spent }
  })

  // True Remaining computation: income - fixed committed - flexible spent - annual set-asides
  const fixedBudgets = allBudgetsWithSpent.filter((b) => b.tier === 'FIXED')
  const flexibleBudgets = allBudgetsWithSpent.filter((b) => b.tier === 'FLEXIBLE')
  const annualBudgets = allBudgetsWithSpent.filter((b) => b.tier === 'ANNUAL')

  const monthlyIncome = incomeAgg._sum.amount ?? 0
  const fixedTotal = fixedBudgets.reduce((sum, b) => sum + b.amount, 0)
  const flexibleSpent = flexibleBudgets.reduce((sum, b) => sum + b.spent, 0)
  const annualSetAside = annualBudgets.reduce((sum, b) => sum + (b.annualExpense?.monthlySetAside ?? 0), 0)

  // Active Budgets: deduplicate by categoryId so the same category doesn't
  // appear multiple times when the user has multiple budgets for one category.
  // Collapse into one entry per category: sum budget amounts, keep actual spent.
  const budgetsByCategoryId = new Map<string, { name: string; amount: number; spent: number; id: string }>()
  for (const b of allBudgetsWithSpent) {
    if (b.spent <= 0 && b.amount <= 0) continue
    const key = b.categoryId ?? b.id // ungrouped budgets use their own id
    const existing = budgetsByCategoryId.get(key)
    if (existing) {
      existing.amount += b.amount
      // spent is per-category, so it's the same — don't double it
    } else {
      budgetsByCategoryId.set(key, {
        name: b.category?.name ?? b.name,
        amount: b.amount,
        spent: b.spent,
        id: b.id,
      })
    }
  }
  const activeBudgets = [...budgetsByCategoryId.values()]
    .sort((a, b) => {
      const pctA = a.amount > 0 ? a.spent / a.amount : 0
      const pctB = b.amount > 0 ? b.spent / b.amount : 0
      return pctB - pctA
    })
    .slice(0, 4)

  const CASH_TYPES = new Set(['CHECKING', 'SAVINGS'])
  const cashAvailable = accounts.reduce((sum, a) => {
    if (CASH_TYPES.has(a.type)) return sum + a.balance
    return sum
  }, 0)
  const monthlyExpense = Math.abs(expenseAgg._sum.amount ?? 0)
  const monthlyNet = monthlyIncome - monthlyExpense

  const prevIncome = prevIncomeAgg._sum.amount ?? 0
  const prevExpense = Math.abs(prevExpenseAgg._sum.amount ?? 0)

  const incomeChange = pctChange(monthlyIncome, prevIncome)
  const expenseChange = pctChange(monthlyExpense, prevExpense)

  // Build chart data - group transactions by month
  const chartMonths: Record<string, { income: number; expenses: number }> = {}
  for (let i = 5; i >= 0; i--) {
    const d = new Date(year, month - i, 1)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    chartMonths[key] = { income: 0, expenses: 0 }
  }
  for (const tx of chartData) {
    const d = new Date(tx.date)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    if (chartMonths[key]) {
      if (tx.classification === 'income') {
        chartMonths[key].income += Math.abs(tx.amount)
      } else if (tx.classification === 'expense') {
        chartMonths[key].expenses += Math.abs(tx.amount)
      }
      // transfers already excluded by query, but skip them if present
    }
  }
  const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const chartSeries = Object.entries(chartMonths)
    .map(([key, vals]) => {
      const [, m] = key.split('-')
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
      return {
        label: monthNames[parseInt(m, 10) - 1],
        income: Math.round(vals.income * 100) / 100,
        expenses: Math.round(vals.expenses * 100) / 100,
        isCurrent: key === currentMonthKey,
      }
    })
    .filter((entry) => entry.income > 0 || entry.expenses > 0 || entry.isCurrent)

  // Resolve category names for spending breakdown
  const catIds = categorySpending.map((g) => g.categoryId).filter((id): id is string => id !== null)
  const categories = catIds.length > 0
    ? await db.category.findMany({ where: { id: { in: catIds } }, select: { id: true, name: true, icon: true } })
    : []
  const catMap = new Map(categories.map((c) => [c.id, c]))
  const spendingByCategory = categorySpending.map((g) => {
    const cat = catMap.get(g.categoryId!)
    return { name: cat?.name ?? 'Unknown', icon: cat?.icon ?? null, amount: Math.abs(g._sum.amount ?? 0) }
  })
  const maxCategoryAmount = Math.max(...spendingByCategory.map((s) => s.amount), 1)

  const currentMonth = `${year}-${String(month + 1).padStart(2, '0')}`

  const hasBudgets = rawBudgets.length > 0

  // Goal target for goal-driven dashboard
  const goalTarget = userProfile?.goalTarget as GoalTarget | null
  const hasGoal = !!goalContext && !!userProfile?.primaryGoal
  const trueRemaining = (userProfile?.expectedMonthlyIncome ?? monthlyIncome) - fixedTotal - flexibleSpent - annualSetAside

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-display text-2xl font-medium text-fjord">
          {session.name ? `Welcome back, ${session.name.split(' ')[0]}` : 'Overview'}
        </h1>
        <MonthPicker currentMonth={currentMonth} />
      </div>

      {/* Goal Progress Hero — shown when user has a goal */}
      {hasGoal && goalContext && (
        <GoalProgressCard
          goal={userProfile!.primaryGoal as PrimaryGoal}
          goalLabel={goalContext.goalLabel}
          target={goalTarget}
          trueRemaining={trueRemaining}
        />
      )}

      {/* Goal Recalibration Banner — shown when user is behind pace */}
      {recalibration && <RecalibrationWrapper suggestion={recalibration} />}

      {/* Forecast summary — links to full forecast page */}
      {forecastSummaries && (
        <div className="mb-4 rounded-xl border border-pine/20 bg-pine/5 px-5 py-4">
          <span className="text-xs font-medium uppercase tracking-wider text-stone">Forecast</span>
          <p className="mt-1 text-sm text-fjord">{forecastSummaries.dashboard}</p>
          <Link href="/forecast" className="mt-1 inline-block text-xs text-pine hover:underline">
            See full forecast →
          </Link>
        </div>
      )}

      {/* True Remaining Hero — R8.1, R6.6 (secondary when goal is set, primary otherwise) */}
      {hasBudgets ? (
        <TrueRemainingBanner
          income={monthlyIncome}
          expectedIncome={userProfile?.expectedMonthlyIncome ?? prevIncome}
          fixedTotal={fixedTotal}
          flexibleSpent={flexibleSpent}
          flexibleBudget={flexibleBudgets.reduce((sum, b) => sum + b.amount, 0)}
          annualSetAside={annualSetAside}
        />
      ) : (
        <div className="mb-6 rounded-xl border-2 border-mist bg-frost/50 p-5">
          <p className="text-sm text-stone">
            Set up budgets to see your True Remaining — what you can actually spend.{' '}
            <Link href="/budgets/new" className="font-medium text-fjord hover:underline">
              Create a budget
            </Link>
          </p>
        </div>
      )}

      {/* Summary stats */}
      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Cash Available"
          value={formatCurrency(cashAvailable)}
          sub="checking + savings"
        />
        <StatCard
          label={`Income — ${monthLabel}`}
          value={formatCurrency(monthlyIncome)}
          valueClass="text-income"
          change={incomeChange != null ? { pct: incomeChange, label: 'vs prev month' } : null}
        />
        <StatCard
          label={`Expenses — ${monthLabel}`}
          value={formatCurrency(monthlyExpense)}
          valueClass="text-expense"
          change={expenseChange != null ? { pct: -expenseChange, label: 'vs prev month' } : null}
        />
        <StatCard
          label={`Net — ${monthLabel}`}
          value={formatCurrency(monthlyNet)}
          valueClass={monthlyNet >= 0 ? 'text-income' : 'text-expense'}
          sub={monthlyNet >= 0 ? 'surplus' : 'deficit'}
        />
      </div>

      {/* Income surplus insight */}
      {(() => {
        const expectedIncome = userProfile?.expectedMonthlyIncome
        if (!expectedIncome || expectedIncome <= 0 || monthlyIncome <= expectedIncome) return null
        const surplus = monthlyIncome - expectedIncome
        return (
          <div className="mb-8 rounded-xl border border-pine/30 bg-pine/5 p-5">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 text-lg">&#x1f4b0;</span>
              <div>
                <p className="text-sm font-semibold text-pine">
                  You received {formatCurrency(surplus)} more than expected this month
                </p>
                <p className="mt-1 text-sm text-stone">
                  Your actual income of {formatCurrency(monthlyIncome)} exceeded your expected monthly income of {formatCurrency(expectedIncome)}.
                </p>
                <ul className="mt-2 space-y-1 text-sm text-stone">
                  <li>&bull; Pay down high-interest debt to save on interest</li>
                  <li>&bull; Add to your emergency fund or savings</li>
                  <li>&bull; Top up an annual sinking fund ahead of schedule</li>
                  <li>&bull; Invest for long-term growth</li>
                </ul>
              </div>
            </div>
          </div>
        )
      })()}

      {/* Budget overview + Spending by category */}
      <div className="mb-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Active budgets */}
        <div className="card">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-semibold text-fjord">Active budgets</h2>
            <Link href={`/budgets?month=${currentMonth}`} className="text-sm text-fjord hover:text-midnight">
              View all &rarr;
            </Link>
          </div>

          {activeBudgets.length === 0 ? (
            <p className="text-sm text-stone">
              No active budgets.{' '}
              <Link href="/budgets/new" className="text-fjord hover:underline">
                Create one
              </Link>{' '}
              to track spending.
            </p>
          ) : (
            <ul className="space-y-4">
              {activeBudgets.map((b) => {
                const pct = budgetProgress(b.spent, b.amount)
                return (
                  <li key={b.id}>
                    <div className="mb-1 flex items-center justify-between text-sm">
                      <span className="font-medium text-fjord">{b.name}</span>
                      <span className="text-stone">
                        {formatCurrency(b.spent)} / {formatCurrency(b.amount)}
                      </span>
                    </div>
                    <ProgressBar value={pct} />
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        {/* Spending by category */}
        <div className="card">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-semibold text-fjord">Spending by category</h2>
            <Link href={`/spending?month=${currentMonth}`} className="text-sm text-fjord hover:text-midnight">
              View all &rarr;
            </Link>
          </div>

          {spendingByCategory.length === 0 ? (
            <p className="text-sm text-stone">
              No categorised expenses this month.
            </p>
          ) : (
            <ul className="space-y-3">
              {spendingByCategory.map((s) => (
                <li key={s.name}>
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span className="font-medium text-fjord">
                      {s.icon ? `${s.icon} ` : ''}{s.name}
                    </span>
                    <span className="text-stone">{formatCurrency(s.amount)}</span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-mist">
                    <div
                      className="h-full rounded-full bg-fjord"
                      style={{
                        width: `${Math.round((s.amount / maxCategoryAmount) * 100)}%`,
                      }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Benefit alerts — expiring card credits */}
      {benefitAlerts.length > 0 && (
        <div className="mb-8 space-y-2">
          {benefitAlerts.slice(0, 3).map((alert) => (
            <Link
              key={`${alert.benefitId}-${alert.userCardId}`}
              href="/accounts/benefits"
              className={`block rounded-card border px-4 py-3 transition-colors hover:bg-frost/60 ${
                alert.severity === 'urgent'
                  ? 'border-ember/40 bg-ember/5'
                  : alert.severity === 'warning'
                    ? 'border-birch/60 bg-birch/10'
                    : 'border-mist bg-frost/30'
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="text-sm">
                  {alert.severity === 'urgent' ? '⚠️' : alert.severity === 'warning' ? '⏰' : 'ℹ️'}
                </span>
                <p className="text-sm text-fjord">{alert.message}</p>
              </div>
              <p className="mt-0.5 pl-6 text-xs text-stone">{alert.cardLabel}</p>
            </Link>
          ))}
        </div>
      )}

      {/* Value tracker — cumulative savings identified */}
      <div className="mb-8">
        <ValueTracker value={valueSummary} />
      </div>

      {/* Recent transactions */}
      <div className="card mb-8">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-fjord">Recent transactions</h2>
          <Link href={`/transactions?month=${currentMonth}`} className="text-sm text-fjord hover:text-midnight">
            View all &rarr;
          </Link>
        </div>

        {recent.length === 0 ? (
          <p className="text-sm text-stone">
            No transactions yet.{' '}
            <Link href="/transactions/new" className="text-fjord hover:underline">
              Add one
            </Link>{' '}
            to get started.
          </p>
        ) : (
          <ul className="divide-y divide-mist">
            {recent.map((tx) => (
              <li key={tx.id} className="flex items-center justify-between py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-fjord">{tx.merchant}</p>
                  <p className="text-xs text-stone">
                    {formatDate(tx.date)} · {tx.account?.name ?? 'No account'}
                    {tx.category ? ` · ${tx.category.name}` : ''}
                  </p>
                </div>
                <span className={`ml-4 shrink-0 whitespace-nowrap text-sm font-semibold ${tx.amount < 0 ? 'text-expense' : tx.amount > 0 ? 'text-income' : 'text-transfer'}`}>
                  {tx.amount < 0 ? '−' : '+'}
                  {formatCurrency(Math.abs(tx.amount))}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Chart — below fold per R8.1 */}
      <div>
        <MonthlyChart data={chartSeries} />
      </div>
    </div>
  )
}
