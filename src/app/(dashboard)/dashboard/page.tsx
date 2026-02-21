import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getSession } from '@/lib/session'
import { db } from '@/lib/db'
import { formatCurrency, formatDate } from '@/lib/utils'

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

const TYPE_SIGN = { INCOME: '+', EXPENSE: '−', TRANSFER: '⇄' }
const TYPE_COLOR = { INCOME: 'text-income', EXPENSE: 'text-expense', TRANSFER: 'text-transfer' }

export default async function DashboardPage() {
  const session = await getSession()
  if (!session) redirect('/login')

  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

  const [accounts, incomeAgg, expenseAgg, recent] = await Promise.all([
    db.account.findMany({ where: { userId: session.userId } }),
    db.transaction.aggregate({
      where: { userId: session.userId, type: 'INCOME', date: { gte: startOfMonth } },
      _sum: { amount: true },
    }),
    db.transaction.aggregate({
      where: { userId: session.userId, type: 'EXPENSE', date: { gte: startOfMonth } },
      _sum: { amount: true },
    }),
    db.transaction.findMany({
      where: { userId: session.userId },
      include: { account: true, category: true },
      orderBy: { date: 'desc' },
      take: 5,
    }),
  ])

  const totalBalance = accounts.reduce((sum, a) => sum + a.balance, 0)
  const monthlyIncome = incomeAgg._sum.amount ?? 0
  const monthlyExpense = expenseAgg._sum.amount ?? 0

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
                  <p className="truncate text-sm font-medium text-gray-900">{tx.description}</p>
                  <p className="text-xs text-gray-400">
                    {formatDate(tx.date)} · {tx.account.name}
                    {tx.category ? ` · ${tx.category.name}` : ''}
                  </p>
                </div>
                <span className={`ml-4 shrink-0 text-sm font-semibold ${TYPE_COLOR[tx.type]}`}>
                  {TYPE_SIGN[tx.type]}
                  {formatCurrency(tx.amount)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
