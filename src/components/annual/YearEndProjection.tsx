import { formatCurrency } from '@/lib/utils'
import { formatMonthName } from '@/lib/budget-engine'

interface ProjectionExpense {
  id: string
  name: string
  annualAmount: number
  funded: number
  dueMonth: number
  dueYear: number
  currentSetAside: number
  monthsRemaining: number
  status: string
}

function calculateProjection(expense: ProjectionExpense) {
  if (expense.funded >= expense.annualAmount) {
    const now = new Date()
    return { month: now.getMonth(), year: now.getFullYear(), onTrack: true }
  }

  const remaining = expense.annualAmount - expense.funded
  if (expense.currentSetAside <= 0) {
    return { month: expense.dueMonth - 1, year: expense.dueYear, onTrack: false }
  }

  const monthsToFund = Math.ceil(remaining / expense.currentSetAside)
  const now = new Date()
  const projectedDate = new Date(now.getFullYear(), now.getMonth() + monthsToFund, 1)
  const dueDate = new Date(expense.dueYear, expense.dueMonth - 1, 1)

  return {
    month: projectedDate.getMonth(),
    year: projectedDate.getFullYear(),
    onTrack: projectedDate <= dueDate,
  }
}

export default function YearEndProjection({
  expenses,
  monthlyBurden,
}: {
  expenses: ProjectionExpense[]
  monthlyBurden: number
}) {
  const active = expenses.filter(
    (e) => e.status !== 'spent' && e.status !== 'overspent'
  )
  if (active.length === 0) return null

  const totalAnnual = active.reduce((s, e) => s + e.annualAmount, 0)

  return (
    <div className="card">
      <h2 className="mb-3 font-display text-lg font-semibold text-fjord">Year-End Projection</h2>
      <p className="mb-3 text-sm text-stone">
        If you maintain {formatCurrency(monthlyBurden)}/mo set-aside:
      </p>
      <ul className="space-y-2">
        {active.map((exp) => {
          const proj = calculateProjection(exp)
          return (
            <li key={exp.id} className="flex items-center gap-2 text-sm">
              <span className={proj.onTrack ? 'text-pine' : 'text-ember'}>
                {proj.onTrack ? '\u2713' : '\u2717'}
              </span>
              <span className="text-fjord">
                {exp.name} &mdash; funded by {formatMonthName(proj.month + 1)} {proj.year}
              </span>
              {!proj.onTrack && (
                <span className="text-xs text-ember">
                  (due {formatMonthName(exp.dueMonth)} {exp.dueYear})
                </span>
              )}
            </li>
          )
        })}
      </ul>
      <div className="mt-3 border-t border-mist pt-3 text-sm text-stone">
        Total annual spend: {formatCurrency(totalAnnual)}
      </div>
    </div>
  )
}
