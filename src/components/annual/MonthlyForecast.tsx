import { formatCurrency } from '@/lib/utils'
import ForecastBar from './ForecastBar'

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

function formatMonthLabel(d: Date, currentYear: number): string {
  const month = d.toLocaleDateString('en-US', { month: 'short' })
  return d.getFullYear() !== currentYear
    ? `${month} '${String(d.getFullYear()).slice(2)}`
    : month
}

export default function MonthlyForecast({ expenses, monthlySetAside }: Props) {
  const now = new Date()
  const currentYear = now.getFullYear()

  // Build rolling 12-month slots starting from the current month
  const months = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(currentYear, now.getMonth() + i, 1)
    return {
      month: d.getMonth() + 1,
      year: d.getFullYear(),
      label: formatMonthLabel(d, currentYear),
    }
  })

  const activeExpenses = expenses.filter(
    (e) => e.status !== 'spent' && e.status !== 'overspent'
  )

  // Match expenses to slots by (month, year) pair
  const bySlot: ForecastExpense[][] = months.map((slot) =>
    activeExpenses.filter((e) => e.dueMonth === slot.month && e.dueYear === slot.year)
  )

  const monthTotals = bySlot.map((exps) =>
    exps.reduce((s, e) => s + e.annualAmount, 0)
  )
  const maxAmount = Math.max(...monthTotals, 1)
  const maxBarHeight = 120

  // Find expenses beyond the 12-month window
  const lastSlot = months[months.length - 1]
  const beyondExpenses = activeExpenses.filter((e) => {
    const expDate = new Date(e.dueYear, e.dueMonth - 1, 1)
    const windowEnd = new Date(lastSlot.year, lastSlot.month - 1, 1)
    return expDate > windowEnd
  })

  const startLabel = months[0].label
  const endLabel = months[months.length - 1].label

  return (
    <div className="card mb-6">
      <div className="mb-4 flex items-baseline justify-between">
        <h2 className="font-display text-lg font-semibold text-fjord">
          Rolling forecast
        </h2>
        <span className="text-xs text-stone">{startLabel} – {endLabel}</span>
      </div>

      <div className="grid grid-cols-12 gap-1">
        {months.map((slot, i) => (
          <ForecastBar
            key={`${slot.year}-${slot.month}`}
            monthLabel={slot.label}
            expenses={bySlot[i]}
            maxAmount={maxAmount}
            maxBarHeight={maxBarHeight}
            isCurrent={i === 0}
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

      {/* Beyond-window indicator */}
      {beyondExpenses.length > 0 && (
        <div className="mt-3 text-center text-xs text-stone">
          + {beyondExpenses.length} expense{beyondExpenses.length !== 1 ? 's' : ''} beyond this view
          {' '}(next: {beyondExpenses[0].name},{' '}
          {new Date(beyondExpenses[0].dueYear, beyondExpenses[0].dueMonth - 1).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })})
        </div>
      )}
    </div>
  )
}
