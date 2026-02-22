import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getSession } from '@/lib/session'
import { db } from '@/lib/db'
import { formatCurrency, formatDate, budgetProgress } from '@/lib/utils'
import ProgressBar from '@/components/ui/ProgressBar'

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

export default async function DashboardPage() {
  const session = await getSession()
  if (!session) redirect('/login')

  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

  // Income = positive amounts, Expenses = negative amounts (determined by amount sign)
  const [accounts, recent, activeBudgets, categorySpending, monthlyTxns] = await Promise.all([
    db.account.findMany({ where: { userId: session.userId } }),
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
      take: 4,
    }),
    db.transaction.groupBy({
      by: ['categoryId'],
      where: { userId: session.userId, amount: { lt: 0 }, date: { gte: startOfMonth }, categoryId: { not: null } },
      _sum: { amount: true },
      orderBy: { _sum: { amount: 'asc' } },
      take: 6,
    }),
    db.transaction.findMany({
      where: { userId: session.userId, date: { gte: startOfMonth } },
      select: { amount: true, categoryId: true },
    }),
  ])

  const totalBalance = accounts.reduce((sum, a) => sum + a.balance, 0)
  const monthlyIncome = monthlyTxns.filter((t) => t.amount > 0).reduce((sum, t) => sum + t.amount, 0)
  const monthlyExpense = Math.abs(monthlyTxns.filter((t) => t.amount < 0).reduce((sum, t) => sum + t.amount, 0))

  // Calculate spent for each active budget from this month's transactions
  const budgetSpentMap = new Map<string | null, number>()
  for (const t of monthlyTxns) {
    if (t.amount < 0 && t.categoryId) {
      budgetSpentMap.set(t.categoryId, (budgetSpentMap.get(t.categoryId) ?? 0) + Math.abs(t.amount))
    }
  }

  const activeBudgetsWithSpent = activeBudgets.map((b) => ({
    ...b,
    spent: b.categoryId ? (budgetSpentMap.get(b.categoryId) ?? 0) : monthlyExpense,
  }))

  // Resolve category names for spending breakdown
  const catIds = categorySpending.map((g) => g.categoryId).filter((id): id is string => id !== null)
  const categories = catIds.length > 0
    ? await db.category.findMany({ where: { id: { in: catIds } }, select: { id: true, name: true, color: true } })
    : []
  const catMap = new Map(categories.map((c) => [c.id, c]))
  const spendingByCategory = categorySpending.map((g) => {
    const cat = catMap.get(g.categoryId!)
    return { name: cat?.name ?? 'Unknown', color: cat?.color ?? '#6366f1', amount: Math.abs(g._sum.amount ?? 0) }
  })
  const maxCategoryAmount = Math.max(...spendingByCategory.map((s) => s.amount), 1)

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-gray-900">
        {session.name ? `Welcome back, ${session.name.split(' ')[0]}` : 'Overview'}
      </h1>

      {/* Summary stats */}
      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label="Total balance"
          value={formatCurrency(totalBalance)}
          sub={`across ${accounts.length} account${accounts.length !== 1 ? 's' : ''}`}
        />
        <StatCard
          label="Income this month"
          value={formatCurrency(monthlyIncome)}
          valueClass="text-income"
        />
        <StatCard
          label="Expenses this month"
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
              View all →
            </Link>
          </div>

          {activeBudgetsWithSpent.length === 0 ? (
            <p className="text-sm text-gray-400">
              No active budgets.{' '}
              <Link href="/budgets/new" className="text-brand-600 hover:underline">
                Create one
              </Link>{' '}
              to track spending.
            </p>
          ) : (
            <ul className="space-y-4">
              {activeBudgetsWithSpent.map((b) => {
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
                  <span
                    className="inline-block h-3 w-3 shrink-0 rounded-full"
                    style={{ backgroundColor: s.color }}
                  />
                  <div className="flex-1">
                    <div className="mb-1 flex items-center justify-between text-sm">
                      <span className="font-medium text-gray-700">{s.name}</span>
                      <span className="text-gray-500">{formatCurrency(s.amount)}</span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${Math.round((s.amount / maxCategoryAmount) * 100)}%`,
                          backgroundColor: s.color,
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
            View all →
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
                <span
                  className={`ml-4 shrink-0 text-sm font-semibold ${
                    tx.amount < 0 ? 'text-expense' : 'text-income'
                  }`}
                >
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
