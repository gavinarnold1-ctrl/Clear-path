import { formatCurrency } from '@/lib/utils'
import FlexibleBudgetRow from './FlexibleBudgetRow'
import ProgressBar from '@/components/ui/ProgressBar'
import { budgetProgress } from '@/lib/utils'

interface FlexibleBudget {
  id: string
  name: string
  amount: number
  spent: number
  period: string
  categoryId: string | null
  category: { name: string; icon: string | null } | null
}

interface Props {
  budgets: FlexibleBudget[]
  unallocatedAmount?: number
  unallocatedSpent?: number
}

function getDailyAllowance(amount: number, spent: number): { daily: number; daysLeft: number } {
  const now = new Date()
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
  const today = now.getDate()
  const daysLeft = daysInMonth - today + 1
  const remaining = amount - spent
  const daily = remaining > 0 ? remaining / daysLeft : 0
  return { daily, daysLeft }
}

export default function FlexibleBudgetSection({ budgets, unallocatedAmount, unallocatedSpent }: Props) {
  if (budgets.length === 0 && (unallocatedAmount === undefined || unallocatedAmount <= 0)) return null

  const showUnallocated = unallocatedAmount !== undefined && unallocatedAmount > 0

  return (
    <section className="mb-8">
      <div className="mb-3">
        <h2 className="text-lg font-semibold text-fjord">Flexible</h2>
        <p className="text-sm text-stone">Variable spending you control — track against a monthly limit</p>
      </div>
      <div className="card divide-y divide-mist">
        {showUnallocated && (() => {
          const spent = unallocatedSpent ?? 0
          const pct = budgetProgress(spent, unallocatedAmount)
          const remaining = unallocatedAmount - spent
          const isOver = spent > unallocatedAmount
          const { daily, daysLeft } = getDailyAllowance(unallocatedAmount, spent)
          const pctColor =
            pct >= 100 ? 'text-ember' : pct >= 90 ? 'text-ember' : pct >= 75 ? 'text-birch' : 'text-fjord'

          return (
            <div className="rounded-lg bg-frost/50 px-3 py-3">
              <div className="mb-1 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-fjord">Unallocated Flexible</span>
                  <span className="rounded-badge bg-mist px-1.5 py-0.5 text-[10px] font-medium text-stone">pool</span>
                </div>
                <span className="text-sm text-stone">
                  <span className={pctColor}>{formatCurrency(spent)}</span>
                  {' / '}
                  {formatCurrency(unallocatedAmount)}
                </span>
              </div>

              <ProgressBar value={pct} />

              <div className="mt-1 flex items-center justify-between text-xs">
                {isOver ? (
                  <span className="font-semibold text-ember">
                    {formatCurrency(Math.abs(remaining))} over budget
                  </span>
                ) : (
                  <span className="text-stone">
                    {formatCurrency(daily)}/day remaining ({daysLeft} day{daysLeft !== 1 ? 's' : ''} left)
                  </span>
                )}
                <span className={`font-semibold ${pctColor}`}>{pct}%</span>
              </div>
            </div>
          )
        })()}
        {budgets.map((budget) => (
          <FlexibleBudgetRow
            key={budget.id}
            name={budget.name}
            amount={budget.amount}
            spent={budget.spent}
            categoryId={budget.categoryId}
            category={budget.category}
          />
        ))}
      </div>
    </section>
  )
}
