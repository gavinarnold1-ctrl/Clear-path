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

export default function FundingProjection({
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

  // Group by horizon
  const urgent: ProjectionExpense[] = []   // ≤ 3 months
  const planning: ProjectionExpense[] = [] // 4–12 months
  const future: ProjectionExpense[] = []   // 12+ months

  for (const exp of active) {
    if (exp.monthsRemaining <= 3) {
      urgent.push(exp)
    } else if (exp.monthsRemaining <= 12) {
      planning.push(exp)
    } else {
      future.push(exp)
    }
  }

  function renderExpense(exp: ProjectionExpense, isFuture: boolean) {
    const proj = calculateProjection(exp)
    return (
      <li key={exp.id} className={`flex items-start gap-2 text-sm ${isFuture ? 'text-stone' : ''}`}>
        <span className={`mt-0.5 shrink-0 ${proj.onTrack ? 'text-pine' : 'text-ember'}`}>
          {proj.onTrack ? '\u2713' : '\u2717'}
        </span>
        <div>
          <span className={isFuture ? 'text-stone' : 'text-fjord'}>
            {exp.name} &mdash;{' '}
            {isFuture ? (
              <>
                due {formatMonthName(exp.dueMonth)} {exp.dueYear} &middot;{' '}
                <span className="text-pine">{formatCurrency(exp.currentSetAside)}/mo</span> set-aside starting now
              </>
            ) : (
              <>
                funded by {formatMonthName(proj.month + 1)} {proj.year}
              </>
            )}
          </span>
          {!proj.onTrack && !isFuture && (
            <span className="ml-1 text-xs text-ember">
              (due {formatMonthName(exp.dueMonth)} {exp.dueYear})
            </span>
          )}
        </div>
      </li>
    )
  }

  return (
    <div className="card">
      <h2 className="mb-3 font-display text-lg font-semibold text-fjord">Funding timeline</h2>
      <p className="mb-3 text-sm text-stone">
        If you maintain {formatCurrency(monthlyBurden)}/mo set-aside:
      </p>

      <div className="space-y-4">
        {urgent.length > 0 && (
          <div>
            <p className="mb-1.5 text-xs font-semibold text-ember">
              Next 3 months &middot; {urgent.length} expense{urgent.length !== 1 ? 's' : ''}
            </p>
            <ul className="space-y-2">
              {urgent.map((exp) => renderExpense(exp, false))}
            </ul>
          </div>
        )}

        {planning.length > 0 && (
          <div>
            <p className="mb-1.5 text-xs font-semibold text-stone">
              3–12 months &middot; {planning.length} expense{planning.length !== 1 ? 's' : ''}
            </p>
            <ul className="space-y-2">
              {planning.map((exp) => renderExpense(exp, false))}
            </ul>
          </div>
        )}

        {future.length > 0 && (
          <div>
            <p className="mb-1.5 text-xs font-semibold text-stone">
              12+ months &middot; {future.length} expense{future.length !== 1 ? 's' : ''}
            </p>
            <ul className="space-y-2 opacity-80">
              {future.map((exp) => renderExpense(exp, true))}
            </ul>
          </div>
        )}
      </div>

      <div className="mt-3 border-t border-mist pt-3 text-sm text-stone">
        Total annual spend: {formatCurrency(totalAnnual)}
      </div>
    </div>
  )
}
