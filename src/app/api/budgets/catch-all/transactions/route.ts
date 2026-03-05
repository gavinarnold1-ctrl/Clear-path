import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { db } from '@/lib/db'

/**
 * Returns transaction IDs for the catch-all / unallocated flexible pool.
 * These are unclaimed expense transactions not belonging to any named budget category.
 * Used when there is no explicit catch-all budget but the unallocated pool is shown.
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

  // Load all expense transactions for the month
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

  const nonAnnualTxs = allTransactions.filter(tx => !tx.annualExpenseId)

  // Load all budgets
  const allBudgets = await db.budget.findMany({
    where: { userId: session.userId },
    include: { annualExpense: true, category: true },
    orderBy: [{ tier: 'asc' }, { name: 'asc' }],
  })

  const fixedBudgets = allBudgets.filter(b => b.tier === 'FIXED')
  const CATCHALL_NAMES = new Set(['miscellaneous', 'uncategorized', 'other', 'everything else'])

  // FIXED claiming — same logic as budgets/page.tsx
  const claimedTxIds = new Set<string>()
  for (const fb of fixedBudgets) {
    let candidates = fb.categoryId
      ? nonAnnualTxs.filter(tx => tx.categoryId === fb.categoryId && !claimedTxIds.has(tx.id))
      : []

    if (candidates.length === 0) {
      const budgetNameLower = fb.name.toLowerCase()
      candidates = nonAnnualTxs.filter(tx => {
        if (claimedTxIds.has(tx.id)) return false
        const merchant = (tx.merchant ?? '').toLowerCase()
        return merchant.includes(budgetNameLower) || budgetNameLower.includes(merchant)
      })
    }

    const budgetNameLower = fb.name.toLowerCase()
    let match = candidates.find(tx => {
      const merchant = (tx.merchant ?? '').toLowerCase()
      return merchant.includes(budgetNameLower) || budgetNameLower.includes(merchant)
    })
    if (!match && candidates.length > 0) {
      match = candidates.reduce((closest, tx) =>
        Math.abs(Math.abs(tx.amount) - fb.amount) < Math.abs(Math.abs(closest.amount) - fb.amount)
          ? tx : closest
      )
    }
    if (match) claimedTxIds.add(match.id)
  }

  // Collect all claimed category IDs from non-catch-all budgets
  const claimedCategoryIds = new Set<string>()
  for (const b of allBudgets) {
    if (CATCHALL_NAMES.has(b.name.toLowerCase())) continue
    if (b.categoryId) claimedCategoryIds.add(b.categoryId)
    const bNameKey = b.name.toLowerCase()
    const catByName = nonAnnualTxs.find(tx => tx.category?.name.toLowerCase() === bNameKey)
    if (catByName?.categoryId) claimedCategoryIds.add(catByName.categoryId)
  }

  // Catch-all: unclaimed + (uncategorized or unbudgeted category)
  const catchAllTxs = nonAnnualTxs.filter(tx =>
    !claimedTxIds.has(tx.id) &&
    (!tx.categoryId || !claimedCategoryIds.has(tx.categoryId))
  )

  return NextResponse.json({
    transactionIds: catchAllTxs.map(t => t.id),
    budgetName: 'Unallocated Flexible',
  })
}
