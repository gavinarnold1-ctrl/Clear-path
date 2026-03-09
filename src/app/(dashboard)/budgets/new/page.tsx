import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getSession } from '@/lib/session'
import { db } from '@/lib/db'
import BudgetForm from '@/components/forms/BudgetForm'

export const metadata: Metadata = { title: 'New Budget' }

export default async function NewBudgetPage({
  searchParams,
}: {
  searchParams: Promise<{ categoryId?: string; tier?: string }>
}) {
  const session = await getSession()
  if (!session) redirect('/login')

  const params = await searchParams
  const { categoryId, tier } = params

  const categories = await db.category.findMany({
    where: { OR: [{ userId: session.userId }, { userId: null, isDefault: true }], isActive: true },
    orderBy: [{ group: 'asc' }, { name: 'asc' }],
  })

  // Build autofill values when creating a budget from an unbudgeted category
  let autofill: { categoryId: string; name: string; amount: number; tier: string } | undefined
  if (categoryId) {
    const category = categories.find((c) => c.id === categoryId)
    if (category) {
      const threeMonthsAgo = new Date()
      threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3)

      const spending = await db.transaction.aggregate({
        where: {
          userId: session.userId,
          categoryId,
          date: { gte: threeMonthsAgo },
          amount: { lt: 0 },
        },
        _sum: { amount: true },
        _count: true,
      })

      const totalSpent = Math.abs(spending._sum.amount ?? 0)
      const suggestedAmount = totalSpent > 0 ? Math.round(totalSpent / 3) : 0

      autofill = {
        categoryId,
        name: category.name,
        amount: suggestedAmount,
        tier: tier === 'FIXED' || tier === 'FLEXIBLE' ? tier : 'FIXED',
      }
    }
  }

  return (
    <div className="max-w-lg">
      <h1 className="mb-6 font-display text-2xl font-bold text-fjord">New budget</h1>
      <div className="card">
        <BudgetForm categories={categories} autofill={autofill} />
      </div>
    </div>
  )
}
