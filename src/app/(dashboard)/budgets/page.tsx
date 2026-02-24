import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getSession } from '@/lib/session'
import { db } from '@/lib/db'
import TrueRemainingBanner from '@/components/budgets/TrueRemainingBanner'
import FixedBudgetSection from '@/components/budgets/FixedBudgetSection'
import FlexibleBudgetSection from '@/components/budgets/FlexibleBudgetSection'
import AnnualBudgetSection from '@/components/budgets/AnnualBudgetSection'
import BudgetBuilderFlow from '@/components/budget-builder/BudgetBuilderFlow'

export const metadata: Metadata = { title: 'Budgets' }

export default async function BudgetsPage() {
  const session = await getSession()
  if (!session) redirect('/login')

  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999)

  const [budgets, transactions, incomeAgg] = await Promise.all([
    db.budget.findMany({
      where: { userId: session.userId },
      include: { category: true, annualExpense: true },
      orderBy: [{ tier: 'asc' }, { amount: 'desc' }],
    }),
    // Current month's expense transactions — include category for name-based matching
    db.transaction.findMany({
      where: {
        userId: session.userId,
        date: { gte: startOfMonth, lte: endOfMonth },
        amount: { lt: 0 },
      },
      include: { category: { select: { id: true, name: true } } },
    }),
    // Current month's income for True Remaining
    db.transaction.aggregate({
      where: {
        userId: session.userId,
        date: { gte: startOfMonth, lte: endOfMonth },
        amount: { gt: 0 },
      },
      _sum: { amount: true },
    }),
  ])

  const income = incomeAgg._sum.amount ?? 0

  // Compute spent per category from this month's expense transactions.
  // Budget spent is always computed on read — never stored.
  // Build two maps: by categoryId (primary) and by category name (fallback).
  const spentByCategory = new Map<string, number>()
  const spentByCategoryName = new Map<string, number>()
  for (const tx of transactions) {
    if (tx.categoryId) {
      spentByCategory.set(
        tx.categoryId,
        (spentByCategory.get(tx.categoryId) ?? 0) + Math.abs(tx.amount)
      )
    }
    if (tx.category?.name) {
      const nameKey = tx.category.name.toLowerCase()
      spentByCategoryName.set(
        nameKey,
        (spentByCategoryName.get(nameKey) ?? 0) + Math.abs(tx.amount)
      )
    }
  }

  // Auto-reconcile: if a budget has no categoryId but we can match by name,
  // permanently link it so future reads work without fallback.
  const budgetsToReconcile: { id: string; categoryId: string }[] = []
  // Build a lookup from category name → categoryId from transactions
  const categoryNameToId = new Map<string, string>()
  for (const tx of transactions) {
    if (tx.category?.name && tx.categoryId) {
      categoryNameToId.set(tx.category.name.toLowerCase(), tx.categoryId)
    }
  }

  const budgetsWithSpent = budgets.map((b) => {
    // Primary: match by categoryId
    let spent = b.categoryId ? (spentByCategory.get(b.categoryId) ?? 0) : 0

    // Fallback: if no categoryId or no spent found, try matching by category/budget name
    if (spent === 0 && !b.categoryId) {
      // Try budget's category name (if somehow category relation exists without categoryId — unlikely but safe)
      const catName = b.category?.name?.toLowerCase()
      if (catName && spentByCategoryName.has(catName)) {
        spent = spentByCategoryName.get(catName)!
        const matchedCatId = categoryNameToId.get(catName)
        if (matchedCatId) budgetsToReconcile.push({ id: b.id, categoryId: matchedCatId })
      }
      // Try budget name as category name (e.g. budget "Groceries" → category "Groceries")
      if (spent === 0) {
        const budgetNameKey = b.name.toLowerCase()
        if (spentByCategoryName.has(budgetNameKey)) {
          spent = spentByCategoryName.get(budgetNameKey)!
          const matchedCatId = categoryNameToId.get(budgetNameKey)
          if (matchedCatId) budgetsToReconcile.push({ id: b.id, categoryId: matchedCatId })
        }
      }
      // Fuzzy: try partial match (budget "Dining Out" → category "Restaurants & Bars" won't match,
      // but "Mortgage Payment" → "Mortgage" will)
      if (spent === 0) {
        const budgetWords = b.name.toLowerCase().split(/[\s&,]+/).filter((w) => w.length > 2)
        for (const [catName, catSpent] of spentByCategoryName) {
          const catWords = catName.split(/[\s&,]+/).filter((w) => w.length > 2)
          const overlap = budgetWords.filter((w) => catWords.some((cw) => cw.includes(w) || w.includes(cw))).length
          if (overlap > 0 && overlap >= Math.min(budgetWords.length, catWords.length) * 0.5) {
            spent = catSpent
            const matchedCatId = categoryNameToId.get(catName)
            if (matchedCatId) budgetsToReconcile.push({ id: b.id, categoryId: matchedCatId })
            break
          }
        }
      }
    }

    return { ...b, spent }
  })

  // Persist reconciled categoryIds so future loads don't need fallback matching
  if (budgetsToReconcile.length > 0) {
    Promise.all(
      budgetsToReconcile.map(({ id, categoryId }) =>
        db.budget.update({ where: { id }, data: { categoryId } })
      )
    ).catch(() => { /* non-critical — silently ignore reconciliation failures */ })
  }

  const fixed = budgetsWithSpent.filter((b) => b.tier === 'FIXED')
  const flexible = budgetsWithSpent.filter((b) => b.tier === 'FLEXIBLE')
  const annual = budgetsWithSpent.filter((b) => b.tier === 'ANNUAL')

  const fixedTotal = fixed.reduce((sum, b) => sum + b.amount, 0)
  const flexibleSpent = flexible.reduce((sum, b) => sum + b.spent, 0)
  const annualSetAside = annual.reduce((sum, b) => {
    return sum + (b.annualExpense?.monthlySetAside ?? 0)
  }, 0)

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-fjord">Budgets</h1>
        <div className="flex items-center gap-2">
          {budgets.length > 0 && <BudgetBuilderFlow hasBudgets />}
          <Link href="/budgets/new" className="btn-primary">
            + New budget
          </Link>
        </div>
      </div>

      {budgets.length === 0 ? (
        <BudgetBuilderFlow hasBudgets={false} />
      ) : (
        <>
          <TrueRemainingBanner
            income={income}
            fixedTotal={fixedTotal}
            flexibleSpent={flexibleSpent}
            annualSetAside={annualSetAside}
          />

          <FixedBudgetSection budgets={fixed} transactions={transactions} />
          <FlexibleBudgetSection budgets={flexible} />
          <AnnualBudgetSection budgets={annual} />
          {annual.length > 0 && (
            <div className="-mt-5 mb-8 text-right">
              <Link
                href="/budgets/annual"
                className="text-xs font-medium text-fjord hover:text-midnight"
              >
                View full plan &rarr;
              </Link>
            </div>
          )}
        </>
      )}
    </div>
  )
}
