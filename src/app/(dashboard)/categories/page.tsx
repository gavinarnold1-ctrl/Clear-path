import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getSession } from '@/lib/session'
import { db } from '@/lib/db'
import { deleteCategory } from '@/app/actions/categories'

export const metadata: Metadata = { title: 'Categories' }

const TYPE_BADGE: Record<string, string> = {
  INCOME: 'bg-green-100 text-green-700',
  EXPENSE: 'bg-red-100 text-red-700',
  TRANSFER: 'bg-amber-100 text-amber-700',
}

export default async function CategoriesPage() {
  const session = await getSession()
  if (!session) redirect('/login')

  const categories = await db.category.findMany({
    where: { OR: [{ userId: session.userId }, { userId: null, isDefault: true }], isActive: true },
    orderBy: [{ group: 'asc' }, { type: 'asc' }, { name: 'asc' }],
  })

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Categories</h1>
        <Link href="/categories/new" className="btn-primary">
          + New category
        </Link>
      </div>

      {categories.length === 0 ? (
        <div className="card py-16 text-center">
          <p className="mb-2 text-sm font-medium text-gray-500">No categories yet</p>
          <p className="mb-4 text-xs text-gray-400">
            Add categories to organise your transactions and budgets.
          </p>
          <Link href="/categories/new" className="btn-primary inline-block">
            + New category
          </Link>
        </div>
      ) : (
        <div className="card overflow-hidden p-0">
          <table className="w-full text-sm">
            <thead className="border-b border-gray-100 bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Name</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Group</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Type</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Color</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {categories.map((cat) => (
                <tr key={cat.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">
                    {cat.icon && <span className="mr-2">{cat.icon}</span>}
                    {cat.name}
                  </td>
                  <td className="px-4 py-3 text-gray-500">{cat.group}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${TYPE_BADGE[cat.type] ?? ''}`}
                    >
                      {cat.type}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className="inline-block h-4 w-4 rounded-full"
                      style={{ backgroundColor: cat.color }}
                      aria-label={cat.color}
                    />
                  </td>
                  <td className="px-4 py-3 text-right">
                    {cat.userId && (
                      <form
                        action={async () => {
                          'use server'
                          await deleteCategory(cat.id)
                        }}
                      >
                        <button
                          type="submit"
                          className="text-xs text-gray-400 hover:text-red-500"
                          aria-label={`Delete ${cat.name}`}
                        >
                          Delete
                        </button>
                      </form>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="border-t border-gray-100 px-4 py-2 text-right text-xs text-gray-400">
            {categories.length} categor{categories.length !== 1 ? 'ies' : 'y'}
          </p>
        </div>
      )}
    </div>
  )
}
