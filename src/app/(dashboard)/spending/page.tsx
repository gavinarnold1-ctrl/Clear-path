import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getSession } from '@/lib/session'
import { db } from '@/lib/db'
import { formatCurrency } from '@/lib/utils'
import MonthPicker from '../dashboard/MonthPicker'
import SpendingBreakdown from '@/components/dashboard/SpendingBreakdown'

export const metadata: Metadata = { title: 'Spending Breakdown' }

interface Props {
  searchParams: Promise<{ month?: string }>
}

export default async function SpendingPage({ searchParams }: Props) {
  const session = await getSession()
  if (!session) redirect('/login')

  const params = await searchParams

  const now = new Date()
  let year = now.getFullYear()
  let month = now.getMonth()
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

  // Fetch expense transactions (amount < 0) with category info for this month + prev month totals.
  // Use amount sign as source of truth — consistent with dashboard and budget pages.
  const [expenseTransactions, prevExpenseAgg] = await Promise.all([
    db.transaction.findMany({
      where: {
        userId: session.userId,
        date: { gte: startDate, lte: endDate },
        amount: { lt: 0 },
        categoryId: { not: null },
      },
      include: { category: { select: { id: true, name: true, group: true } } },
    }),
    db.transaction.aggregate({
      where: {
        userId: session.userId,
        date: { gte: prevStart, lte: prevEnd },
        amount: { lt: 0 },
      },
      _sum: { amount: true },
    }),
  ])

  // Group by category group, then by category
  const groupMap = new Map<string, Map<string, number>>()
  let totalSpent = 0

  for (const tx of expenseTransactions) {
    const group = tx.category?.group ?? 'Other'
    const catName = tx.category?.name ?? 'Unknown'
    const amount = Math.abs(tx.amount)
    totalSpent += amount

    if (!groupMap.has(group)) groupMap.set(group, new Map())
    const catMap = groupMap.get(group)!
    catMap.set(catName, (catMap.get(catName) ?? 0) + amount)
  }

  // Sort groups by total descending
  const spendingGroups = [...groupMap.entries()]
    .map(([group, catMap]) => {
      const categories = [...catMap.entries()]
        .map(([name, amount]) => ({ name, amount }))
        .sort((a, b) => b.amount - a.amount)
      const amount = categories.reduce((s, c) => s + c.amount, 0)
      return { group, amount, categories }
    })
    .sort((a, b) => b.amount - a.amount)

  const prevTotal = Math.abs(prevExpenseAgg._sum.amount ?? 0)
  const pctChange = prevTotal > 0
    ? ((totalSpent - prevTotal) / prevTotal) * 100
    : totalSpent > 0 ? 100 : 0

  const currentMonth = `${year}-${String(month + 1).padStart(2, '0')}`

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-fjord">Spending Breakdown</h1>
        <MonthPicker currentMonth={currentMonth} />
      </div>

      {/* Summary */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="card">
          <p className="text-sm font-medium text-stone">Total Spent — {monthLabel}</p>
          <p className="mt-1 text-3xl font-bold text-expense">{formatCurrency(totalSpent)}</p>
          {pctChange !== 0 && (
            <p className={`mt-1 text-xs font-medium ${pctChange > 0 ? 'text-expense' : 'text-income'}`}>
              {pctChange > 0 ? '+' : ''}{pctChange.toFixed(1)}% vs prev month
            </p>
          )}
        </div>
        <div className="card">
          <p className="text-sm font-medium text-stone">Categories</p>
          <p className="mt-1 text-3xl font-bold text-fjord">
            {spendingGroups.reduce((s, g) => s + g.categories.length, 0)}
          </p>
          <p className="mt-1 text-xs text-stone">across {spendingGroups.length} groups</p>
        </div>
        <div className="card">
          <p className="text-sm font-medium text-stone">Transactions</p>
          <p className="mt-1 text-3xl font-bold text-fjord">{expenseTransactions.length}</p>
          <p className="mt-1 text-xs text-stone">expense transactions</p>
        </div>
      </div>

      <SpendingBreakdown data={spendingGroups} totalSpent={totalSpent} />
    </div>
  )
}
