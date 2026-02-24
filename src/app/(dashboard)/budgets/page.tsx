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
    // Current month's expense transactions for fixed status detection
    db.transaction.findMany({
      where: {
        userId: session.userId,
        date: { gte: startOfMonth, lte: endOfMonth },
        amount: { lt: 0 },
      },
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
  const spentByCategory = new Map<string, number>()
  for (const tx of transactions) {
    if (tx.categoryId) {
      spentByCategory.set(
        tx.categoryId,
        (spentByCategory.get(tx.categoryId) ?? 0) + Math.abs(tx.amount)
      )
    }
  }

  const budgetsWithSpent = budgets.map((b) => ({
    ...b,
    spent: b.categoryId ? (spentByCategory.get(b.categoryId) ?? 0) : 0,
  }))

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
