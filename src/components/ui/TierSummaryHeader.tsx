import { formatCurrency } from '@/lib/utils'
import type { TierSummary } from '@/lib/budget-engine'

export default function TierSummaryHeader({ summary }: { summary: TierSummary }) {
  return (
    <div className="card mb-6 grid grid-cols-1 gap-4 sm:grid-cols-4">
      <div>
        <p className="text-sm font-medium text-stone">Monthly obligation</p>
        <p className="mt-1 text-2xl font-bold text-midnight">
          {formatCurrency(summary.totalMonthlyObligation)}
        </p>
      </div>
      <div className="border-l-2 border-l-fjord pl-3">
        <p className="text-sm font-medium text-stone">Fixed bills</p>
        <p className="mt-1 text-xl font-semibold text-fjord">
          {formatCurrency(summary.fixed.total)}
        </p>
        <p className="text-xs text-stone">
          {summary.fixed.paidCount}/{summary.fixed.totalCount} paid
        </p>
      </div>
      <div className="border-l-2 border-l-ember pl-3">
        <p className="text-sm font-medium text-stone">Flexible spending</p>
        <p className="mt-1 text-xl font-semibold text-fjord">
          {formatCurrency(summary.flexible.budgeted)}
        </p>
        <p className="text-xs text-stone">
          {formatCurrency(summary.flexible.remaining)} remaining
        </p>
      </div>
      <div className="border-l-2 border-l-birch pl-3">
        <p className="text-sm font-medium text-stone">Annual set-aside</p>
        <p className="mt-1 text-xl font-semibold text-fjord">
          {formatCurrency(summary.annual.monthlySetAside)}
        </p>
        <p className="text-xs text-stone">
          {formatCurrency(summary.annual.totalFunded)} of {formatCurrency(summary.annual.totalAnnual)} funded
        </p>
      </div>
    </div>
  )
}
