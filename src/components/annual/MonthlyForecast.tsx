import { formatCurrency } from '@/lib/utils'
import ForecastBar from './ForecastBar'

const MONTH_LABELS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
]

interface ForecastExpense {
  id: string
  name: string
  annualAmount: number
  dueMonth: number
  dueYear: number
  computedStatus: string
  status: string
}

interface Props {
  expenses: ForecastExpense[]
  monthlySetAside: number
}

export default function MonthlyForecast({ expenses, monthlySetAside }: Props) {
  const currentMonth = new Date().getMonth()
  const currentYear = new Date().getFullYear()

  // Group active expenses by month for the current year
  const activeExpenses = expenses.filter(
    (e) => e.status !== 'spent' && e.status !== 'overspent'
  )

  const byMonth: ForecastExpense[][] = Array.from({ length: 12 }, () => [])
  for (const exp of activeExpenses) {
    if (exp.dueYear === currentYear && exp.dueMonth >= 1 && exp.dueMonth <= 12) {
      byMonth[exp.dueMonth - 1].push(exp)
    }
  }

  const monthTotals = byMonth.map((exps) =>
    exps.reduce((s, e) => s + e.annualAmount, 0)
  )
  const maxAmount = Math.max(...monthTotals, 1)
  const maxBarHeight = 120

  return (
    <div className="card mb-6">
      <h2 className="mb-4 text-lg font-semibold text-fjord">
        {currentYear} Forecast
      </h2>

      <div className="grid grid-cols-12 gap-1">
        {MONTH_LABELS.map((label, i) => (
          <ForecastBar
            key={label}
            monthLabel={label}
            expenses={byMonth[i]}
            maxAmount={maxAmount}
            maxBarHeight={maxBarHeight}
            isCurrent={i === currentMonth}
          />
        ))}
      </div>

      {/* Set-aside reference line */}
      {monthlySetAside > 0 && (
        <div className="mt-3 flex items-center gap-2">
          <div className="h-px flex-1 border-t border-dashed border-mist" />
          <span className="text-xs text-stone">
            {formatCurrency(monthlySetAside)}/mo set-aside
          </span>
          <div className="h-px flex-1 border-t border-dashed border-mist" />
        </div>
      )}
    </div>
  )
}
