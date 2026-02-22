import ProgressBar from './ProgressBar'
import { formatCurrency, budgetProgress } from '@/lib/utils'
import { deleteBudget } from '@/app/actions/budgets'

interface Category {
  name: string
  color: string
}

interface Budget {
  id: string
  name: string
  amount: number
  spent: number
  tier: string
  category: Category | null
}

const TIER_LABELS: Record<string, string> = {
  fixed: 'Fixed',
  flexible: 'Flexible',
  annual: 'Annual',
}

export default function BudgetCard({ budget }: { budget: Budget }) {
  const pct = budgetProgress(budget.spent, budget.amount)
  const remaining = budget.amount - budget.spent
  const isOver = budget.spent > budget.amount

  return (
    <div className="card flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-semibold text-gray-900">{budget.name}</p>
          {budget.category && (
            <p className="flex items-center gap-1.5 text-xs text-gray-500">
              <span
                className="inline-block h-2 w-2 rounded-full"
                style={{ backgroundColor: budget.category.color }}
              />
              {budget.category.name}
            </p>
          )}
        </div>
        <span className="shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
          {TIER_LABELS[budget.tier] ?? budget.tier}
        </span>
      </div>

      {/* Progress bar */}
      <ProgressBar value={pct} />

      {/* Spent / Remaining */}
      <div className="flex justify-between text-sm">
        <span className="text-gray-500">{formatCurrency(budget.spent)} spent</span>
        <span className={isOver ? 'font-semibold text-red-600' : 'text-gray-500'}>
          {isOver
            ? `${formatCurrency(Math.abs(remaining))} over`
            : `${formatCurrency(remaining)} left`}
        </span>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between border-t border-gray-100 pt-2">
        <span className="text-xs text-gray-400">Limit: {formatCurrency(budget.amount)}</span>
        <div className="flex items-center gap-3">
          <span
            className={`text-xs font-semibold ${
              pct >= 100 ? 'text-red-600' : pct >= 80 ? 'text-amber-600' : 'text-brand-600'
            }`}
          >
            {pct}%
          </span>
          <form
            action={async () => {
              'use server'
              await deleteBudget(budget.id)
            }}
          >
            <button
              type="submit"
              className="text-xs text-gray-400 hover:text-red-500"
              aria-label={`Delete ${budget.name}`}
            >
              Delete
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
