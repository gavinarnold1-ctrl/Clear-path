import ProgressBar from '@/components/ui/ProgressBar'
import { formatCurrency, budgetProgress } from '@/lib/utils'

interface Props {
  name: string
  amount: number
  spent: number
  category: { name: string; icon: string | null } | null
}

function getDailyAllowance(amount: number, spent: number): { daily: number; daysLeft: number } {
  const now = new Date()
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
  const today = now.getDate()
  const daysLeft = daysInMonth - today + 1 // Include today

  const remaining = amount - spent
  const daily = remaining > 0 ? remaining / daysLeft : 0

  return { daily, daysLeft }
}

export default function FlexibleBudgetRow({ name, amount, spent, category }: Props) {
  const pct = budgetProgress(spent, amount)
  const remaining = amount - spent
  const isOver = spent > amount
  const { daily, daysLeft } = getDailyAllowance(amount, spent)

  const pctColor =
    pct >= 100 ? 'text-red-600' : pct >= 90 ? 'text-red-500' : pct >= 75 ? 'text-amber-600' : 'text-brand-600'

  return (
    <div className="rounded-lg px-3 py-3 hover:bg-gray-50">
      <div className="mb-1 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {category?.icon && <span className="text-sm">{category.icon}</span>}
          <span className="font-medium text-gray-900">{name}</span>
        </div>
        <span className="text-sm text-gray-600">
          <span className={pctColor}>{formatCurrency(spent)}</span>
          {' / '}
          {formatCurrency(amount)}
        </span>
      </div>

      <ProgressBar value={pct} />

      <div className="mt-1 flex items-center justify-between text-xs">
        {isOver ? (
          <span className="font-semibold text-red-600">
            {formatCurrency(Math.abs(remaining))} over budget
          </span>
        ) : (
          <span className="text-gray-500">
            {formatCurrency(daily)}/day remaining ({daysLeft} day{daysLeft !== 1 ? 's' : ''} left)
          </span>
        )}
        <span className={`font-semibold ${pctColor}`}>{pct}%</span>
      </div>
    </div>
  )
}
