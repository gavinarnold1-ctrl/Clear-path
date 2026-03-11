import ProgressBar from '@/components/ui/ProgressBar'
import { formatCurrency, budgetProgress } from '@/lib/utils'

interface AnnualOverviewProps {
  totalPlanned: number
  totalFunded: number
  monthlyBurden: number
  expenseCount: number
  trueRemaining?: number
  nearTermPlanned?: number
  futurePlanned?: number
}

export default function AnnualOverview({
  totalPlanned,
  totalFunded,
  monthlyBurden,
  expenseCount,
  trueRemaining,
  nearTermPlanned,
  futurePlanned,
}: AnnualOverviewProps) {
  const fundedPct = budgetProgress(totalFunded, totalPlanned)

  return (
    <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
      <div className="card">
        <p className="text-sm font-medium text-stone">Total Planned</p>
        <p className="mt-1 text-2xl font-bold text-fjord">
          {formatCurrency(totalPlanned)}
        </p>
        <p className="mt-0.5 text-xs text-stone">
          across {expenseCount} expense{expenseCount !== 1 ? 's' : ''}
        </p>
        {nearTermPlanned !== undefined && futurePlanned !== undefined && futurePlanned > 0 && (
          <div className="mt-2 space-y-0.5 border-t border-mist pt-2 text-xs text-stone">
            <p>Next 12 months: {formatCurrency(nearTermPlanned)}</p>
            <p>Beyond: {formatCurrency(futurePlanned)}</p>
          </div>
        )}
      </div>

      <div className="card">
        <p className="text-sm font-medium text-stone">Total Funded</p>
        <p className="mt-1 text-2xl font-bold text-fjord">
          {formatCurrency(totalFunded)}{' '}
          <span className="text-sm font-normal text-stone">({fundedPct}%)</span>
        </p>
        <ProgressBar value={fundedPct} className="mt-2" />
      </div>

      <div className="card">
        <p className="text-sm font-medium text-stone">Monthly Burden</p>
        <p className="mt-1 text-2xl font-bold text-fjord">
          {formatCurrency(monthlyBurden)}
          <span className="text-sm font-normal text-stone">/mo</span>
        </p>
        {trueRemaining !== undefined && trueRemaining < monthlyBurden ? (
          <p className="mt-0.5 text-xs font-medium text-ember">
            {formatCurrency(monthlyBurden - trueRemaining)} short of target
          </p>
        ) : (
          <p className="mt-0.5 text-xs text-stone">total set-aside needed</p>
        )}
      </div>
    </div>
  )
}
