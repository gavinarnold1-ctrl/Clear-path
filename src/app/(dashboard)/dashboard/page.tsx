import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getSession } from '@/lib/session'
import { db } from '@/lib/db'
import { formatCurrency, formatDate, budgetProgress } from '@/lib/utils'
import ProgressBar from '@/components/ui/ProgressBar'
import MonthPicker from './MonthPicker'
import MonthlyChart from '@/components/dashboard/MonthlyChart'
import TrueRemainingBanner from '@/components/budgets/TrueRemainingBanner'
import GetStarted from '@/components/onboarding/GetStarted'

export const metadata: Metadata = { title: 'Overview' }

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
      select: { categoryId: true, amount: true, category: { select: { id: true, name: true } } },
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
    // User profile for expected income intelligence
    db.userProfile.findUnique({
      where: { userId: session.userId },
      select: { expectedMonthlyIncome: true },
    }),
  ])

  // New users with no accounts: show streamlined "Get Started" flow
  if (accounts.length === 0) {
    return <GetStarted />
  }

  // Compute live budget spent from current-month expense transactions.
  // Build two maps: by categoryId (primary) and by category name (fallback).
  const budgetSpentMap = new Map<string, number>()
  const spentByCatName = new Map<string, number>()
  const catNameToIdMap = new Map<string, string>()
  for (const tx of budgetExpenses) {
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

  const activeBudgets = allBudgetsWithSpent
    .sort((a, b) => b.spent - a.spent)
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

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-display text-2xl font-medium text-fjord">
          {session.name ? `Welcome back, ${session.name.split(' ')[0]}` : 'Overview'}
        </h1>
        <MonthPicker currentMonth={currentMonth} />
      </div>

      {/* True Remaining Hero — R8.1, R6.6 */}
      {hasBudgets ? (
        <TrueRemainingBanner
          income={monthlyIncome}
          fixedTotal={fixedTotal}
          flexibleSpent={flexibleSpent}
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
                <li key={s.name} className="flex items-center gap-3">
                  <span className="inline-block h-5 w-5 shrink-0 text-center text-sm">
                    {s.icon ?? ''}
                  </span>
                  <div className="flex-1">
                    <div className="mb-1 flex items-center justify-between text-sm">
                      <span className="font-medium text-fjord">{s.name}</span>
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
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
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
