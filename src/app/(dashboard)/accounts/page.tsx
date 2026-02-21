import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = { title: 'Accounts' }

export default function AccountsPage() {
  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Accounts</h1>
        <Link href="/accounts/new" className="btn-primary">
          + Add account
        </Link>
      </div>

      {/* Account list */}
      <div className="space-y-3">
        <div className="card text-center py-10">
          <p className="text-sm font-medium text-gray-500">No accounts yet</p>
          <p className="mt-1 text-xs text-gray-400">Add a checking, savings, or credit account to start tracking.</p>
        </div>
      </div>
    </div>
  )
}
