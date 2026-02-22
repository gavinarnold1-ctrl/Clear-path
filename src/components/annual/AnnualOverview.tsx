import ProgressBar from '@/components/ui/ProgressBar'
import { formatCurrency, budgetProgress } from '@/lib/utils'

interface AnnualOverviewProps {
  totalPlanned: number
  totalFunded: number
  monthlyBurden: number
  expenseCount: number
}

export default function AnnualOverview({
  totalPlanned,
  totalFunded,
  monthlyBurden,
  expenseCount,
}: AnnualOverviewProps) {
  const fundedPct = budgetProgress(totalFunded, totalPlanned)

  return (
    <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
      <div className="card">
        <p className="text-sm font-medium text-gray-500">Total Planned</p>
        <p className="mt-1 text-2xl font-bold text-gray-900">
          {formatCurrency(totalPlanned)}
        </p>
        <p className="mt-0.5 text-xs text-gray-400">
          across {expenseCount} expense{expenseCount !== 1 ? 's' : ''}
        </p>
      </div>

      <div className="card">
        <p className="text-sm font-medium text-gray-500">Total Funded</p>
        <p className="mt-1 text-2xl font-bold text-gray-900">
          {formatCurrency(totalFunded)}{' '}
          <span className="text-sm font-normal text-gray-400">({fundedPct}%)</span>
        </p>
        <ProgressBar value={fundedPct} className="mt-2" />
      </div>

      <div className="card">
        <p className="text-sm font-medium text-gray-500">Monthly Burden</p>
        <p className="mt-1 text-2xl font-bold text-gray-900">
          {formatCurrency(monthlyBurden)}
          <span className="text-sm font-normal text-gray-400">/mo</span>
        </p>
        <p className="mt-0.5 text-xs text-gray-400">total set-aside needed</p>
      </div>
    </div>
  )
}
