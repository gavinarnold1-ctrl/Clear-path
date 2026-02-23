import { formatCurrency } from '@/lib/utils'
import { formatOrdinalDay } from '@/lib/budget-engine'
import { deleteBudget } from '@/app/actions/budgets'

interface FixedBudget {
  id: string
  name: string
  amount: number
  spent: number
  isAutoPay: boolean | null
  dueDay: number | null
  varianceLimit: number | null
  category: { name: string; icon: string | null } | null
}

export default function FixedBudgetCard({ budget }: { budget: FixedBudget }) {
  const isPaid = budget.spent > 0

  return (
    <div className="card flex flex-col gap-2">
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
          className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
            isPaid
              ? 'bg-pine/10 text-green-700'
              : 'bg-birch/20 text-amber-700'
          }`}
        >
          {isPaid ? 'Paid' : 'Due'}
        </span>
      </div>

      <p className="text-2xl font-bold text-fjord">{formatCurrency(budget.amount)}</p>

      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-stone">
        {budget.dueDay && <span>Due: {formatOrdinalDay(budget.dueDay)}</span>}
        {budget.isAutoPay && <span>Auto-pay</span>}
      </div>

      {isPaid && budget.varianceLimit !== null && (
        <div className="text-xs">
          {Math.abs(budget.spent - budget.amount) <= budget.varianceLimit ? (
            <span className="text-pine">Within variance</span>
          ) : (
            <span className="text-ember">
              Variance: {formatCurrency(Math.abs(budget.spent - budget.amount))}
            </span>
          )}
        </div>
      )}

      <div className="flex items-center justify-between border-t border-mist pt-2">
        <span className="text-xs text-stone">
          {isPaid ? `Paid: ${formatCurrency(budget.spent)}` : 'Pending'}
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
  )
}
