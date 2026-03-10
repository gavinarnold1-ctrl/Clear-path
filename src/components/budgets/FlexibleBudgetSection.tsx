import Link from 'next/link'
import { formatCurrency } from '@/lib/utils'
import FlexibleBudgetRow from './FlexibleBudgetRow'
import BenchmarkBar from './BenchmarkBar'
import ProgressBar from '@/components/ui/ProgressBar'
import SortableFlexibleCards from './SortableFlexibleCards'
import { budgetProgress } from '@/lib/utils'
import type { BudgetBenchmarkComparison } from '@/lib/budget-benchmarks'

interface FlexibleBudget {
  id: string
  name: string
  amount: number
  spent: number
  period: string
  categoryId: string | null
  resolvedCategoryId: string | null
  category: { name: string; icon: string | null } | null
  _count?: { overrideTransactions: number }
}

interface Props {
  budgets: FlexibleBudget[]
  unallocatedAmount?: number
  unallocatedSpent?: number
  totalFlexibleBudget?: number
  totalFlexibleSpent?: number
  benchmarks?: BudgetBenchmarkComparison[]
  primaryGoal?: string
  hasGoalTarget?: boolean
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

function getCurrentMonth(): string {
  const now = new Date()
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`
}

export default function FlexibleBudgetSection({ budgets, unallocatedAmount, unallocatedSpent, totalFlexibleBudget, totalFlexibleSpent, benchmarks, primaryGoal, hasGoalTarget }: Props) {
  const benchmarkMap = new Map((benchmarks ?? []).map(b => [b.categoryName, b]))
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
      {/* Flexible Budget Summary — visually distinct header above category cards */}
      {rollupBudget > 0 && (
        <div className="mb-3 rounded-card border border-pine/30 bg-pine/5 px-5 py-4">
          <div className="mb-0.5 flex items-center gap-2">
            <h2 className="font-display text-lg font-semibold text-fjord">Flexible Spending</h2>
            <span className="rounded-badge bg-pine/15 px-2 py-0.5 text-[10px] font-semibold text-pine">
              {formatCurrency(rollupBudget)}/mo
            </span>
          </div>
          <p className="mb-3 text-xs text-stone">Variable spending you control — track against a monthly limit</p>

          <div className="mb-1 flex items-center justify-between">
            <span className="font-mono text-sm font-semibold text-fjord">
              {formatCurrency(rollupSpent)}
              <span className="font-normal text-stone"> of {formatCurrency(rollupBudget)}</span>
            </span>
            <span className={`font-mono text-sm font-semibold ${rollupColor}`}>{rollupPct}%</span>
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
            <span className="text-stone">
              {(() => {
                const { daily, daysLeft } = getDailyAllowance(rollupBudget, rollupSpent)
                return rollupSpent <= rollupBudget
                  ? `${formatCurrency(daily)}/day · ${daysLeft} day${daysLeft !== 1 ? 's' : ''} left`
                  : ''
              })()}
            </span>
          </div>
        </div>
      )}

      {/* Heading fallback when there's no rollup budget */}
      {rollupBudget <= 0 && (
        <div className="mb-3">
          <h2 className="font-display text-lg font-semibold text-fjord">Flexible Spending</h2>
          <p className="text-sm text-stone">Variable spending you control — track against a monthly limit</p>
        </div>
      )}

      {/* Individual flexible category cards — drag-and-drop sortable */}
      <SortableFlexibleCards
        items={visibleBudgets.map((budget) => {
          const bm = benchmarkMap.get(budget.category?.name ?? budget.name)
          return {
            id: budget.id,
            content: (
              <>
                <FlexibleBudgetRow
                  id={budget.id}
                  name={budget.name}
                  amount={budget.amount}
                  spent={budget.spent}
                  categoryId={budget.resolvedCategoryId ?? budget.categoryId}
                  category={budget.category}
                  isCatchAll={CATCHALL_NAMES.has(budget.name.toLowerCase())}
                  overrideCount={budget._count?.overrideTransactions}
                />
                {bm && (
                  <div className="px-3 pb-2">
                    <BenchmarkBar benchmark={bm} goalAware={!!hasGoalTarget} primaryGoal={primaryGoal} />
                  </div>
                )}
              </>
            ),
          }
        })}
        trailing={<>
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
            <Link
              href={`/transactions?tier=FLEXIBLE&catchAll=true&month=${getCurrentMonth()}`}
              className="block rounded-lg bg-frost/50 px-3 py-3 hover:bg-frost"
            >
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
            </Link>
          )
        })()}
        </>}
      />
    </section>
  )
}
