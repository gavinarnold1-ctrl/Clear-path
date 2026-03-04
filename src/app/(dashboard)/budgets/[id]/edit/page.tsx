import type { Metadata } from 'next'
import { redirect, notFound } from 'next/navigation'
import { getSession } from '@/lib/session'
import { db } from '@/lib/db'
import BudgetForm from '@/components/forms/BudgetForm'

export const metadata: Metadata = { title: 'Edit Budget' }

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function EditBudgetPage({ params }: PageProps) {
  const session = await getSession()
  if (!session) redirect('/login')

  const { id } = await params

  const [budget, categories] = await Promise.all([
    db.budget.findFirst({
      where: { id, userId: session.userId },
      include: { category: true },
    }),
    db.category.findMany({
      where: { OR: [{ userId: session.userId }, { userId: null, isDefault: true }], isActive: true },
      orderBy: [{ group: 'asc' }, { name: 'asc' }],
    }),
  ])

  if (!budget) notFound()

  // Annual budgets are edited via the annual dashboard, not this form
  if (budget.tier === 'ANNUAL') redirect('/budgets/annual')

  const initialBudget = {
    id: budget.id,
    name: budget.name,
    amount: budget.amount,
    tier: budget.tier,
    period: budget.period,
    categoryId: budget.categoryId,
    startDate: budget.startDate.toISOString().split('T')[0],
    endDate: budget.endDate ? budget.endDate.toISOString().split('T')[0] : null,
    dueDay: budget.dueDay,
    isAutoPay: budget.isAutoPay,
    varianceLimit: budget.varianceLimit,
  }

  return (
    <div className="max-w-lg">
      <h1 className="mb-6 text-2xl font-bold text-fjord">Edit budget</h1>
      <div className="card">
        <BudgetForm categories={categories} initialBudget={initialBudget} />
      </div>
    </div>
  )
}
