import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = { title: 'Budgets' }

export default function BudgetsPage() {
  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Budgets</h1>
        <Link href="/budgets/new" className="btn-primary">
          + New budget
        </Link>
      </div>

      {/* Budget cards grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {/* Placeholder — replace with real budget cards */}
        <div className="card flex flex-col items-center justify-center py-10 text-center">
          <p className="mb-2 text-sm font-medium text-gray-500">No budgets yet</p>
          <p className="text-xs text-gray-400">Create your first budget to start tracking spending.</p>
        </div>
      </div>
    </div>
  )
}
