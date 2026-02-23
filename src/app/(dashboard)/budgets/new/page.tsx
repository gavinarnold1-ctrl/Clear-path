import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getSession } from '@/lib/session'
import { db } from '@/lib/db'
import BudgetForm from '@/components/forms/BudgetForm'

export const metadata: Metadata = { title: 'New Budget' }

export default async function NewBudgetPage() {
  const session = await getSession()
  if (!session) redirect('/login')

  const categories = await db.category.findMany({
    where: { OR: [{ userId: session.userId }, { userId: null, isDefault: true }], isActive: true },
    orderBy: [{ group: 'asc' }, { name: 'asc' }],
  })

  return (
    <div className="max-w-lg">
      <h1 className="mb-6 text-2xl font-bold text-fjord">New budget</h1>
      <div className="card">
        <BudgetForm categories={categories} />
      </div>
    </div>
  )
}
