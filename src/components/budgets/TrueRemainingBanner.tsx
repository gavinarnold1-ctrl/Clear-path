import { formatCurrency } from '@/lib/utils'

interface TrueRemainingProps {
  income: number
  fixedTotal: number
  flexibleSpent: number
  annualSetAside: number
}

export default function TrueRemainingBanner({
  income,
  fixedTotal,
  flexibleSpent,
  annualSetAside,
}: TrueRemainingProps) {
  const trueRemaining = income - fixedTotal - flexibleSpent - annualSetAside
  const incomeRatio = income > 0 ? trueRemaining / income : 0

  // Color coding based on remaining percentage of income
  const colorClass =
    incomeRatio > 0.2
      ? 'border-green-200 bg-green-50'
      : incomeRatio > 0.05
        ? 'border-amber-200 bg-amber-50'
        : 'border-red-200 bg-red-50'

  const amountColorClass =
    incomeRatio > 0.2
      ? 'text-green-700'
      : incomeRatio > 0.05
        ? 'text-amber-700'
        : 'text-red-700'

  return (
    <div className={`mb-6 rounded-xl border-2 p-5 ${colorClass}`}>
      <div className="mb-3 grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-4">
        <div>
          <p className="font-medium text-gray-500">Income</p>
          <p className="text-lg font-semibold text-gray-900">{formatCurrency(income)}</p>
        </div>
        <div>
          <p className="font-medium text-gray-500">Committed</p>
          <p className="text-lg font-semibold text-gray-900">{formatCurrency(fixedTotal)}</p>
        </div>
        <div>
          <p className="font-medium text-gray-500">Flexible Spent</p>
          <p className="text-lg font-semibold text-gray-900">{formatCurrency(flexibleSpent)}</p>
        </div>
        <div>
          <p className="font-medium text-gray-500">Annual Set-Aside</p>
          <p className="text-lg font-semibold text-gray-900">{formatCurrency(annualSetAside)}</p>
        </div>
      </div>
      <div className="border-t border-gray-200 pt-3">
        <p className="text-xs font-medium uppercase tracking-wide text-gray-500">True Remaining</p>
        <p className={`text-3xl font-bold ${amountColorClass}`}>
          {formatCurrency(trueRemaining)}
        </p>
      </div>
    </div>
  )
}
