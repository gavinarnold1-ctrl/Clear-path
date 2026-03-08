import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { db } from '@/lib/db'
import { claimTransactions, CATCHALL_NAMES } from '@/lib/budget-claiming'

/**
 * Returns the exact transaction IDs that contribute to a budget's "spent" number.
 * Uses the shared claiming logic from budget-claiming.ts so the transaction list
 * matches the spent amount shown on the budget page.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: budgetId } = await params
  const { searchParams } = new URL(request.url)
  const month = searchParams.get('month')

  const budget = await db.budget.findFirst({
    where: { id: budgetId, userId: session.userId },
    include: { annualExpense: true, category: true },
  })

  if (!budget) return NextResponse.json({ error: 'Budget not found' }, { status: 404 })

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

  // Count perk-excluded transactions for UI indicator
  const perkExcludedCount = await db.transaction.count({
    where: {
      userId: session.userId,
      date: { gte: startOfMonth, lte: endOfMonth },
      classification: 'expense',
      amount: { lt: 0 },
      tags: { contains: 'perk_covered' },
    },
  })

  // ANNUAL tier: return transactions linked to this annual expense
  if (budget.tier === 'ANNUAL' && budget.annualExpense) {
    const transactions = await db.transaction.findMany({
      where: {
        userId: session.userId,
        annualExpenseId: budget.annualExpense.id,
        date: { gte: startOfMonth, lte: endOfMonth },
        NOT: { tags: { contains: 'perk_covered' } },
      },
      select: { id: true },
      orderBy: { date: 'desc' },
    })
    return NextResponse.json({
      transactionIds: transactions.map(t => t.id),
      budgetName: budget.name,
      perkExcludedCount,
    })
  }

  // For FIXED and FLEXIBLE, use shared claiming logic.
  const allTransactions = await db.transaction.findMany({
    where: {
      userId: session.userId,
      date: { gte: startOfMonth, lte: endOfMonth },
      classification: 'expense',
      amount: { lt: 0 },
      NOT: { tags: { contains: 'perk_covered' } },
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
    tags: tx.tags,
  }))

  const result = claimTransactions(allBudgets, claimableTxs)

  // Return FIXED budget transactions
  if (budget.tier === 'FIXED') {
    const txId = result.fixedClaimed.get(budgetId)
    return NextResponse.json({
      transactionIds: txId ? [txId] : [],
      budgetName: budget.name,
      perkExcludedCount,
    })
  }

  // FLEXIBLE tier
  if (budget.tier === 'FLEXIBLE') {
    const isCatchAll = CATCHALL_NAMES.has(budget.name.toLowerCase())
    if (isCatchAll) {
      return NextResponse.json({
        transactionIds: result.catchAllTxIds,
        budgetName: budget.name,
        perkExcludedCount,
      })
    }

    const txIds = result.flexibleClaimed.get(budgetId) ?? []
    return NextResponse.json({
      transactionIds: txIds,
      budgetName: budget.name,
      perkExcludedCount,
    })
  }

  return NextResponse.json({ transactionIds: [], budgetName: budget.name, perkExcludedCount })
}
