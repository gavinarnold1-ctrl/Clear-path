import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getSession } from '@/lib/session'
import { db } from '@/lib/db'
import CategoryManager from '@/components/categories/CategoryManager'

export const metadata: Metadata = { title: 'Categories' }

export default async function CategoriesPage() {
  const session = await getSession()
  if (!session) redirect('/login')

  const [categories, txCounts] = await Promise.all([
    db.category.findMany({
      where: {
        OR: [{ userId: session.userId }, { userId: null, isDefault: true }],
        isActive: true,
      },
      orderBy: [{ group: 'asc' }, { type: 'asc' }, { name: 'asc' }],
    }),
    db.transaction.groupBy({
      by: ['categoryId'],
      where: { userId: session.userId },
      _count: { id: true },
    }),
  ])

  const countMap = new Map(
    txCounts
      .filter(r => r.categoryId !== null)
      .map(r => [r.categoryId as string, r._count.id])
  )

  const serialized = categories.map(cat => ({
    id: cat.id,
    name: cat.name,
    group: cat.group,
    type: cat.type,
    icon: cat.icon,
    isDefault: cat.isDefault,
    userId: cat.userId,
    txCount: countMap.get(cat.id) ?? 0,
  }))

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-fjord">Categories</h1>
        <Link href="/categories/new" className="btn-primary">
          + New category
        </Link>
      </div>

      {categories.length === 0 ? (
        <div className="card py-16 text-center">
          <p className="mb-2 text-sm font-medium text-stone">No categories yet</p>
          <p className="mb-4 text-xs text-stone">
            Add categories to organise your transactions and budgets.
          </p>
          <Link href="/categories/new" className="btn-primary inline-block">
            + New category
          </Link>
        </div>
      ) : (
        <CategoryManager categories={serialized} />
      )}
    </div>
  )
}
