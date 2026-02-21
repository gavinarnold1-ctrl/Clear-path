import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Overview' }

// Placeholder stat card — replace with real data once API routes are wired up
function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="card">
      <p className="text-sm font-medium text-gray-500">{label}</p>
      <p className="mt-1 text-3xl font-bold text-gray-900">{value}</p>
      {sub && <p className="mt-1 text-xs text-gray-400">{sub}</p>}
    </div>
  )
}

export default function DashboardPage() {
  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-gray-900">Overview</h1>

      {/* Summary stats */}
      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Total balance" value="$0.00" sub="across all accounts" />
        <StatCard label="Income this month" value="$0.00" />
        <StatCard label="Expenses this month" value="$0.00" />
      </div>

      {/* Recent transactions placeholder */}
      <div className="card">
        <h2 className="mb-4 text-base font-semibold text-gray-900">Recent transactions</h2>
        <p className="text-sm text-gray-400">No transactions yet. Add one to get started.</p>
      </div>
    </div>
  )
}
