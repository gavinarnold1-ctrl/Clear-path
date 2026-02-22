import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getSession } from '@/lib/session'
import { db } from '@/lib/db'
import TrueRemainingBanner from '@/components/budgets/TrueRemainingBanner'
import FixedBudgetSection from '@/components/budgets/FixedBudgetSection'
import FlexibleBudgetSection from '@/components/budgets/FlexibleBudgetSection'
import AnnualBudgetSection from '@/components/budgets/AnnualBudgetSection'

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

  const fixed = budgets.filter((b) => b.tier === 'FIXED')
  const flexible = budgets.filter((b) => b.tier === 'FLEXIBLE')
  const annual = budgets.filter((b) => b.tier === 'ANNUAL')

  const fixedTotal = fixed.reduce((sum, b) => sum + b.amount, 0)
  const flexibleSpent = flexible.reduce((sum, b) => sum + b.spent, 0)
  const annualSetAside = annual.reduce((sum, b) => {
    return sum + (b.annualExpense?.monthlySetAside ?? 0)
  }, 0)

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Budgets</h1>
        <Link href="/budgets/new" className="btn-primary">
          + New budget
        </Link>
      </div>

      {budgets.length === 0 ? (
        <div className="card flex flex-col items-center justify-center py-16 text-center">
          <p className="mb-2 text-sm font-medium text-gray-500">No budgets yet</p>
          <p className="mb-4 text-xs text-gray-400">
            Create a budget to start tracking how much you spend in each category.
          </p>
          <Link href="/budgets/new" className="btn-primary inline-block">
            + New budget
          </Link>
        </div>
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
                className="text-xs font-medium text-sky-600 hover:text-sky-700"
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
