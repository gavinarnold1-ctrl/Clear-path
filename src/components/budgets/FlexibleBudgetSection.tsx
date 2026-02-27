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
  totalFlexibleBudget?: number
  totalFlexibleSpent?: number
}

const CATCHALL_NAMES = new Set(['miscellaneous', 'uncategorized', 'other', 'everything else', 'personal'])

function getDailyAllowance(amount: number, spent: number): { daily: number; daysLeft: number } {
  const now = new Date()
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
  const today = now.getDate()
  const daysLeft = daysInMonth - today + 1
  const remaining = amount - spent
  const daily = remaining > 0 ? remaining / daysLeft : 0
  return { daily, daysLeft }
}

function getPaceInfo(amount: number, spent: number): { paceMarkerPct: number; diff: number; ahead: boolean } {
  const now = new Date()
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
  const today = now.getDate()
  const dailyPace = amount / daysInMonth
  const expectedSpend = dailyPace * today
  const paceMarkerPct = amount > 0 ? Math.round((expectedSpend / amount) * 100) : 0
  const diff = expectedSpend - spent
  return { paceMarkerPct, diff, ahead: diff > 0 }
}

export default function FlexibleBudgetSection({ budgets, unallocatedAmount, unallocatedSpent, totalFlexibleBudget, totalFlexibleSpent }: Props) {
  // Filter out empty catch-all rows ($0 spent)
  const visibleBudgets = budgets.filter((b) => {
    if (CATCHALL_NAMES.has(b.name.toLowerCase()) && b.spent === 0) return false
    return true
  })

  const showUnallocated = unallocatedAmount !== undefined && unallocatedAmount > 0

  if (visibleBudgets.length === 0 && !showUnallocated) return null

  // Rollup totals: use props if provided, otherwise compute from visible budgets
  const rollupBudget = totalFlexibleBudget ?? visibleBudgets.reduce((sum, b) => sum + b.amount, 0) + (showUnallocated ? unallocatedAmount : 0)
  const rollupSpent = totalFlexibleSpent ?? visibleBudgets.reduce((sum, b) => sum + b.spent, 0) + (showUnallocated ? (unallocatedSpent ?? 0) : 0)
  const rollupPct = budgetProgress(rollupSpent, rollupBudget)
  const rollupColor = rollupPct >= 100 ? 'text-ember' : rollupPct >= 90 ? 'text-ember' : rollupPct >= 75 ? 'text-birch' : 'text-fjord'
  const rollupPace = getPaceInfo(rollupBudget, rollupSpent)

  return (
    <section className="mb-8">
      <div className="mb-3">
        <h2 className="text-lg font-semibold text-fjord">Flexible</h2>
        <p className="text-sm text-stone">Variable spending you control — track against a monthly limit</p>
      </div>
      <div className="card divide-y divide-mist">
        {/* Rollup summary at top */}
        {rollupBudget > 0 && (
          <div className="rounded-lg bg-frost/30 px-3 py-3">
            <div className="mb-1 flex items-center justify-between">
              <span className="text-sm font-semibold text-fjord">Flexible Budget</span>
              <span className="text-sm text-stone">
                <span className={rollupColor}>{formatCurrency(rollupSpent)}</span>
                {' of '}
                {formatCurrency(rollupBudget)}
              </span>
            </div>
            <ProgressBar value={rollupPct} paceMarker={rollupPace.paceMarkerPct} />
            <div className="mt-1 flex items-center justify-between text-xs">
              <span className="text-stone">
                {rollupSpent <= rollupBudget
                  ? `${formatCurrency(rollupBudget - rollupSpent)} remaining`
                  : ''
                }
                {rollupSpent > rollupBudget && (
                  <span className="font-semibold text-ember">{formatCurrency(rollupSpent - rollupBudget)} over budget</span>
                )}
                {rollupSpent <= rollupBudget && (
                  <>
                    {' · '}
                    <span className={rollupPace.ahead ? 'text-pine' : 'text-ember'}>
                      {formatCurrency(Math.abs(rollupPace.diff))} {rollupPace.ahead ? 'ahead' : 'behind'}
                    </span>
                  </>
                )}
              </span>
              <span className={`font-semibold ${rollupColor}`}>{rollupPct}%</span>
            </div>
          </div>
        )}

        {/* Named budgets (sorted) */}
        {visibleBudgets.map((budget) => (
          <FlexibleBudgetRow
            key={budget.id}
            name={budget.name}
            amount={budget.amount}
            spent={budget.spent}
            categoryId={budget.categoryId}
            category={budget.category}
          />
        ))}

        {/* Unallocated flexible at bottom */}
        {showUnallocated && (() => {
          const spent = unallocatedSpent ?? 0
          const pct = budgetProgress(spent, unallocatedAmount)
          const remaining = unallocatedAmount - spent
          const isOver = spent > unallocatedAmount
          const { daily, daysLeft } = getDailyAllowance(unallocatedAmount, spent)
          const unallocPace = getPaceInfo(unallocatedAmount, spent)
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

              <ProgressBar value={pct} paceMarker={unallocPace.paceMarkerPct} />

              <div className="mt-1 flex items-center justify-between text-xs">
                {isOver ? (
                  <span className="font-semibold text-ember">
                    {formatCurrency(Math.abs(remaining))} over budget
                  </span>
                ) : (
                  <span className="text-stone">
                    {formatCurrency(daily)}/day remaining ({daysLeft} day{daysLeft !== 1 ? 's' : ''} left)
                    {' · '}
                    <span className={unallocPace.ahead ? 'text-pine' : 'text-ember'}>
                      {formatCurrency(Math.abs(unallocPace.diff))} {unallocPace.ahead ? 'ahead' : 'behind'}
                    </span>
                  </span>
                )}
                <span className={`font-semibold ${pctColor}`}>{pct}%</span>
              </div>
            </div>
          )
        })()}
      </div>
    </section>
  )
}
