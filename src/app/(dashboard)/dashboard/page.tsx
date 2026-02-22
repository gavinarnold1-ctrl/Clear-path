import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getSession } from '@/lib/session'
import { db } from '@/lib/db'
import { formatCurrency, formatDate, budgetProgress } from '@/lib/utils'
import ProgressBar from '@/components/ui/ProgressBar'
import MonthPicker from './MonthPicker'

export const metadata: Metadata = { title: 'Overview' }

function StatCard({
  label,
  value,
  sub,
  valueClass,
}: {
  label: string
  value: string
  sub?: string
  valueClass?: string
}) {
  return (
    <div className="card">
      <p className="text-sm font-medium text-gray-500">{label}</p>
      <p className={`mt-1 text-3xl font-bold ${valueClass ?? 'text-gray-900'}`}>{value}</p>
      {sub && <p className="mt-1 text-xs text-gray-400">{sub}</p>}
    </div>
  )
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

  const [accounts, incomeAgg, expenseAgg, recent, activeBudgets, categorySpending] = await Promise.all([
    db.account.findMany({ where: { userId: session.userId } }),
    // Income: category.type = "income" within selected date range
    db.transaction.aggregate({
      where: {
        userId: session.userId,
        date: { gte: startDate, lte: endDate },
        category: { type: 'income' },
      },
      _sum: { amount: true },
    }),
    // Expenses: category.type = "expense" within selected date range
    db.transaction.aggregate({
      where: {
        userId: session.userId,
        date: { gte: startDate, lte: endDate },
        category: { type: 'expense' },
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
      include: { category: true },
      orderBy: { spent: 'desc' },
      take: 4,
    }),
    // Spending by category (expense transactions are negative)
    db.transaction.groupBy({
      by: ['categoryId'],
      where: {
        userId: session.userId,
        date: { gte: startDate, lte: endDate },
        category: { type: 'expense' },
        categoryId: { not: null },
      },
      _sum: { amount: true },
      orderBy: { _sum: { amount: 'asc' } }, // most negative first
      take: 6,
    }),
  ])

  const totalBalance = accounts.reduce((sum, a) => sum + a.balance, 0)
  // Income amounts are positive
  const monthlyIncome = incomeAgg._sum.amount ?? 0
  // Expense amounts are negative, show as positive
  const monthlyExpense = Math.abs(expenseAgg._sum.amount ?? 0)

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

  // Format current month for the picker
  const currentMonth = `${year}-${String(month + 1).padStart(2, '0')}`

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">
          {session.name ? `Welcome back, ${session.name.split(' ')[0]}` : 'Overview'}
        </h1>
        <MonthPicker currentMonth={currentMonth} />
      </div>

      {/* Summary stats */}
      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label="Total balance"
          value={formatCurrency(totalBalance)}
          sub={`across ${accounts.length} account${accounts.length !== 1 ? 's' : ''}`}
        />
        <StatCard
          label={`Income — ${monthLabel}`}
          value={formatCurrency(monthlyIncome)}
          valueClass="text-income"
        />
        <StatCard
          label={`Expenses — ${monthLabel}`}
          value={formatCurrency(monthlyExpense)}
          valueClass="text-expense"
        />
      </div>

      {/* Budget overview + Spending by category */}
      <div className="mb-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Active budgets */}
        <div className="card">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-semibold text-gray-900">Active budgets</h2>
            <Link href="/budgets" className="text-sm text-brand-600 hover:text-brand-700">
              View all &rarr;
            </Link>
          </div>

          {activeBudgets.length === 0 ? (
            <p className="text-sm text-gray-400">
              No active budgets.{' '}
              <Link href="/budgets/new" className="text-brand-600 hover:underline">
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
                      <span className="font-medium text-gray-900">{b.name}</span>
                      <span className="text-gray-500">
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
          <h2 className="mb-4 text-base font-semibold text-gray-900">Spending by category</h2>

          {spendingByCategory.length === 0 ? (
            <p className="text-sm text-gray-400">
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
                      <span className="font-medium text-gray-700">{s.name}</span>
                      <span className="text-gray-500">{formatCurrency(s.amount)}</span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
                      <div
                        className="h-full rounded-full bg-brand-500"
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
      <div className="card">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-900">Recent transactions</h2>
          <Link href="/transactions" className="text-sm text-brand-600 hover:text-brand-700">
            View all &rarr;
          </Link>
        </div>

        {recent.length === 0 ? (
          <p className="text-sm text-gray-400">
            No transactions yet.{' '}
            <Link href="/transactions/new" className="text-brand-600 hover:underline">
              Add one
            </Link>{' '}
            to get started.
          </p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {recent.map((tx) => (
              <li key={tx.id} className="flex items-center justify-between py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-gray-900">{tx.merchant}</p>
                  <p className="text-xs text-gray-400">
                    {formatDate(tx.date)} · {tx.account?.name ?? 'No account'}
                    {tx.category ? ` · ${tx.category.name}` : ''}
                  </p>
                </div>
                <span className={`ml-4 shrink-0 text-sm font-semibold ${tx.amount < 0 ? 'text-expense' : tx.amount > 0 ? 'text-income' : 'text-transfer'}`}>
                  {tx.amount < 0 ? '−' : '+'}
                  {formatCurrency(Math.abs(tx.amount))}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
