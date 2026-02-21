import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = { title: 'Transactions' }

export default function TransactionsPage() {
  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Transactions</h1>
        <Link href="/transactions/new" className="btn-primary">
          + Add transaction
        </Link>
      </div>

      {/* Filters */}
      <div className="mb-4 flex flex-wrap gap-2">
        <select className="input w-auto" aria-label="Filter by type">
          <option value="">All types</option>
          <option value="INCOME">Income</option>
          <option value="EXPENSE">Expense</option>
          <option value="TRANSFER">Transfer</option>
        </select>
        <select className="input w-auto" aria-label="Filter by account">
          <option value="">All accounts</option>
        </select>
        <input type="month" className="input w-auto" aria-label="Filter by month" />
      </div>

      {/* Transaction list */}
      <div className="card">
        <p className="text-sm text-gray-400">No transactions yet. Add one above to get started.</p>
      </div>
    </div>
  )
}
