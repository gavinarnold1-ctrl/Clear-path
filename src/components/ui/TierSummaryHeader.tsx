import { formatCurrency } from '@/lib/utils'
import type { TierSummary } from '@/lib/budget-engine'

export default function TierSummaryHeader({ summary }: { summary: TierSummary }) {
  return (
    <div className="card mb-6 grid grid-cols-1 gap-4 sm:grid-cols-4">
      <div>
        <p className="text-sm font-medium text-gray-500">Monthly obligation</p>
        <p className="mt-1 text-2xl font-bold text-gray-900">
          {formatCurrency(summary.totalMonthlyObligation)}
        </p>
      </div>
      <div>
        <p className="text-sm font-medium text-gray-500">Fixed bills</p>
        <p className="mt-1 text-xl font-semibold text-gray-900">
          {formatCurrency(summary.fixed.total)}
        </p>
        <p className="text-xs text-gray-400">
          {summary.fixed.paidCount}/{summary.fixed.totalCount} paid
        </p>
      </div>
      <div>
        <p className="text-sm font-medium text-gray-500">Flexible spending</p>
        <p className="mt-1 text-xl font-semibold text-gray-900">
          {formatCurrency(summary.flexible.budgeted)}
        </p>
        <p className="text-xs text-gray-400">
          {formatCurrency(summary.flexible.remaining)} remaining
        </p>
      </div>
      <div>
        <p className="text-sm font-medium text-gray-500">Annual set-aside</p>
        <p className="mt-1 text-xl font-semibold text-gray-900">
          {formatCurrency(summary.annual.monthlySetAside)}
        </p>
        <p className="text-xs text-gray-400">
          {formatCurrency(summary.annual.totalFunded)} of {formatCurrency(summary.annual.totalAnnual)} funded
        </p>
      </div>
    </div>
  )
}
