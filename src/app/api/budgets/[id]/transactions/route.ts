import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { db } from '@/lib/db'

/**
 * Returns the exact transaction IDs that contribute to a budget's "spent" number.
 * Replicates the claiming logic from budgets/page.tsx so the transaction list
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

  // ANNUAL tier: return transactions linked to this annual expense
  if (budget.tier === 'ANNUAL' && budget.annualExpense) {
    const transactions = await db.transaction.findMany({
      where: {
        userId: session.userId,
        annualExpenseId: budget.annualExpense.id,
        date: { gte: startOfMonth, lte: endOfMonth },
      },
      select: { id: true },
      orderBy: { date: 'desc' },
    })
    return NextResponse.json({
      transactionIds: transactions.map(t => t.id),
      budgetName: budget.name,
    })
  }

  // For FIXED and FLEXIBLE, replicate the budget page's claiming logic.
  // Load all expense transactions for the month (excluding refund pairs for
  // consistency with the budget page).
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

  // Exclude annual-linked
  const nonAnnualTxs = allTransactions.filter(tx => !tx.annualExpenseId)

  // Load all budgets for claiming
  const allBudgets = await db.budget.findMany({
    where: { userId: session.userId },
    include: { annualExpense: true, category: true },
    orderBy: [{ tier: 'asc' }, { name: 'asc' }],
  })

  const fixedBudgets = allBudgets.filter(b => b.tier === 'FIXED')
  const flexibleBudgets = allBudgets.filter(b => b.tier === 'FLEXIBLE')

  // FIXED claiming — replicates budgets/page.tsx lines 313-354
  const claimedTxIds = new Set<string>()
  const fixedBudgetTxMap = new Map<string, string[]>()

  for (const fb of fixedBudgets) {
    let candidates = fb.categoryId
      ? nonAnnualTxs.filter(tx => tx.categoryId === fb.categoryId && !claimedTxIds.has(tx.id))
      : []

    // Fallback: name-based matching
    if (candidates.length === 0) {
      const budgetNameLower = fb.name.toLowerCase()
      candidates = nonAnnualTxs.filter(tx => {
        if (claimedTxIds.has(tx.id)) return false
        const merchant = (tx.merchant ?? '').toLowerCase()
        return merchant.includes(budgetNameLower) || budgetNameLower.includes(merchant)
      })
    }

    // Priority 1: merchant name match
    const budgetNameLower = fb.name.toLowerCase()
    let match = candidates.find(tx => {
      const merchant = (tx.merchant ?? '').toLowerCase()
      return merchant.includes(budgetNameLower) || budgetNameLower.includes(merchant)
    })

    // Priority 2: closest amount
    if (!match && candidates.length > 0) {
      match = candidates.reduce((closest, tx) =>
        Math.abs(Math.abs(tx.amount) - fb.amount) < Math.abs(Math.abs(closest.amount) - fb.amount)
          ? tx : closest
      )
    }

    const txIds: string[] = []
    if (match) {
      claimedTxIds.add(match.id)
      txIds.push(match.id)
    }
    fixedBudgetTxMap.set(fb.id, txIds)
  }

  // Return FIXED budget transactions
  if (budget.tier === 'FIXED') {
    const txIds = fixedBudgetTxMap.get(budgetId) ?? []
    return NextResponse.json({ transactionIds: txIds, budgetName: budget.name })
  }

  // FLEXIBLE tier
  if (budget.tier === 'FLEXIBLE') {
    const CATCHALL_NAMES = new Set(['miscellaneous', 'uncategorized', 'other', 'everything else'])
    const isCatchAll = CATCHALL_NAMES.has(budget.name.toLowerCase())

    if (isCatchAll) {
      // Catch-all: unclaimed transactions not in any named budget category
      const claimedCategoryIds = new Set<string>()
      for (const b of allBudgets) {
        if (CATCHALL_NAMES.has(b.name.toLowerCase())) continue
        if (b.categoryId) claimedCategoryIds.add(b.categoryId)
        // Also claim categories matched by name
        const bNameKey = b.name.toLowerCase()
        const catByName = nonAnnualTxs.find(tx => tx.category?.name.toLowerCase() === bNameKey)
        if (catByName?.categoryId) claimedCategoryIds.add(catByName.categoryId)
      }

      const catchAllTxs = nonAnnualTxs.filter(tx =>
        !claimedTxIds.has(tx.id) &&
        (!tx.categoryId || !claimedCategoryIds.has(tx.categoryId))
      )
      return NextResponse.json({
        transactionIds: catchAllTxs.map(t => t.id),
        budgetName: budget.name,
      })
    }

    // Named flexible budget: transactions in this category, minus annual-linked and fixed-claimed
    const flexTxs = nonAnnualTxs.filter(tx =>
      tx.categoryId === budget.categoryId && !claimedTxIds.has(tx.id)
    )
    return NextResponse.json({
      transactionIds: flexTxs.map(t => t.id),
      budgetName: budget.name,
    })
  }

  return NextResponse.json({ transactionIds: [], budgetName: budget.name })
}
