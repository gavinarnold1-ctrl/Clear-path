import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getSession } from '@/lib/session'
import { db } from '@/lib/db'
import { formatCurrency } from '@/lib/utils'
import MonthPicker from '../dashboard/MonthPicker'
import SpendingViews from './SpendingViews'
import { findRefundPairs } from '@/lib/refund-detection'

export const metadata: Metadata = { title: 'Spending Breakdown' }

interface Props {
  searchParams: Promise<{ month?: string; view?: string }>
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

  // Fetch expense transactions with category, person, and property info (exclude transfers)
  const [allExpenseTransactions, refundCandidates, prevExpenseAgg, householdMembers, properties] = await Promise.all([
    db.transaction.findMany({
      where: {
        userId: session.userId,
        date: { gte: startDate, lte: endDate },
        classification: 'expense',
        amount: { lt: 0 },
      },
      include: {
        category: { select: { id: true, name: true, group: true } },
        householdMember: { select: { id: true, name: true } },
        property: { select: { id: true, name: true, type: true } },
      },
    }),
    // Potential refunds: positive-amount transactions in same period
    db.transaction.findMany({
      where: {
        userId: session.userId,
        date: { gte: startDate, lte: endDate },
        amount: { gt: 0 },
      },
      select: { id: true, merchant: true, amount: true, date: true, accountId: true, classification: true },
    }),
    db.transaction.aggregate({
      where: {
        userId: session.userId,
        date: { gte: prevStart, lte: prevEnd },
        classification: 'expense',
        amount: { lt: 0 },
      },
      _sum: { amount: true },
    }),
    db.householdMember.findMany({
      where: { userId: session.userId },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
    db.property.findMany({
      where: { userId: session.userId },
      select: { id: true, name: true, type: true },
      orderBy: { name: 'asc' },
    }),
  ])

  // Detect refund pairs and exclude refunded expenses from spending
  const allForPairing = [
    ...allExpenseTransactions.map((tx) => ({ id: tx.id, merchant: tx.merchant, amount: tx.amount, date: tx.date.toISOString(), accountId: tx.accountId, classification: tx.classification })),
    ...refundCandidates.map((tx) => ({ id: tx.id, merchant: tx.merchant, amount: tx.amount, date: tx.date.toISOString(), accountId: tx.accountId, classification: tx.classification })),
  ]
  const refundPairIds = findRefundPairs(allForPairing)
  const expenseTransactions = allExpenseTransactions.filter((tx) => !refundPairIds.has(tx.id))

  // Filter to only categorized transactions for the category view
  const categorizedTx = expenseTransactions.filter((tx) => tx.categoryId !== null)

  // Group by category group → category
  const groupMap = new Map<string, Map<string, number>>()
  let totalSpent = 0

  for (const tx of expenseTransactions) {
    totalSpent += Math.abs(tx.amount)
  }

  const catIdMap = new Map<string, string>() // catName -> catId for click-through
  for (const tx of categorizedTx) {
    const group = tx.category?.group ?? 'Other'
    const catName = tx.category?.name ?? 'Unknown'
    const catId = tx.category?.id ?? ''
    const amount = Math.abs(tx.amount)

    if (catId && catName) catIdMap.set(catName, catId)
    if (!groupMap.has(group)) groupMap.set(group, new Map())
    const catMap = groupMap.get(group)!
    catMap.set(catName, (catMap.get(catName) ?? 0) + amount)
  }

  const spendingGroups = [...groupMap.entries()]
    .map(([group, catMap]) => {
      const categories = [...catMap.entries()]
        .map(([name, amount]) => ({ name, amount, id: catIdMap.get(name) ?? '' }))
        .sort((a, b) => b.amount - a.amount)
      const amount = categories.reduce((s, c) => s + c.amount, 0)
      return { group, amount, categories }
    })
    .sort((a, b) => b.amount - a.amount)

  // Group by person (R3.3a: include person ID for click-through)
  const byPerson: { name: string; id: string; amount: number }[] = []
  const personAgg = new Map<string, { id: string; amount: number }>()
  for (const tx of expenseTransactions) {
    const name = tx.householdMember?.name ?? 'Unassigned'
    const id = tx.householdMember?.id ?? ''
    const existing = personAgg.get(name)
    if (existing) {
      existing.amount += Math.abs(tx.amount)
    } else {
      personAgg.set(name, { id, amount: Math.abs(tx.amount) })
    }
  }
  for (const [name, { id, amount }] of personAgg) {
    byPerson.push({ name, id, amount })
  }
  byPerson.sort((a, b) => b.amount - a.amount)

  // Group by property (R4.3: include property ID for click-through)
  const byProperty: { name: string; id: string; type: string | null; amount: number }[] = []
  const propertyAgg = new Map<string, { id: string; type: string | null; amount: number }>()
  for (const tx of expenseTransactions) {
    const name = tx.property?.name ?? 'Unassigned'
    const id = tx.property?.id ?? ''
    const type = tx.property?.type ?? null
    const existing = propertyAgg.get(name)
    if (existing) {
      existing.amount += Math.abs(tx.amount)
    } else {
      propertyAgg.set(name, { id, type, amount: Math.abs(tx.amount) })
    }
  }
  for (const [name, { id, type, amount }] of propertyAgg) {
    byProperty.push({ name, id, type, amount })
  }
  byProperty.sort((a, b) => b.amount - a.amount)

  const prevTotal = Math.abs(prevExpenseAgg._sum.amount ?? 0)
  const pctChange = prevTotal > 0
    ? ((totalSpent - prevTotal) / prevTotal) * 100
    : totalSpent > 0 ? 100 : 0

  const currentMonth = `${year}-${String(month + 1).padStart(2, '0')}`

  const hasMembers = householdMembers.length > 0
  const hasProperties = properties.length > 0

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

      <SpendingViews
        spendingGroups={spendingGroups}
        totalSpent={totalSpent}
        byPerson={byPerson}
        byProperty={byProperty}
        hasMembers={hasMembers}
        hasProperties={hasProperties}
        currentMonth={currentMonth}
      />
    </div>
  )
}
