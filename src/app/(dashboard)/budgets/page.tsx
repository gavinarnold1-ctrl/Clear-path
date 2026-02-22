import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getSession } from '@/lib/session'
import { db } from '@/lib/db'
import BudgetCard from '@/components/ui/BudgetCard'

export const metadata: Metadata = { title: 'Budgets' }

export default async function BudgetsPage() {
  const session = await getSession()
  if (!session) redirect('/login')

  const budgets = await db.budget.findMany({
    where: { userId: session.userId },
    include: { category: true },
    orderBy: { startDate: 'desc' },
  })

  // Calculate spent from actual transactions for each budget
  const budgetsWithSpent = await Promise.all(
    budgets.map(async (budget) => {
      const dateFilter = {
        gte: budget.startDate,
        ...(budget.endDate ? { lte: budget.endDate } : {}),
      }

      const agg = await db.transaction.aggregate({
        where: {
          userId: session.userId,
          amount: { lt: 0 },
          date: dateFilter,
          ...(budget.categoryId ? { categoryId: budget.categoryId } : {}),
        },
        _sum: { amount: true },
      })

      return { ...budget, spent: Math.abs(agg._sum.amount ?? 0) }
    })
  )

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Budgets</h1>
        <Link href="/budgets/new" className="btn-primary">
          + New budget
        </Link>
      </div>

      {budgetsWithSpent.length === 0 ? (
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
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {budgetsWithSpent.map((budget) => (
            <BudgetCard key={budget.id} budget={budget} />
          ))}
        </div>
      )}
    </div>
  )
}
