import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { db } from '@/lib/db'
import { claimTransactions } from '@/lib/budget-claiming'

/**
 * Returns transaction IDs for the catch-all / unallocated flexible pool.
 * Uses the shared claiming logic from budget-claiming.ts to ensure consistency
 * with the budget page's spent calculations.
 */
export async function GET(request: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const month = searchParams.get('month')

  // Parse month range
  let startOfMonth: Date
  let endOfMonth: Date
  if (month) {
    const [year, mo] = month.split('-').map(Number)
    startOfMonth = new Date(Date.UTC(year, mo - 1, 1))
    endOfMonth = new Date(Date.UTC(year, mo, 0, 23, 59, 59, 999))
  } else {
    const now = new Date()
    startOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
    endOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59, 999))
  }

  const allTransactions = await db.transaction.findMany({
    where: {
      userId: session.userId,
      date: { gte: startOfMonth, lte: endOfMonth },
      classification: 'expense',
      amount: { lt: 0 },
    },
    include: { category: { select: { id: true, name: true } } },
    orderBy: { date: 'desc' },
  })

  const allBudgets = await db.budget.findMany({
    where: { userId: session.userId },
    include: { annualExpense: true, category: true },
    orderBy: [{ tier: 'asc' }, { name: 'asc' }],
  })

  const claimableTxs = allTransactions.map(tx => ({
    id: tx.id,
    amount: Number(tx.amount),
    merchant: tx.merchant,
    categoryId: tx.categoryId,
    annualExpenseId: tx.annualExpenseId,
    category: tx.category,
  }))

  const result = claimTransactions(allBudgets, claimableTxs)

  return NextResponse.json({
    transactionIds: result.catchAllTxIds,
    budgetName: 'Unallocated Flexible',
  })
}
