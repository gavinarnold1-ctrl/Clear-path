import { formatCurrency } from '@/lib/utils'

interface TrueRemainingProps {
  income: number
  expectedIncome: number
  fixedTotal: number
  flexibleSpent: number
  annualSetAside: number
}

export default function TrueRemainingBanner({
  income,
  expectedIncome,
  fixedTotal,
  flexibleSpent,
  annualSetAside,
}: TrueRemainingProps) {
  const displayIncome = expectedIncome > 0 ? expectedIncome : income
  const trueRemaining = displayIncome - fixedTotal - flexibleSpent - annualSetAside
  const incomeRatio = displayIncome > 0 ? trueRemaining / displayIncome : 0

  // Color coding based on remaining percentage of income
  const colorClass =
    incomeRatio > 0.2
      ? 'border-pine/30 bg-pine/10'
      : incomeRatio > 0.05
        ? 'border-birch/30 bg-birch/10'
        : 'border-ember/30 bg-ember/10'

  const amountColorClass =
    incomeRatio > 0.2
      ? 'text-pine'
      : incomeRatio > 0.05
        ? 'text-birch'
        : 'text-ember'

  return (
    <div className={`mb-6 rounded-xl border-2 p-5 ${colorClass}`}>
      <div className="mb-3 grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-4">
        <div>
          <p className="font-medium text-stone">{expectedIncome > 0 ? 'Expected Income' : 'Income'}</p>
          <p className="text-lg font-semibold text-fjord">{formatCurrency(displayIncome)}</p>
          {expectedIncome > 0 && income !== expectedIncome && (
            <p className="text-xs text-stone">{formatCurrency(income)} received</p>
          )}
        </div>
        <div>
          <p className="font-medium text-stone">Committed</p>
          <p className="text-lg font-semibold text-fjord">{formatCurrency(fixedTotal)}</p>
        </div>
        <div>
          <p className="font-medium text-stone">Flexible Spent</p>
          <p className="text-lg font-semibold text-fjord">{formatCurrency(flexibleSpent)}</p>
        </div>
        <div>
          <p className="font-medium text-stone">Annual Set-Aside</p>
          <p className="text-lg font-semibold text-fjord">{formatCurrency(annualSetAside)}</p>
        </div>
      </div>
      <div className="border-t border-mist pt-3">
        <p className="text-xs font-medium uppercase tracking-wide text-stone">True Remaining</p>
        <p className={`text-3xl font-bold ${amountColorClass}`}>
          {formatCurrency(trueRemaining)}
        </p>
      </div>
    </div>
  )
}
