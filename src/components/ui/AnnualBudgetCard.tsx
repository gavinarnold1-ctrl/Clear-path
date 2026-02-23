import ProgressBar from './ProgressBar'
import { formatCurrency, budgetProgress } from '@/lib/utils'
import { formatMonthName } from '@/lib/budget-engine'
import { deleteBudget } from '@/app/actions/budgets'

interface AnnualExpense {
  annualAmount: number
  dueMonth: number
  dueYear: number
  monthlySetAside: number
  funded: number
  status: string
  isRecurring: boolean
}

interface AnnualBudget {
  id: string
  name: string
  category: { name: string; icon: string | null } | null
  annualExpense: AnnualExpense | null
}

export default function AnnualBudgetCard({ budget }: { budget: AnnualBudget }) {
  const ae = budget.annualExpense
  if (!ae) return null

  const pct = budgetProgress(ae.funded, ae.annualAmount)

  const STATUS_STYLES: Record<string, string> = {
    planned: 'bg-blue-100 text-blue-700',
    funded: 'bg-pine/10 text-green-700',
    spent: 'bg-mist text-fjord',
    overspent: 'bg-ember/10 text-red-700',
  }

  return (
    <div className="card flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-semibold text-fjord">{budget.name}</p>
          {budget.category && (
            <p className="flex items-center gap-1.5 text-xs text-stone">
              {budget.category.icon && (
                <span className="inline-block text-sm">{budget.category.icon}</span>
              )}
              {budget.category.name}
            </p>
          )}
        </div>
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[ae.status] ?? STATUS_STYLES.planned}`}
        >
          {ae.status.charAt(0).toUpperCase() + ae.status.slice(1)}
        </span>
      </div>

      <div className="flex items-baseline justify-between">
        <p className="text-2xl font-bold text-fjord">{formatCurrency(ae.annualAmount)}</p>
        <p className="text-sm text-stone">
          {formatMonthName(ae.dueMonth)} {ae.dueYear}
        </p>
      </div>

      <ProgressBar value={pct} />

      <div className="flex justify-between text-sm">
        <span className="text-stone">{formatCurrency(ae.funded)} funded</span>
        <span className="text-stone">
          {formatCurrency(ae.annualAmount - ae.funded)} remaining
        </span>
      </div>

      <div className="flex items-center justify-between border-t border-mist pt-2">
        <div className="flex items-center gap-3 text-xs text-stone">
          <span>{formatCurrency(ae.monthlySetAside)}/mo</span>
          {ae.isRecurring && <span>Recurring</span>}
        </div>
        <form
          action={async () => {
            'use server'
            await deleteBudget(budget.id)
          }}
        >
          <button
            type="submit"
            className="text-xs text-stone hover:text-ember"
            aria-label={`Delete ${budget.name}`}
          >
            Delete
          </button>
        </form>
      </div>
    </div>
  )
}
