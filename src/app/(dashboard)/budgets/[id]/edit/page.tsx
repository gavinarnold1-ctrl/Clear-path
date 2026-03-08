import type { Metadata } from 'next'
import { redirect, notFound } from 'next/navigation'
import { getSession } from '@/lib/session'
import { db } from '@/lib/db'
import BudgetForm from '@/components/forms/BudgetForm'
import type { GoalTarget } from '@/types'

export const metadata: Metadata = { title: 'Edit Budget' }

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function EditBudgetPage({ params }: PageProps) {
  const session = await getSession()
  if (!session) redirect('/login')

  const { id } = await params

  const [budget, categories, allBudgets, profile] = await Promise.all([
    db.budget.findFirst({
      where: { id, userId: session.userId },
      include: { category: true },
    }),
    db.category.findMany({
      where: { OR: [{ userId: session.userId }, { userId: null, isDefault: true }], isActive: true },
      orderBy: [{ group: 'asc' }, { name: 'asc' }],
    }),
    db.budget.findMany({
      where: { userId: session.userId },
      include: { annualExpense: true },
    }),
    db.userProfile.findUnique({
      where: { userId: session.userId },
      select: { expectedMonthlyIncome: true, goalTarget: true },
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

  // Compute current surplus for goal impact preview
  const goalTarget = profile?.goalTarget as GoalTarget | null
  let currentSurplus: number | undefined
  if (goalTarget && profile?.expectedMonthlyIncome) {
    const totalBudgeted = allBudgets.reduce((sum, b) => {
      if (b.tier === 'ANNUAL') return sum + (b.annualExpense?.monthlySetAside ?? 0)
      return sum + b.amount
    }, 0)
    currentSurplus = profile.expectedMonthlyIncome - totalBudgeted
  }

  return (
    <div className="max-w-lg">
      <h1 className="mb-6 font-display text-2xl font-bold text-fjord">Edit budget</h1>
      <div className="card">
        <BudgetForm
          categories={categories}
          initialBudget={initialBudget}
          goalTarget={goalTarget ?? undefined}
          currentSurplus={currentSurplus}
        />
      </div>
    </div>
  )
}
