import ProgressBar from './ProgressBar'
import { formatCurrency, budgetProgress } from '@/lib/utils'
import { deleteBudget } from '@/app/actions/budgets'

interface Category {
  name: string
  icon: string | null
}

interface Budget {
  id: string
  name: string
  amount: number
  spent: number
  period: string
  tier: string
  category: Category | null
}

const PERIOD_LABELS: Record<string, string> = {
  WEEKLY: 'Weekly',
  MONTHLY: 'Monthly',
  QUARTERLY: 'Quarterly',
  YEARLY: 'Yearly',
  CUSTOM: 'Custom',
}

const TIER_BADGE: Record<string, { bg: string; text: string }> = {
  FIXED: { bg: 'bg-fjord/[0.08]', text: 'text-fjord' },
  FLEXIBLE: { bg: 'bg-lichen/30', text: 'text-pine' },
  ANNUAL: { bg: 'bg-birch/30', text: 'text-[#8B7B5E]' },
}

export default function BudgetCard({ budget }: { budget: Budget }) {
  const pct = budgetProgress(budget.spent, budget.amount)
  const remaining = budget.amount - budget.spent
  const isOver = budget.spent > budget.amount
  const badge = TIER_BADGE[budget.tier]

  return (
    <div className="card flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-[15px] font-semibold text-fjord">{budget.name}</p>
          {budget.category && (
            <p className="flex items-center gap-1.5 text-xs text-stone">
              {budget.category.icon && (
                <span className="inline-block text-sm">{budget.category.icon}</span>
              )}
              {budget.category.name}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {badge && (
            <span className={`shrink-0 rounded-badge px-2 py-0.5 text-[10px] font-semibold ${badge.bg} ${badge.text}`}>
              {budget.tier}
            </span>
          )}
          <span className="shrink-0 text-xs text-stone">
            {PERIOD_LABELS[budget.period] ?? budget.period}
          </span>
        </div>
      </div>

      {/* Progress bar */}
      <ProgressBar value={pct} />

      {/* Spent / Remaining */}
      <div className="flex justify-between text-sm">
        <span className="text-stone">
          <span className="font-mono font-medium text-fjord">{formatCurrency(budget.spent)}</span> spent
        </span>
        <span className={isOver ? 'font-semibold text-ember' : 'text-stone'}>
          {isOver
            ? `${formatCurrency(Math.abs(remaining))} over`
            : `${formatCurrency(remaining)} left`}
        </span>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between border-t border-mist pt-2">
        <span className="text-xs text-stone">Limit: {formatCurrency(budget.amount)}</span>
        <div className="flex items-center gap-3">
          <span
            className={`font-mono text-xs font-medium ${
              pct >= 100 ? 'text-ember' : pct >= 80 ? 'text-birch' : 'text-pine'
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
              className="text-xs text-stone hover:text-ember"
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
