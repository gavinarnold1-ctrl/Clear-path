import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getSession } from '@/lib/session'
import { db } from '@/lib/db'
import { calculateTierSummary, tierLabel, tierDescription } from '@/lib/budget-engine'
import TierSummaryHeader from '@/components/ui/TierSummaryHeader'
import FixedBudgetCard from '@/components/ui/FixedBudgetCard'
import BudgetCard from '@/components/ui/BudgetCard'
import AnnualBudgetCard from '@/components/ui/AnnualBudgetCard'

export const metadata: Metadata = { title: 'Budgets' }

export default async function BudgetsPage() {
  const session = await getSession()
  if (!session) redirect('/login')

  const budgets = await db.budget.findMany({
    where: { userId: session.userId },
    include: { category: true, annualExpense: true },
    orderBy: { startDate: 'desc' },
  })

  const fixed = budgets.filter((b) => b.tier === 'FIXED')
  const flexible = budgets.filter((b) => b.tier === 'FLEXIBLE')
  const annual = budgets.filter((b) => b.tier === 'ANNUAL')

  const summary = calculateTierSummary(
    budgets.map((b) => ({
      tier: b.tier as 'FIXED' | 'FLEXIBLE' | 'ANNUAL',
      amount: b.amount,
      spent: b.spent,
      annualExpense: b.annualExpense
        ? {
            monthlySetAside: b.annualExpense.monthlySetAside,
            annualAmount: b.annualExpense.annualAmount,
            funded: b.annualExpense.funded,
          }
        : null,
    }))
  )

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
          <TierSummaryHeader summary={summary} />

          {/* Fixed tier */}
          {fixed.length > 0 && (
            <section className="mb-8">
              <div className="mb-3">
                <h2 className="text-lg font-semibold text-gray-900">{tierLabel('FIXED')}</h2>
                <p className="text-sm text-gray-500">{tierDescription('FIXED')}</p>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {fixed.map((budget) => (
                  <FixedBudgetCard key={budget.id} budget={budget} />
                ))}
              </div>
            </section>
          )}

          {/* Flexible tier */}
          {flexible.length > 0 && (
            <section className="mb-8">
              <div className="mb-3">
                <h2 className="text-lg font-semibold text-gray-900">{tierLabel('FLEXIBLE')}</h2>
                <p className="text-sm text-gray-500">{tierDescription('FLEXIBLE')}</p>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {flexible.map((budget) => (
                  <BudgetCard key={budget.id} budget={budget} />
                ))}
              </div>
            </section>
          )}

          {/* Annual tier */}
          {annual.length > 0 && (
            <section className="mb-8">
              <div className="mb-3">
                <h2 className="text-lg font-semibold text-gray-900">{tierLabel('ANNUAL')}</h2>
                <p className="text-sm text-gray-500">{tierDescription('ANNUAL')}</p>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {annual.map((budget) => (
                  <AnnualBudgetCard key={budget.id} budget={budget} />
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  )
}
